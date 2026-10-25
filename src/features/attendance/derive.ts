// Instant previews from the shared attendance maths (§2): the server owns the
// numbers; these only explain them ("attend 4 more lectures to reach 75%").
import { attendancePercent, isRecoverable, sessionsNeeded, standing, type Standing } from '../../shared/attendance';
import type { SummaryRow } from '../../types/database';

export const COMPONENT_LABEL = { TH: 'Theory', PR: 'Practical', TUT: 'Tutorial' } as const;

export interface Totals {
  held: number;
  attended: number;
  percent: number | null;
}

function total(rows: SummaryRow[]): Totals {
  const held = rows.reduce((a, r) => a + Number(r.held), 0);
  const attended = rows.reduce((a, r) => a + Number(r.attended), 0);
  return { held, attended, percent: attendancePercent({ held, attended }) };
}

/** Rows of the active term (or the newest term when none is active). */
export function currentTerm(rows: SummaryRow[]): SummaryRow[] {
  const active = rows.filter(r => r.term_status === 'active');
  if (active.length > 0 || rows.length === 0) {
    return active;
  }
  const newest = rows.reduce((a, r) => (r.term_label > a ? r.term_label : a), rows[0].term_label);
  return rows.filter(r => r.term_label === newest);
}

export function overview(rows: SummaryRow[]) {
  return {
    overall: total(rows),
    theory: total(rows.filter(r => r.component !== 'PR')),
    practical: total(rows.filter(r => r.component === 'PR')),
    min: rows[0]?.min_percent ?? 75,
    warn: rows[0]?.warn_percent ?? 80,
  };
}

export interface ShortageNote {
  row: SummaryRow;
  standing: Standing;
  /** Sessions in a row needed to reach the minimum; null when it cannot be reached this term. */
  needed: number | null;
}

export function shortageNotes(rows: SummaryRow[]): ShortageNote[] {
  const out: ShortageNote[] = [];
  for (const row of rows) {
    const s = standing(row.percent === null ? null : Number(row.percent), Number(row.min_percent), Number(row.warn_percent));
    if (s !== 'shortage' && s !== 'warning') {
      continue;
    }
    const tally = { held: Number(row.held), attended: Number(row.attended) };
    const min = Number(row.min_percent);
    out.push({
      row,
      standing: s,
      needed: isRecoverable(tally, min, Number(row.remaining)) ? sessionsNeeded(tally, min) : null,
    });
  }
  return out.sort((a, b) => (a.standing === b.standing ? Number(a.row.percent) - Number(b.row.percent) : a.standing === 'shortage' ? -1 : 1));
}

export function shortageMessage(n: ShortageNote): string {
  const subject = `${n.row.subject_name} (${COMPONENT_LABEL[n.row.component]})`;
  const min = Number(n.row.min_percent);
  if (n.standing === 'warning') {
    return `${subject} is at ${Number(n.row.percent).toFixed(0)}%, close to the ${min}% limit.`;
  }
  if (n.needed === null) {
    return `Cannot reach ${min}% this term in ${subject}.`;
  }
  return `Below ${min}% in ${subject}. Attend the next ${n.needed} ${n.needed === 1 ? 'lecture' : 'lectures'} to recover.`;
}

/** Running percentage after each session, oldest first (trend chart). */
export function trend(sessions: { session_date: string; status: string }[], countsInHeld: Set<string>, countsAttended: Set<string>) {
  let held = 0;
  let attended = 0;
  return sessions
    .slice()
    .sort((a, b) => (a.session_date < b.session_date ? -1 : 1))
    .map(s => {
      if (countsInHeld.has(s.status)) {
        held++;
        if (countsAttended.has(s.status)) {
          attended++;
        }
      }
      return { date: s.session_date, percent: attendancePercent({ held, attended }) };
    });
}
