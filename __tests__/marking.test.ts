import { absentRolls, bulkMarks, countMarks, diffMarks, displayStatus, findRoll, submitRecords, toggled, type RosterEntry } from '../src/features/marking/logic';

const roster: RosterEntry[] = [
  { student_id: 'a', roll_no: 1, name: 'Aarav Patil', suggested_status: null },
  { student_id: 'b', roll_no: 2, name: 'Bhavna Shah', suggested_status: 'L' },
  { student_id: 'c', roll_no: 3, name: 'Chirag Rao', suggested_status: null },
  { student_id: 'd', roll_no: 23, name: 'Diya Nair', suggested_status: null },
];
const SETTABLE = new Set(['P', 'A', 'OD']);

describe('marking rules', () => {
  it('starts everyone Pending except approved leave, which shows L', () => {
    expect(countMarks(roster, {})).toEqual({ P: 0, A: 0, L: 1, other: 0, pending: 3 });
    expect(displayStatus(undefined, 'L')).toBe('L');
  });

  it('toggles P ⇄ A and turns pending or leave into P', () => {
    expect(toggled(null)).toBe('P');
    expect(toggled('P')).toBe('A');
    expect(toggled('A')).toBe('P');
    expect(toggled('L')).toBe('P');
  });

  it('bulk-marks only students still pending', () => {
    const marks = { c: 'A' };
    expect(bulkMarks(roster, marks, 'P')).toEqual({ a: 'P', d: 'P' });
  });

  it('counts and lists absentees after "all present, tap absentees"', () => {
    const marks = { ...bulkMarks(roster, {}, 'P'), d: 'A' };
    expect(countMarks(roster, marks)).toEqual({ P: 2, A: 1, L: 1, other: 0, pending: 0 });
    expect(absentRolls(roster, marks)).toEqual(['23']);
  });

  it('sends only explicit, settable marks (never the leave hint)', () => {
    const marks = { a: 'P', b: null, c: 'OD', d: 'L', ghost: 'P' };
    expect(submitRecords(roster, marks, SETTABLE, 't')).toEqual([
      { student_id: 'a', status: 'P', marked_at: 't' },
      { student_id: 'c', status: 'OD', marked_at: 't' },
    ]);
  });

  it('a leave student marked present is sent as P', () => {
    expect(submitRecords(roster, { b: 'P' }, SETTABLE, 't')).toEqual([{ student_id: 'b', status: 'P', marked_at: 't' }]);
  });

  it('diffs local marks against the server copy', () => {
    expect(diffMarks({ a: 'P', c: 'A', d: null }, [{ student_id: 'a', status: 'P' }, { student_id: 'c', status: 'P' }])).toEqual([
      { student_id: 'c', server: 'P', local: 'A' },
    ]);
  });

  it('finds a roll number, exact match first', () => {
    expect(findRoll(roster, '2')).toBe(1);
    expect(findRoll(roster, '23')).toBe(3);
    expect(findRoll(roster, 'chir')).toBe(2);
    expect(findRoll(roster, '')).toBe(-1);
  });
});
