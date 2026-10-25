// One status per session card (§8.1), from the server row and the local register.
import type { LocalRegister } from '../../offline/types';
import type { MySessionRow } from '../../types/database';

export type CardStatus =
  | 'upcoming'
  | 'markNow'
  | 'submitted'
  | 'waiting'
  | 'attention'
  | 'cancelled'
  | 'rescheduled'
  | 'missed';

export type AttentionReason = 'conflict' | 'rejected' | 'defaulted';

export interface CardState {
  status: CardStatus;
  reason?: AttentionReason;
  /** A local draft exists (shows "Draft saved"). */
  draft: boolean;
  substitute: boolean;
}

const t = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : NaN);

/** Inside the edit window after a submission, or a reopened register. */
export function canEdit(s: MySessionRow, now: Date): boolean {
  if (s.register_state === 'reopened') {
    return !s.reopen_until || t(s.reopen_until) > now.getTime();
  }
  return s.register_state === 'submitted' && !!s.edit_until && t(s.edit_until) > now.getTime();
}

/** Whether the marking screen may be opened for a fresh or resumed draft. */
export function canMark(s: MySessionRow, now: Date): boolean {
  if (s.status === 'cancelled' || s.status === 'rescheduled') {
    return false;
  }
  if (now.getTime() < t(s.marking_opens_at)) {
    return false;
  }
  if (s.register_state === 'pending' || s.register_state === null) {
    return true;
  }
  return canEdit(s, now);
}

export function cardState(s: MySessionRow, local: LocalRegister | undefined, now: Date): CardState {
  const base = { draft: local?.state === 'draft', substitute: s.my_role === 'substitute' || !!s.substitute_name };
  if (s.status === 'cancelled') {
    return { ...base, status: 'cancelled' };
  }
  if (s.status === 'rescheduled') {
    return { ...base, status: 'rescheduled' };
  }
  if (local?.state === 'queued' || local?.state === 'syncing') {
    return { ...base, status: 'waiting' };
  }
  if (local?.state === 'conflict') {
    return { ...base, status: 'attention', reason: 'conflict' };
  }
  if (local?.state === 'rejected') {
    return { ...base, status: 'attention', reason: 'rejected' };
  }
  if (local?.state === 'synced' && (local.defaulted_students?.length ?? 0) > 0 && !local.defaulted_ack) {
    return { ...base, status: 'attention', reason: 'defaulted' };
  }
  if (s.register_state === 'reopened' && canEdit(s, now)) {
    return { ...base, status: 'markNow' };
  }
  if (s.submitted_at && (s.register_state === 'submitted' || s.register_state === 'locked' || s.register_state === 'reopened')) {
    return { ...base, status: 'submitted' };
  }
  if (s.register_state === 'locked' || s.register_state === 'voided') {
    return { ...base, status: 'missed' };
  }
  if (now.getTime() < t(s.marking_opens_at) && !base.draft) {
    return { ...base, status: 'upcoming' };
  }
  return { ...base, status: 'markNow' };
}

/** Summary strip (§8.1): registers still to submit today, and overdue ones from earlier days. */
export function pendingCounts(rows: { session: MySessionRow; state: CardState }[], today: string, now: Date) {
  let today_ = 0;
  let overdue = 0;
  for (const { session, state } of rows) {
    const due = state.status === 'markNow' || state.status === 'attention' || state.status === 'missed';
    if (!due) {
      continue;
    }
    if (session.session_date === today && t(session.starts_at) <= now.getTime()) {
      today_++;
    } else if (session.session_date < today) {
      overdue++;
    }
  }
  return { today: today_, overdue };
}
