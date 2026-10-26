// Deep links (§12): allow-listed routes, persona switching, notification-centre fallback.
import type { Session } from '@supabase/supabase-js';
import { initStorage } from '../src/lib/storage';
import { linkingConfig, personaOfPath, prepareUrl, resolveState } from '../src/navigation/linking';
import { useSession } from '../src/stores/session';
import type { Capabilities } from '../src/types/database';

function signIn(route: 'professor' | 'student' | 'parent', roles: string[]) {
  useSession.setState({
    status: 'signedIn',
    session: { user: { id: 'u1' }, access_token: 'x.e30.y' } as unknown as Session,
    caps: { roles } as Capabilities,
    route,
  });
}

/** Route names from the root down the focused branch. */
function branch(state: ReturnType<typeof resolveState>): string[] {
  const names: string[] = [];
  let s = state as { routes: { name: string; params?: object; state?: unknown }[]; index?: number } | undefined;
  while (s) {
    const r = s.routes[s.index ?? s.routes.length - 1];
    names.push(r.name);
    s = r.state as typeof s;
  }
  return names;
}

function leafParams(state: ReturnType<typeof resolveState>) {
  let s = state as { routes: { params?: object; state?: unknown }[]; index?: number } | undefined;
  let params: object | undefined;
  while (s) {
    const r = s.routes[s.index ?? s.routes.length - 1];
    params = r.params;
    s = r.state as typeof s;
  }
  return params;
}

beforeAll(async () => {
  await initStorage();
});

beforeEach(() => {
  useSession.setState({ status: 'signedOut', session: null, caps: null, route: null, childId: null });
});

describe('resolveState', () => {
  it('ignores links while signed out', () => {
    expect(resolveState('professor/today', linkingConfig)).toBeUndefined();
  });

  it('opens a professor screen with the tabs underneath', () => {
    signIn('professor', ['professor']);
    const state = resolveState('professor/session/s1/mark', linkingConfig);
    expect(branch(state)).toEqual(['Professor', 'MarkAttendance']);
    expect((state?.routes[0].state as { routes: { name: string }[] }).routes.map(r => r.name)).toEqual(['ProfTabs', 'MarkAttendance']);
    expect(leafParams(state)).toEqual({ sessionId: 's1' });
  });

  it('parses the parent absence link from the push payload', () => {
    signIn('parent', ['parent']);
    const state = resolveState('parent/attendance/session/9f1c', linkingConfig);
    expect(branch(state)).toEqual(['Parent', 'ParTabs', 'ParAttendance']);
    expect(leafParams(state)).toEqual({ sessionId: '9f1c' });
  });

  it('falls back to the notification centre for unknown routes', () => {
    signIn('student', ['student']);
    expect(branch(resolveState('nonsense/route', linkingConfig))).toEqual(['Student', 'Notifications']);
    expect(branch(resolveState('notifications', linkingConfig))).toEqual(['Student', 'Notifications']);
  });

  it("falls back for another persona's route", () => {
    signIn('professor', ['professor']);
    expect(branch(resolveState('parent/home', linkingConfig))).toEqual(['Professor', 'Notifications']);
  });
});

describe('prepareUrl', () => {
  it('switches persona first for a persona-prefixed link the user holds', async () => {
    signIn('professor', ['professor', 'parent']);
    await expect(prepareUrl('collegeapp://parent/home')).resolves.toBe('collegeapp://parent/home');
    expect(useSession.getState().route).toBe('parent');
  });

  it('does not switch to a persona the user does not have', async () => {
    signIn('professor', ['professor']);
    await prepareUrl('collegeapp://parent/home');
    expect(useSession.getState().route).toBe('professor');
  });

  it('reads the persona from the first path segment', () => {
    expect(personaOfPath('student/leave/1')).toBe('student');
    expect(personaOfPath('set-password')).toBeNull();
  });
});
