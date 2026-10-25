// Sync engine (§9.3). Pure logic over a SyncStore and a submit function, so the
// state machine is unit-tested without SQLite or the network.
//
// Rules implemented here:
//  1. Idempotency: the stored client_submission_id is sent on every retry.
//  3. One worker at a time (single flight), FIFO, backoff 5 s → 15 min; "Sync now" resets it.
//  4. client_marked_at / device_id are sent for audit; the server decides lateness and locks.
//  5. Locked / cancelled → rejected, marks kept for a correction request.
// Killed mid-sync: resetInterrupted() puts `syncing` back to `queued` at the next run.
import { ApiError } from '../lib/errors';
import type { OutboxItem, RejectCode, SubmitFn, SyncStore } from './types';

export const BACKOFF_MIN_MS = 5_000;
export const BACKOFF_MAX_MS = 15 * 60_000;

/** Codes that will not succeed on retry: the register needs the professor's attention. */
const PERMANENT_CODES = new Set([
  'ATT_LOCKED',
  'ATT_CANCELLED',
  'ATT_NOT_ASSIGNED',
  'ATT_UNKNOWN_STUDENT',
  'ATT_INVALID_STATUS',
  'NOT_FOUND',
  'ACCOUNT_INACTIVE',
  'FORBIDDEN',
  'VALIDATION',
]);

export function backoffMs(attempts: number): number {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** Math.max(0, attempts - 1));
}

export interface SyncReport {
  synced: number;
  conflicts: number;
  rejected: number;
  retrying: number;
  /** Stopped early (signed out / token expired). */
  halted: boolean;
}

export interface SyncEngineDeps {
  store: SyncStore;
  submit: SubmitFn;
  now?: () => Date;
  /** Called after every state change so the UI can refresh. */
  onChange?: () => void;
}

export function createSyncEngine({ store, submit, now = () => new Date(), onChange }: SyncEngineDeps) {
  let inFlight: Promise<SyncReport> | null = null;

  async function processItem(item: OutboxItem, report: SyncReport): Promise<'continue' | 'halt'> {
    const at = () => now().toISOString();
    await store.setSyncing(item.session_id);
    onChange?.();
    try {
      const result = await submit(item.payload);
      switch (result.result) {
        case 'ok':
        case 'duplicate':
          await store.markSynced(item, result, at());
          report.synced++;
          break;
        case 'conflict':
          await store.markConflict(item, result, at());
          report.conflicts++;
          break;
        case 'locked':
        case 'cancelled':
          await store.markRejected(item, result.result, null, at());
          report.rejected++;
          break;
        default:
          await retry(item, `Unexpected result ${String((result as { result?: unknown }).result)}`, report);
      }
    } catch (e) {
      const code = e instanceof ApiError ? e.code : null;
      if (code === 'AUTH_REQUIRED') {
        // Keep the item exactly as it is; it syncs after the next sign-in refresh.
        await store.reschedule(item, item.attempts, at(), 'Session expired', at());
        report.halted = true;
        onChange?.();
        return 'halt';
      }
      if (code && PERMANENT_CODES.has(code)) {
        const reject: RejectCode = code === 'ATT_LOCKED' ? 'locked' : code === 'ATT_CANCELLED' ? 'cancelled' : code;
        await store.markRejected(item, reject, e instanceof Error ? e.message : null, at());
        report.rejected++;
      } else {
        // Network errors, 5xx, ATT_TOO_EARLY and anything unknown: stay queued and back off.
        await retry(item, e instanceof Error ? e.message : String(e), report);
      }
    }
    onChange?.();
    return 'continue';
  }

  async function retry(item: OutboxItem, error: string, report: SyncReport) {
    const attempts = item.attempts + 1;
    const next = new Date(now().getTime() + backoffMs(attempts)).toISOString();
    await store.reschedule(item, attempts, next, error, now().toISOString());
    report.retrying++;
  }

  async function runOnce(force: boolean): Promise<SyncReport> {
    const report: SyncReport = { synced: 0, conflicts: 0, rejected: 0, retrying: 0, halted: false };
    await store.resetInterrupted();
    if (force) {
      await store.resetBackoff(now().toISOString());
    }
    const items = await store.dueItems(now().toISOString());
    for (const item of items) {
      if ((await processItem(item, report)) === 'halt') {
        break;
      }
    }
    return report;
  }

  return {
    /**
     * Runs the outbox once. Concurrent callers share the same run (single flight).
     * `force` ("Sync now") makes every queued item due immediately.
     */
    run(opts: { force?: boolean } = {}): Promise<SyncReport> {
      if (inFlight) {
        return inFlight;
      }
      inFlight = runOnce(!!opts.force).finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
    isRunning: () => inFlight !== null,
    pending: () => store.outboxCount(),
  };
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;
