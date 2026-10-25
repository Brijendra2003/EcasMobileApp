import { currentTerm, overview, shortageMessage, shortageNotes, trend } from '../src/features/attendance/derive';
import type { SummaryRow } from '../src/types/database';

function row(p: Partial<SummaryRow>): SummaryRow {
  return {
    student_id: 's',
    offering_id: 'o',
    term_id: 't',
    term_label: 'Odd 2026',
    term_status: 'active',
    subject_code: 'CSC501',
    subject_name: 'DBMS',
    component: 'TH',
    held: 20,
    attended: 18,
    excused: 0,
    percent: 90,
    updated_at: '',
    absent: 2,
    remaining: 10,
    min_percent: 75,
    warn_percent: 80,
    ...p,
  };
}

describe('attendance previews', () => {
  it('totals overall, theory and practical', () => {
    const o = overview([row({}), row({ component: 'PR', held: 10, attended: 5, percent: 50 })]);
    expect(o.overall).toEqual({ held: 30, attended: 23, percent: 76.67 });
    expect(o.theory.percent).toBe(90);
    expect(o.practical.percent).toBe(50);
  });

  it('explains how many lectures recover a shortage', () => {
    // 14/20 = 70%: (75·20 − 100·14) / 25 = 4
    const [n] = shortageNotes([row({ attended: 14, percent: 70 })]);
    expect(n.needed).toBe(4);
    expect(shortageMessage(n)).toBe('Below 75% in DBMS (Theory). Attend the next 4 lectures to recover.');
  });

  it('says when the minimum is out of reach this term', () => {
    const [n] = shortageNotes([row({ attended: 5, percent: 25, remaining: 3 })]);
    expect(n.needed).toBeNull();
    expect(shortageMessage(n)).toBe('Cannot reach 75% this term in DBMS (Theory).');
  });

  it('warns when close to the limit and sorts shortages first', () => {
    const notes = shortageNotes([row({ attended: 16, percent: 78, subject_name: 'OS' }), row({ attended: 14, percent: 70 }), row({})]);
    expect(notes.map(n => n.standing)).toEqual(['shortage', 'warning']);
  });

  it('keeps only the active term', () => {
    expect(currentTerm([row({}), row({ term_status: 'archived', term_label: 'Even 2026' })])).toHaveLength(1);
  });

  it('builds a running trend', () => {
    const t = trend(
      [
        { session_date: '2026-10-02', status: 'A' },
        { session_date: '2026-10-01', status: 'P' },
        { session_date: '2026-10-03', status: 'EX' },
      ],
      new Set(['P', 'A']),
      new Set(['P']),
    );
    expect(t.map(x => x.percent)).toEqual([100, 50, 50]);
  });
});
