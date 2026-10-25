// Offline model (§9.2). Shared by the SQLite repository, the sync engine and its tests.
import type { MySessionRow, SubmitResult } from '../types/database';

export type LocalRegisterState = 'draft' | 'queued' | 'syncing' | 'synced' | 'conflict' | 'rejected';

/** Why the server refused a submission (state = rejected). */
export type RejectCode =
  | 'locked'
  | 'cancelled'
  | 'ATT_NOT_ASSIGNED'
  | 'ATT_UNKNOWN_STUDENT'
  | 'ATT_INVALID_STATUS'
  | 'ACCOUNT_INACTIVE'
  | 'NOT_FOUND'
  | string;

export interface LocalRegister {
  session_id: string;
  state: LocalRegisterState;
  /** Set when Submit is tapped, reused on every retry (rule 1). */
  client_submission_id: string | null;
  /** Server version this draft started from (rule 2). */
  base_version: number;
  /** Students the server defaulted (roster drift, rule 6). */
  defaulted_students: { student_id: string; status: string }[] | null;
  defaulted_ack: boolean;
  /** Server copy of the register on a conflict. */
  server_copy: { version: number; records: { student_id: string; status: string }[] } | null;
  reject_code: RejectCode | null;
  last_error: string | null;
  updated_at: string;
}

export interface SubmitRecord {
  student_id: string;
  status: string;
  marked_at: string;
}

export interface SubmitPayload {
  session_id: string;
  client_submission_id: string;
  base_version: number;
  records: SubmitRecord[];
  client_marked_at: string;
  device_id: string;
}

export interface OutboxItem {
  id: number;
  kind: 'submit_attendance';
  session_id: string;
  client_submission_id: string;
  payload: SubmitPayload;
  attempts: number;
  next_attempt_at: string;
  created_at: string;
}

/** What the sync engine needs from storage. SQLite in the app, in-memory in tests. */
export interface SyncStore {
  /** App killed mid-sync: anything left `syncing` goes back to `queued`. */
  resetInterrupted(): Promise<void>;
  /** FIFO: due outbox items in insertion order. */
  dueItems(nowIso: string): Promise<OutboxItem[]>;
  /** "Sync now": make every item due immediately. */
  resetBackoff(nowIso: string): Promise<void>;
  setSyncing(sessionId: string): Promise<void>;
  /** ok / duplicate: register synced at the server version. Removes the outbox item. */
  markSynced(item: OutboxItem, result: SubmitResult, nowIso: string): Promise<void>;
  /** conflict: keep local marks, store the server copy. Removes the outbox item. */
  markConflict(item: OutboxItem, result: SubmitResult, nowIso: string): Promise<void>;
  /** locked / cancelled / permanent error. Removes the outbox item; marks stay for a correction request. */
  markRejected(item: OutboxItem, code: RejectCode, message: string | null, nowIso: string): Promise<void>;
  /** Transient failure: stay queued, try again at `nextAttemptAt`. */
  reschedule(item: OutboxItem, attempts: number, nextAttemptAtIso: string, error: string, nowIso: string): Promise<void>;
  outboxCount(): Promise<number>;
}

export type SubmitFn = (payload: SubmitPayload) => Promise<SubmitResult>;

export type { MySessionRow };
