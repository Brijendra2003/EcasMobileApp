import { canEdit, canMark, cardState, pendingCounts } from '../src/features/professor/sessionState';
import type { LocalRegister } from '../src/offline/types';
import type { MySessionRow } from '../src/types/database';

const NOW = new Date('2026-10-26T05:00:00.000Z'); // 10:30 IST

function session(p: Partial<MySessionRow> = {}): MySessionRow {
  return {
    id: 's1',
    session_date: '2026-10-26',
    starts_at: '2026-10-26T04:30:00.000Z',
    ends_at: '2026-10-26T05:30:00.000Z',
    start_time: '10:00',
    end_time: '11:00',
    component: 'TH',
    session_type: 'theory',
    room_label: '301',
    status: 'scheduled',
    cancel_reason: null,
    rescheduled_from_id: null,
    rescheduled_to_id: null,
    subject_code: 'CSC501',
    subject_name: 'DBMS',
    offering_id: 'o1',
    teaching_group_id: 'g1',
    term_id: 't1',
    department_id: 'd1',
    group_label: 'TE COMP-A',
    my_role: 'primary',
    substitute_name: null,
    register_state: 'pending',
    register_version: 0,
    submitted_at: null,
    locked_at: null,
    reopen_until: null,
    present_count: 0,
    total_count: 0,
    is_late: false,
    marking_opens_at: '2026-10-26T04:15:00.000Z',
    edit_until: null,
    locks_at: '2026-10-28T05:30:00.000Z',
    default_unmarked_status: 'A',
    ...p,
  };
}

function local(p: Partial<LocalRegister>): LocalRegister {
  return {
    session_id: 's1',
    state: 'draft',
    client_submission_id: null,
    base_version: 0,
    defaulted_students: null,
    defaulted_ack: false,
    server_copy: null,
    reject_code: null,
    last_error: null,
    updated_at: NOW.toISOString(),
    ...p,
  };
}

describe('session card status', () => {
  it('is upcoming before marking opens', () => {
    const s = session({ starts_at: '2026-10-26T06:30:00.000Z', marking_opens_at: '2026-10-26T06:15:00.000Z' });
    expect(cardState(s, undefined, NOW).status).toBe('upcoming');
    expect(canMark(s, NOW)).toBe(false);
  });

  it('is "mark now" once marking opens', () => {
    expect(cardState(session(), undefined, NOW).status).toBe('markNow');
    expect(canMark(session(), NOW)).toBe(true);
  });

  it('shows waiting to sync while queued', () => {
    expect(cardState(session(), local({ state: 'queued' }), NOW).status).toBe('waiting');
  });

  it.each([
    ['conflict', 'conflict'],
    ['rejected', 'rejected'],
  ] as const)('needs attention on %s', (state, reason) => {
    expect(cardState(session(), local({ state }), NOW)).toMatchObject({ status: 'attention', reason });
  });

  it('needs attention when the server defaulted students until acknowledged', () => {
    const synced = session({ register_state: 'submitted', submitted_at: NOW.toISOString() });
    const defaulted = local({ state: 'synced', defaulted_students: [{ student_id: 'x', status: 'A' }] });
    expect(cardState(synced, defaulted, NOW)).toMatchObject({ status: 'attention', reason: 'defaulted' });
    expect(cardState(synced, { ...defaulted, defaulted_ack: true }, NOW).status).toBe('submitted');
  });

  it('shows cancelled and rescheduled sessions', () => {
    expect(cardState(session({ status: 'cancelled' }), undefined, NOW).status).toBe('cancelled');
    expect(cardState(session({ status: 'rescheduled' }), undefined, NOW).status).toBe('rescheduled');
  });

  it('is missed when the register locked without a submission', () => {
    expect(cardState(session({ register_state: 'locked' }), undefined, NOW).status).toBe('missed');
  });

  it('flags substitute sessions', () => {
    expect(cardState(session({ my_role: 'substitute' }), undefined, NOW).substitute).toBe(true);
  });

  it('allows edits only inside the edit window', () => {
    const submitted = session({ register_state: 'submitted', submitted_at: '2026-10-26T04:40:00.000Z', edit_until: '2026-10-27T04:40:00.000Z' });
    expect(canEdit(submitted, NOW)).toBe(true);
    expect(canEdit({ ...submitted, edit_until: '2026-10-26T04:50:00.000Z' }, NOW)).toBe(false);
    expect(canEdit(session({ register_state: 'locked', submitted_at: 'x' }), NOW)).toBe(false);
  });

  it('counts pending today and overdue', () => {
    const rows = [
      session({ id: 'a' }),
      session({ id: 'b', session_date: '2026-10-24' }),
      session({ id: 'c', session_date: '2026-10-24', register_state: 'submitted', submitted_at: 'x' }),
      session({ id: 'd', starts_at: '2026-10-26T08:00:00.000Z', marking_opens_at: '2026-10-26T07:45:00.000Z' }),
    ].map(s => ({ session: s, state: cardState(s, undefined, NOW) }));
    expect(pendingCounts(rows, '2026-10-26', NOW)).toEqual({ today: 1, overdue: 1 });
  });
});
