// Sync engine state machine (§9.3, §19) against an in-memory store and a fake
// server that behaves like submit_attendance(): idempotent by client_submission_id.
import { ApiError } from '../src/lib/errors';
import { BACKOFF_MAX_MS, BACKOFF_MIN_MS, backoffMs, createSyncEngine } from '../src/offline/sync';
import type { LocalRegister, OutboxItem, SubmitPayload, SyncStore } from '../src/offline/types';
import type { SubmitResult } from '../src/types/database';

class MemoryStore implements SyncStore {
  registers = new Map<string, LocalRegister>();
  outbox: OutboxItem[] = [];
  private nextId = 1;

  enqueue(sessionId: string, clientId: string, at: string, overrides: Partial<SubmitPayload> = {}) {
    const payload: SubmitPayload = {
      session_id: sessionId,
      client_submission_id: clientId,
      base_version: 0,
      records: [{ student_id: 's1', status: 'P', marked_at: at }],
      client_marked_at: at,
      device_id: 'device-1',
      ...overrides,
    };
    this.registers.set(sessionId, {
      session_id: sessionId,
      state: 'queued',
      client_submission_id: clientId,
      base_version: payload.base_version,
      defaulted_students: null,
      defaulted_ack: false,
      server_copy: null,
      reject_code: null,
      last_error: null,
      updated_at: at,
    });
    this.outbox.push({
      id: this.nextId++,
      kind: 'submit_attendance',
      session_id: sessionId,
      client_submission_id: clientId,
      payload,
      attempts: 0,
      next_attempt_at: at,
      created_at: at,
    });
  }

  state(sessionId: string) {
    return this.registers.get(sessionId)?.state;
  }

  private patch(sessionId: string, p: Partial<LocalRegister>) {
    const r = this.registers.get(sessionId)!;
    this.registers.set(sessionId, { ...r, ...p });
  }

  private drop(id: number) {
    this.outbox = this.outbox.filter(i => i.id !== id);
  }

  async resetInterrupted() {
    for (const r of this.registers.values()) {
      if (r.state === 'syncing') {
        this.patch(r.session_id, { state: 'queued' });
      }
    }
  }
  async dueItems(nowIso: string) {
    return this.outbox.filter(i => i.next_attempt_at <= nowIso).sort((a, b) => a.id - b.id).map(i => ({ ...i }));
  }
  async resetBackoff(nowIso: string) {
    this.outbox = this.outbox.map(i => ({ ...i, next_attempt_at: nowIso }));
  }
  async setSyncing(sessionId: string) {
    this.patch(sessionId, { state: 'syncing' });
  }
  async markSynced(item: OutboxItem, result: SubmitResult) {
    this.patch(item.session_id, {
      state: 'synced',
      base_version: result.register?.version ?? item.payload.base_version,
      defaulted_students: result.defaulted_students ?? [],
    });
    this.drop(item.id);
  }
  async markConflict(item: OutboxItem, result: SubmitResult) {
    this.patch(item.session_id, { state: 'conflict', server_copy: { version: result.register?.version ?? 0, records: result.records ?? [] } });
    this.drop(item.id);
  }
  async markRejected(item: OutboxItem, code: string, message: string | null) {
    this.patch(item.session_id, { state: 'rejected', reject_code: code, last_error: message });
    this.drop(item.id);
  }
  async reschedule(item: OutboxItem, attempts: number, nextAttemptAtIso: string, error: string) {
    this.outbox = this.outbox.map(i => (i.id === item.id ? { ...i, attempts, next_attempt_at: nextAttemptAtIso } : i));
    this.patch(item.session_id, { state: 'queued', last_error: error });
  }
  async outboxCount() {
    return this.outbox.length;
  }
}

/** Fake submit_attendance(): stores results by client_submission_id like the real RPC. */
class FakeServer {
  applied = new Map<string, SubmitResult>();
  version = new Map<string, number>();
  calls: SubmitPayload[] = [];
  failures: (Error | null)[] = [];
  forced: Partial<Record<string, SubmitResult['result']>> = {};

  submit = async (p: SubmitPayload): Promise<SubmitResult> => {
    this.calls.push(p);
    const failure = this.failures.shift();
    if (failure) {
      throw failure;
    }
    const forced = this.forced[p.session_id];
    if (forced === 'conflict') {
      return { result: 'conflict', register: { version: 3, state: 'submitted', submitted_at: 'x' }, records: [{ student_id: 's1', status: 'A' }] };
    }
    if (forced) {
      return { result: forced };
    }
    const previous = this.applied.get(p.client_submission_id);
    if (previous) {
      return { ...previous, result: 'duplicate' };
    }
    const v = (this.version.get(p.session_id) ?? 0) + 1;
    this.version.set(p.session_id, v);
    const res: SubmitResult = {
      result: 'ok',
      register: { version: v, state: 'submitted', submitted_at: new Date().toISOString() },
      defaulted_students: [{ student_id: 's9', status: 'A' }],
    };
    this.applied.set(p.client_submission_id, res);
    return res;
  };
}

const T0 = new Date('2026-10-26T04:30:00.000Z');

function setup(start = T0) {
  let now = start;
  const store = new MemoryStore();
  const server = new FakeServer();
  const engine = createSyncEngine({ store, submit: server.submit, now: () => now });
  const advance = (ms: number) => {
    now = new Date(now.getTime() + ms);
  };
  return { store, server, engine, advance, at: () => now.toISOString() };
}

const network = () => new Error('Network request failed');

describe('sync engine', () => {
  it('syncs a queued register and records the server version', async () => {
    const { store, server, engine, at } = setup();
    store.enqueue('sess-1', 'cid-1', at());
    const report = await engine.run();
    expect(report.synced).toBe(1);
    expect(store.state('sess-1')).toBe('synced');
    expect(store.registers.get('sess-1')!.base_version).toBe(1);
    expect(store.outbox).toHaveLength(0);
    expect(server.calls[0].client_submission_id).toBe('cid-1');
  });

  it('keeps the roster-drift students the server defaulted', async () => {
    const { store, engine, at } = setup();
    store.enqueue('sess-1', 'cid-1', at());
    await engine.run();
    expect(store.registers.get('sess-1')!.defaulted_students).toEqual([{ student_id: 's9', status: 'A' }]);
  });

  it('treats a duplicate as synced', async () => {
    const { store, server, engine, at } = setup();
    server.applied.set('cid-1', { result: 'ok', register: { version: 4, state: 'submitted', submitted_at: 'x' } });
    store.enqueue('sess-1', 'cid-1', at());
    const report = await engine.run();
    expect(report.synced).toBe(1);
    expect(store.state('sess-1')).toBe('synced');
    expect(store.registers.get('sess-1')!.base_version).toBe(4);
  });

  it('stores the server copy on a conflict', async () => {
    const { store, server, engine, at } = setup();
    server.forced['sess-1'] = 'conflict';
    store.enqueue('sess-1', 'cid-1', at());
    const report = await engine.run();
    expect(report.conflicts).toBe(1);
    expect(store.state('sess-1')).toBe('conflict');
    expect(store.registers.get('sess-1')!.server_copy).toEqual({ version: 3, records: [{ student_id: 's1', status: 'A' }] });
    expect(store.outbox).toHaveLength(0);
  });

  it.each(['locked', 'cancelled'] as const)('rejects a %s register and keeps the marks', async result => {
    const { store, server, engine, at } = setup();
    server.forced['sess-1'] = result;
    store.enqueue('sess-1', 'cid-1', at());
    const report = await engine.run();
    expect(report.rejected).toBe(1);
    expect(store.state('sess-1')).toBe('rejected');
    expect(store.registers.get('sess-1')!.reject_code).toBe(result);
    expect(store.outbox).toHaveLength(0);
  });

  it('rejects permanently on authorisation errors', async () => {
    const { store, server, engine, at } = setup();
    server.failures.push(new ApiError('ATT_NOT_ASSIGNED', 'You are not assigned to this session.'));
    store.enqueue('sess-1', 'cid-1', at());
    await engine.run();
    expect(store.state('sess-1')).toBe('rejected');
    expect(store.registers.get('sess-1')!.reject_code).toBe('ATT_NOT_ASSIGNED');
  });

  it('retries a network flake with the same submission id and syncs exactly once', async () => {
    const { store, server, engine, advance, at } = setup();
    server.failures.push(network());
    store.enqueue('sess-1', 'cid-1', at());

    const first = await engine.run();
    expect(first.retrying).toBe(1);
    expect(store.state('sess-1')).toBe('queued');
    expect(store.outbox[0].attempts).toBe(1);

    advance(BACKOFF_MIN_MS - 1);
    await engine.run();
    expect(server.calls).toHaveLength(1); // not due yet

    advance(1);
    await engine.run();
    expect(store.state('sess-1')).toBe('synced');
    expect(server.calls.map(c => c.client_submission_id)).toEqual(['cid-1', 'cid-1']);
    expect(server.applied.size).toBe(1);
  });

  it('treats a lost response (applied server-side, network error client-side) as a duplicate on retry', async () => {
    const { store, server, advance, at } = setup();
    store.enqueue('sess-1', 'cid-1', at());
    const realSubmit = server.submit;
    let lose = true;
    const engine2 = createSyncEngine({
      store,
      now: () => new Date(at()),
      submit: async p => {
        const res = await realSubmit(p);
        if (lose) {
          lose = false;
          throw network();
        }
        return res;
      },
    });
    await engine2.run();
    expect(store.state('sess-1')).toBe('queued');
    advance(BACKOFF_MIN_MS);
    const report = await engine2.run();
    expect(report.synced).toBe(1);
    expect(server.version.get('sess-1')).toBe(1); // applied once
  });

  it('recovers when the app was killed mid-sync', async () => {
    const { store, server, at } = setup();
    store.enqueue('sess-1', 'cid-1', at());
    await store.setSyncing('sess-1'); // the process died here, before or after the request landed
    server.applied.set('cid-1', { result: 'ok', register: { version: 1, state: 'submitted', submitted_at: 'x' } });

    const restarted = createSyncEngine({ store, submit: server.submit, now: () => new Date(at()) });
    const report = await restarted.run();
    expect(report.synced).toBe(1);
    expect(store.state('sess-1')).toBe('synced');
    expect(server.calls[0].client_submission_id).toBe('cid-1');
  });

  it('backs off exponentially up to 15 minutes', () => {
    expect(backoffMs(1)).toBe(5_000);
    expect(backoffMs(2)).toBe(10_000);
    expect(backoffMs(3)).toBe(20_000);
    expect(backoffMs(20)).toBe(BACKOFF_MAX_MS);
  });

  it('"Sync now" resets the backoff', async () => {
    const { store, server, engine, at } = setup();
    server.failures.push(network(), network(), network());
    store.enqueue('sess-1', 'cid-1', at());
    await engine.run();
    await engine.run({ force: true });
    await engine.run({ force: true });
    expect(store.outbox[0].attempts).toBe(3);
    await engine.run({ force: true });
    expect(store.state('sess-1')).toBe('synced');
    expect(server.calls).toHaveLength(4);
  });

  it('runs one worker at a time', async () => {
    const { store, server, engine, at } = setup();
    store.enqueue('sess-1', 'cid-1', at());
    const [a, b] = await Promise.all([engine.run(), engine.run()]);
    expect(a).toBe(b);
    expect(server.calls).toHaveLength(1);
  });

  it('processes the outbox in FIFO order', async () => {
    const { store, server, engine, at } = setup();
    store.enqueue('sess-b', 'cid-b', at());
    store.enqueue('sess-a', 'cid-a', at());
    store.enqueue('sess-c', 'cid-c', at());
    await engine.run();
    expect(server.calls.map(c => c.session_id)).toEqual(['sess-b', 'sess-a', 'sess-c']);
  });

  it('halts without losing work when the session expired', async () => {
    const { store, server, engine, at } = setup();
    server.failures.push(new ApiError('AUTH_REQUIRED', 'Your session has expired.'));
    store.enqueue('sess-1', 'cid-1', at());
    store.enqueue('sess-2', 'cid-2', at());
    const report = await engine.run();
    expect(report.halted).toBe(true);
    expect(server.calls).toHaveLength(1);
    expect(store.outbox).toHaveLength(2);
    expect(store.state('sess-1')).toBe('queued');
    expect(store.outbox[0].attempts).toBe(0);
  });

  it('sends the device clock unchanged so the server can flag clock skew', async () => {
    const { store, server, engine, at } = setup();
    const skewed = new Date(T0.getTime() - 9 * 60_000).toISOString(); // device 9 minutes behind
    store.enqueue('sess-1', 'cid-1', at(), { client_marked_at: skewed });
    await engine.run();
    expect(server.calls[0].client_marked_at).toBe(skewed);
    expect(server.calls[0].device_id).toBe('device-1');
  });

  it('keeps retrying when marking has not opened yet', async () => {
    const { store, server, engine, at } = setup();
    server.failures.push(new ApiError('ATT_TOO_EARLY', 'Too early'));
    store.enqueue('sess-1', 'cid-1', at());
    const report = await engine.run();
    expect(report.retrying).toBe(1);
    expect(store.state('sess-1')).toBe('queued');
  });
});
