// Which screen a session opens (§8.2 pre-checks, from the card's status).
import type { LocalRegister } from '../../offline/types';
import type { MySessionRow } from '../../types/database';
import { cardState } from './sessionState';

export type SessionTarget =
  | { screen: 'MarkAttendance' }
  | { screen: 'Register' }
  | { screen: 'Conflict' }
  | { screen: 'notice'; title: string; body: string; nextSessionId?: string };

export function sessionTarget(session: MySessionRow, local: LocalRegister | undefined, now = new Date()): SessionTarget {
  const state = cardState(session, local, now);
  if (state.status === 'cancelled') {
    return { screen: 'notice', title: 'Session cancelled', body: session.cancel_reason ?? 'This session was cancelled.' };
  }
  if (state.status === 'rescheduled') {
    return {
      screen: 'notice',
      title: 'Session rescheduled',
      body: 'This session was moved to another time.',
      nextSessionId: session.rescheduled_to_id ?? undefined,
    };
  }
  if (state.status === 'attention' && state.reason === 'conflict') {
    return { screen: 'Conflict' };
  }
  if (state.status === 'attention' || state.status === 'submitted' || state.status === 'missed') {
    return { screen: 'Register' };
  }
  return { screen: 'MarkAttendance' };
}
