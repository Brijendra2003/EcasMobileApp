// Marking rules (§8.2), pure so they are unit-tested.
//
// A student's mark is null until the professor sets one. Students on approved
// leave show the server's suggestion (L) while unmarked; L is never sent,
// because the server pre-fills it again from the leave (it is not a status a
// professor may set). Anything still unmarked on submit gets the policy's
// default status on the server and comes back in `defaulted_students`.
import type { SubmitRecord } from '../../offline/types';

export interface RosterEntry {
  student_id: string;
  roll_no: number | null;
  name: string;
  suggested_status: string | null;
}

export type Marks = Record<string, string | null>;

export function displayStatus(mark: string | null | undefined, suggested: string | null | undefined): string | null {
  return mark ?? suggested ?? null;
}

/** Tap toggles P ⇄ A; an unmarked or on-leave student becomes P (§8.2). */
export function toggled(current: string | null): string {
  return current === 'P' ? 'A' : 'P';
}

export interface Counts {
  P: number;
  A: number;
  L: number;
  other: number;
  pending: number;
}

export function countMarks(roster: RosterEntry[], marks: Marks): Counts {
  const c: Counts = { P: 0, A: 0, L: 0, other: 0, pending: 0 };
  for (const s of roster) {
    const d = displayStatus(marks[s.student_id], s.suggested_status);
    if (d === null) {
      c.pending++;
    } else if (d === 'P' || d === 'A' || d === 'L') {
      c[d]++;
    } else {
      c.other++;
    }
  }
  return c;
}

/** Bulk action: applies `status` to everyone still pending (never overrides a tap or a leave hint). */
export function bulkMarks(roster: RosterEntry[], marks: Marks, status: string): Marks {
  const out: Marks = {};
  for (const s of roster) {
    if (displayStatus(marks[s.student_id], s.suggested_status) === null) {
      out[s.student_id] = status;
    }
  }
  return out;
}

export function absentRolls(roster: RosterEntry[], marks: Marks): string[] {
  return roster
    .filter(s => displayStatus(marks[s.student_id], s.suggested_status) === 'A')
    .map(s => (s.roll_no === null ? s.name : String(s.roll_no)));
}

/** Records sent to submit_attendance: explicit marks the professor may set. */
export function submitRecords(roster: RosterEntry[], marks: Marks, settable: Set<string>, markedAt: string): SubmitRecord[] {
  const onRoster = new Set(roster.map(r => r.student_id));
  return Object.entries(marks)
    .filter(([id, status]) => onRoster.has(id) && status !== null && settable.has(status))
    .map(([student_id, status]) => ({ student_id, status: status as string, marked_at: markedAt }));
}

/** Differences between local marks and the server copy (conflict screen, correction requests). */
export function diffMarks(local: Marks, server: { student_id: string; status: string }[]) {
  const serverMap = new Map(server.map(r => [r.student_id, r.status]));
  const out: { student_id: string; server: string | null; local: string }[] = [];
  for (const [id, status] of Object.entries(local)) {
    if (status !== null && serverMap.get(id) !== status) {
      out.push({ student_id: id, server: serverMap.get(id) ?? null, local: status });
    }
  }
  return out;
}

/** Roll-number search: index of the first student whose roll number starts with the query. */
export function findRoll(roster: RosterEntry[], q: string): number {
  const query = q.trim();
  if (!query) {
    return -1;
  }
  const exact = roster.findIndex(s => String(s.roll_no) === query);
  if (exact >= 0) {
    return exact;
  }
  const lower = query.toLowerCase();
  return roster.findIndex(s => String(s.roll_no ?? '').startsWith(query) || s.name.toLowerCase().includes(lower));
}
