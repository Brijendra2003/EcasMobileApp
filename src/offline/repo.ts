// SQLite repository for the professor's offline work (§9).
import type { Transaction } from '@op-engineering/op-sqlite';
import type { MySessionRow, RosterRow, SubmitResult } from '../types/database';
import { exec, getDb, query } from './db';
import type { LocalRegister, OutboxItem, RejectCode, SubmitPayload, SyncStore } from './types';

// ── Sessions and rosters (prefetch) ───────────────────────────────────────
interface SessionRowDb {
  data: string;
}

export async function replaceSessionWindow(from: string, to: string, sessions: MySessionRow[], rosters: RosterRow[]) {
  const fetchedAt = new Date().toISOString();
  await getDb().transaction(async tx => {
    await tx.execute('delete from local_sessions where session_date between ? and ?', [from, to]);
    for (const s of sessions) {
      await tx.execute(
        `insert or replace into local_sessions (id, session_date, starts_at, ends_at, status, register_state, register_version, data, fetched_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [s.id, s.session_date, s.starts_at, s.ends_at, s.status, s.register_state, s.register_version, JSON.stringify(s), fetchedAt],
      );
    }
    const ids = [...new Set(rosters.map(r => r.session_id))];
    for (const id of ids) {
      await tx.execute('delete from local_roster where session_id = ?', [id]);
    }
    for (const r of rosters) {
      await tx.execute(
        `insert or replace into local_roster (session_id, student_id, roll_no, name, batch_code, photo_url, suggested_status)
         values (?, ?, ?, ?, ?, ?, ?)`,
        [r.session_id, r.student_id, r.roll_no, r.full_name, r.batch_code, r.photo_url, r.suggested_status],
      );
    }
  });
}

/** Keeps the offline footprint small (§15): drops old sessions with nothing left to sync. */
export async function purgeBefore(date: string) {
  await getDb().transaction(async tx => {
    const keep = `select session_id from local_registers where state not in ('synced')`;
    await tx.execute(`delete from local_roster where session_id in (select id from local_sessions where session_date < ?) and session_id not in (${keep})`, [date]);
    await tx.execute(`delete from local_marks where session_id in (select id from local_sessions where session_date < ?) and session_id not in (${keep})`, [date]);
    await tx.execute(`delete from local_registers where state = 'synced' and session_id in (select id from local_sessions where session_date < ?)`, [date]);
    await tx.execute(`delete from local_sessions where session_date < ? and id not in (${keep})`, [date]);
  });
}

export async function upsertSession(s: MySessionRow) {
  await exec(
    `insert or replace into local_sessions (id, session_date, starts_at, ends_at, status, register_state, register_version, data, fetched_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [s.id, s.session_date, s.starts_at, s.ends_at, s.status, s.register_state, s.register_version, JSON.stringify(s), new Date().toISOString()],
  );
}

export async function replaceRoster(sessionId: string, roster: RosterRow[]) {
  await getDb().transaction(async tx => {
    await tx.execute('delete from local_roster where session_id = ?', [sessionId]);
    for (const r of roster) {
      await tx.execute(
        `insert into local_roster (session_id, student_id, roll_no, name, batch_code, photo_url, suggested_status) values (?, ?, ?, ?, ?, ?, ?)`,
        [sessionId, r.student_id, r.roll_no, r.full_name, r.batch_code, r.photo_url, r.suggested_status],
      );
    }
  });
}

export async function sessionsBetween(from: string, to: string): Promise<MySessionRow[]> {
  const rows = await query<SessionRowDb>('select data from local_sessions where session_date between ? and ? order by starts_at', [from, to]);
  return rows.map(r => JSON.parse(r.data) as MySessionRow);
}

export async function getSession(id: string): Promise<MySessionRow | null> {
  const rows = await query<SessionRowDb>('select data from local_sessions where id = ?', [id]);
  return rows[0] ? (JSON.parse(rows[0].data) as MySessionRow) : null;
}

export interface LocalRosterRow {
  student_id: string;
  roll_no: number | null;
  name: string;
  batch_code: string | null;
  photo_url: string | null;
  suggested_status: string | null;
}

export async function getRoster(sessionId: string): Promise<LocalRosterRow[]> {
  return query<LocalRosterRow>(
    `select student_id, roll_no, name, batch_code, photo_url, suggested_status from local_roster
     where session_id = ? order by roll_no is null, roll_no, name`,
    [sessionId],
  );
}

// ── Registers and marks ───────────────────────────────────────────────────
interface RegisterRowDb {
  session_id: string;
  state: string;
  client_submission_id: string | null;
  base_version: number;
  defaulted_students: string | null;
  defaulted_ack: number;
  server_copy: string | null;
  reject_code: string | null;
  last_error: string | null;
  updated_at: string;
}

function toRegister(r: RegisterRowDb): LocalRegister {
  return {
    session_id: r.session_id,
    state: r.state as LocalRegister['state'],
    client_submission_id: r.client_submission_id,
    base_version: Number(r.base_version ?? 0),
    defaulted_students: r.defaulted_students ? JSON.parse(r.defaulted_students) : null,
    defaulted_ack: !!r.defaulted_ack,
    server_copy: r.server_copy ? JSON.parse(r.server_copy) : null,
    reject_code: r.reject_code,
    last_error: r.last_error,
    updated_at: r.updated_at,
  };
}

export async function getRegister(sessionId: string): Promise<LocalRegister | null> {
  const rows = await query<RegisterRowDb>('select * from local_registers where session_id = ?', [sessionId]);
  return rows[0] ? toRegister(rows[0]) : null;
}

export async function registersFor(sessionIds: string[]): Promise<Map<string, LocalRegister>> {
  const map = new Map<string, LocalRegister>();
  if (sessionIds.length === 0) {
    return map;
  }
  const rows = await query<RegisterRowDb>(
    `select * from local_registers where session_id in (${sessionIds.map(() => '?').join(',')})`,
    sessionIds,
  );
  for (const r of rows) {
    map.set(r.session_id, toRegister(r));
  }
  return map;
}

export async function getMarks(sessionId: string): Promise<Record<string, string | null>> {
  const rows = await query<{ student_id: string; status_code: string | null }>(
    'select student_id, status_code from local_marks where session_id = ?',
    [sessionId],
  );
  return Object.fromEntries(rows.map(r => [r.student_id, r.status_code]));
}

/** Autosave of a single tap (§8.2). */
export async function setMark(sessionId: string, studentId: string, status: string | null) {
  await exec(
    `insert into local_marks (session_id, student_id, status_code, marked_at) values (?, ?, ?, ?)
     on conflict (session_id, student_id) do update set status_code = excluded.status_code, marked_at = excluded.marked_at`,
    [sessionId, studentId, status, new Date().toISOString()],
  );
  await exec(`update local_registers set updated_at = ? where session_id = ? and state = 'draft'`, [new Date().toISOString(), sessionId]);
}

export async function setMarksBulk(sessionId: string, marks: Record<string, string | null>) {
  const at = new Date().toISOString();
  await getDb().transaction(async tx => {
    for (const [studentId, status] of Object.entries(marks)) {
      await tx.execute(
        `insert into local_marks (session_id, student_id, status_code, marked_at) values (?, ?, ?, ?)
         on conflict (session_id, student_id) do update set status_code = excluded.status_code, marked_at = excluded.marked_at`,
        [sessionId, studentId, status, at],
      );
    }
  });
}

/**
 * Opens (or resumes) a draft. An existing draft is resumed as is; a synced
 * register becomes a new draft from the synced marks with base_version set to
 * the server version (rule 2). `seed` fills marks when the register was
 * submitted elsewhere (e.g. by a co-teacher).
 */
export async function openDraft(sessionId: string, serverVersion: number, seed?: Record<string, string | null>): Promise<LocalRegister> {
  const existing = await getRegister(sessionId);
  if (existing && existing.state !== 'synced') {
    return existing;
  }
  const at = new Date().toISOString();
  await getDb().transaction(async tx => {
    await tx.execute(
      `insert into local_registers (session_id, state, client_submission_id, base_version, updated_at) values (?, 'draft', null, ?, ?)
       on conflict (session_id) do update set state = 'draft', client_submission_id = null, base_version = excluded.base_version,
         server_copy = null, reject_code = null, last_error = null, updated_at = excluded.updated_at`,
      [sessionId, serverVersion, at],
    );
    if (seed) {
      await tx.execute('delete from local_marks where session_id = ?', [sessionId]);
      for (const [studentId, status] of Object.entries(seed)) {
        await tx.execute('insert into local_marks (session_id, student_id, status_code, marked_at) values (?, ?, ?, ?)', [sessionId, studentId, status, at]);
      }
    }
  });
  return (await getRegister(sessionId))!;
}

export async function discardDraft(sessionId: string) {
  await getDb().transaction(async tx => {
    const rows = await tx.execute('select state from local_registers where session_id = ?', [sessionId]);
    if (rows.rows[0]?.state !== 'draft') {
      return;
    }
    await tx.execute('delete from local_marks where session_id = ?', [sessionId]);
    await tx.execute('delete from local_registers where session_id = ?', [sessionId]);
  });
}

/**
 * Submit (§8.2, rule 1): freezes the draft, stores the client_submission_id and
 * enqueues the payload in one transaction, before any network call.
 */
export async function freezeAndEnqueue(payload: SubmitPayload) {
  const at = new Date().toISOString();
  await getDb().transaction(async tx => {
    await tx.execute(
      `update local_registers set state = 'queued', client_submission_id = ?, base_version = ?, reject_code = null,
         last_error = null, server_copy = null, defaulted_students = null, defaulted_ack = 0, updated_at = ? where session_id = ?`,
      [payload.client_submission_id, payload.base_version, at, payload.session_id],
    );
    await tx.execute('delete from outbox where session_id = ?', [payload.session_id]);
    await tx.execute(
      `insert into outbox (kind, session_id, client_submission_id, payload, attempts, next_attempt_at, created_at)
       values ('submit_attendance', ?, ?, ?, 0, ?, ?)`,
      [payload.session_id, payload.client_submission_id, JSON.stringify(payload), at, at],
    );
  });
}

/** Conflict: "Keep server version" discards local marks (§9.3). */
export async function acceptServerCopy(sessionId: string) {
  const reg = await getRegister(sessionId);
  if (!reg?.server_copy) {
    return;
  }
  const copy = reg.server_copy;
  await getDb().transaction(async tx => {
    await tx.execute('delete from local_marks where session_id = ?', [sessionId]);
    for (const r of copy.records) {
      await tx.execute('insert into local_marks (session_id, student_id, status_code, marked_at) values (?, ?, ?, ?)', [sessionId, r.student_id, r.status, new Date().toISOString()]);
    }
    await tx.execute(
      `update local_registers set state = 'synced', base_version = ?, server_copy = null, client_submission_id = null, updated_at = ? where session_id = ?`,
      [copy.version, new Date().toISOString(), sessionId],
    );
  });
}

/** After a correction request (or when the professor gives up): back to the server's marks. */
export async function settleToServer(sessionId: string, version: number, records: { student_id: string; status: string }[]) {
  await getDb().transaction(async tx => {
    await tx.execute('delete from local_marks where session_id = ?', [sessionId]);
    for (const r of records) {
      await tx.execute('insert into local_marks (session_id, student_id, status_code, marked_at) values (?, ?, ?, ?)', [sessionId, r.student_id, r.status, new Date().toISOString()]);
    }
    await tx.execute(
      `insert into local_registers (session_id, state, base_version, updated_at) values (?, 'synced', ?, ?)
       on conflict (session_id) do update set state = 'synced', base_version = excluded.base_version, server_copy = null,
         reject_code = null, last_error = null, client_submission_id = null, updated_at = excluded.updated_at`,
      [sessionId, version, new Date().toISOString()],
    );
  });
}

export async function acknowledgeDefaulted(sessionId: string) {
  await exec('update local_registers set defaulted_ack = 1 where session_id = ?', [sessionId]);
}

export async function unsyncedCount(): Promise<number> {
  const rows = await query<{ n: number }>(`select count(*) as n from local_registers where state in ('queued', 'syncing')`);
  return Number(rows[0]?.n ?? 0);
}

/** Registers that still hold work the server doesn't have (blocks sign-out, rule 7). */
export async function hasUnsyncedWork(): Promise<boolean> {
  const rows = await query<{ n: number }>(`select count(*) as n from local_registers where state in ('queued', 'syncing', 'conflict')`);
  return Number(rows[0]?.n ?? 0) > 0;
}

// ── SyncStore over SQLite ─────────────────────────────────────────────────
interface OutboxRowDb {
  id: number;
  kind: string;
  session_id: string;
  client_submission_id: string;
  payload: string;
  attempts: number;
  next_attempt_at: string;
  created_at: string;
}

async function updateSessionAfterSync(tx: Transaction, sessionId: string, result: SubmitResult) {
  const rows = await tx.execute('select data from local_sessions where id = ?', [sessionId]);
  const raw = rows.rows[0]?.data;
  if (typeof raw !== 'string' || !result.register) {
    return;
  }
  const s = JSON.parse(raw) as MySessionRow;
  const reg = result.register;
  const next: MySessionRow = {
    ...s,
    register_state: reg.state,
    register_version: reg.version,
    submitted_at: reg.submitted_at,
    present_count: reg.present_count ?? s.present_count,
    total_count: reg.total_count ?? s.total_count,
    is_late: reg.is_late ?? s.is_late,
    status: s.status === 'scheduled' ? 'held' : s.status,
  };
  await tx.execute('update local_sessions set register_state = ?, register_version = ?, status = ?, data = ? where id = ?', [
    next.register_state,
    next.register_version,
    next.status,
    JSON.stringify(next),
    sessionId,
  ]);
}

export const sqliteSyncStore: SyncStore = {
  async resetInterrupted() {
    await exec(`update local_registers set state = 'queued' where state = 'syncing'`);
  },
  async dueItems(nowIso) {
    const rows = await query<OutboxRowDb>('select * from outbox where next_attempt_at <= ? order by id', [nowIso]);
    return rows.map(
      (r): OutboxItem => ({
        id: Number(r.id),
        kind: 'submit_attendance',
        session_id: r.session_id,
        client_submission_id: r.client_submission_id,
        payload: JSON.parse(r.payload),
        attempts: Number(r.attempts),
        next_attempt_at: r.next_attempt_at,
        created_at: r.created_at,
      }),
    );
  },
  async resetBackoff(nowIso) {
    await exec('update outbox set next_attempt_at = ?', [nowIso]);
  },
  async setSyncing(sessionId) {
    await exec(`update local_registers set state = 'syncing', updated_at = ? where session_id = ?`, [new Date().toISOString(), sessionId]);
  },
  async markSynced(item, result, nowIso) {
    await getDb().transaction(async tx => {
      await tx.execute(
        `update local_registers set state = 'synced', base_version = ?, defaulted_students = ?, defaulted_ack = ?,
           last_error = null, reject_code = null, updated_at = ? where session_id = ?`,
        [
          result.register?.version ?? item.payload.base_version,
          JSON.stringify(result.defaulted_students ?? []),
          (result.defaulted_students ?? []).length === 0 ? 1 : 0,
          nowIso,
          item.session_id,
        ],
      );
      await tx.execute('delete from outbox where id = ?', [item.id]);
      await updateSessionAfterSync(tx, item.session_id, result);
    });
  },
  async markConflict(item, result, nowIso) {
    const copy = { version: result.register?.version ?? 0, records: result.records ?? [] };
    await getDb().transaction(async tx => {
      await tx.execute(`update local_registers set state = 'conflict', server_copy = ?, updated_at = ? where session_id = ?`, [JSON.stringify(copy), nowIso, item.session_id]);
      await tx.execute('delete from outbox where id = ?', [item.id]);
    });
  },
  async markRejected(item, code: RejectCode, message, nowIso) {
    await getDb().transaction(async tx => {
      await tx.execute(`update local_registers set state = 'rejected', reject_code = ?, last_error = ?, updated_at = ? where session_id = ?`, [code, message, nowIso, item.session_id]);
      await tx.execute('delete from outbox where id = ?', [item.id]);
    });
  },
  async reschedule(item, attempts, nextAttemptAtIso, error, nowIso) {
    await getDb().transaction(async tx => {
      await tx.execute('update outbox set attempts = ?, next_attempt_at = ?, last_error = ? where id = ?', [attempts, nextAttemptAtIso, error, item.id]);
      await tx.execute(`update local_registers set state = 'queued', last_error = ?, updated_at = ? where session_id = ?`, [error, nowIso, item.session_id]);
    });
  },
  async outboxCount() {
    const rows = await query<{ n: number }>('select count(*) as n from outbox');
    return Number(rows[0]?.n ?? 0);
  },
};
