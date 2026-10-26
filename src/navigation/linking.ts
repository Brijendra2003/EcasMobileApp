// Deep links (§12): collegeapp:// for notification URLs, invite and reset links.
//  - set-password links carry auth tokens: they sign the user in through
//    Supabase's own flow (sessionFromAuthLink), then open SetPassword.
//  - Persona-prefixed links (collegeapp://parent/…) switch persona first when
//    the user has that persona.
//  - Unknown routes, or routes for a persona the user is not on, fall back to
//    the notification centre (allow-listed routes only, §15).
import { Alert, Linking } from 'react-native';
import {
  createNavigationContainerRef,
  getStateFromPath as defaultGetStateFromPath,
  type LinkingOptions,
} from '@react-navigation/native';
import { sessionFromAuthLink } from '../features/auth/api';
import { config } from '../lib/config';
import { errorMessage } from '../lib/errors';
import { personasFor, rolesFromAccessToken, type Persona } from '../lib/personas';
import { supabase } from '../lib/supabase';
import { useSession } from '../stores/session';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const PREFIX = `${config.scheme}://`;

type PersonaRoot = 'Professor' | 'Student' | 'Parent';
const ROOT: Record<Persona, PersonaRoot> = { professor: 'Professor', student: 'Student', parent: 'Parent' };
const TABS = { Professor: 'ProfTabs', Student: 'StuTabs', Parent: 'ParTabs' } as const;

const shared = { Notifications: 'notifications', Exams: 'exams', Calendar: 'calendar' } as const;

export const linkingConfig: NonNullable<LinkingOptions<RootStackParamList>['config']> = {
  screens: {
    SetPassword: 'set-password',
    Professor: {
      path: 'professor',
      initialRouteName: 'ProfTabs',
      screens: {
        ProfTabs: { screens: { ProfToday: 'today', ProfTimetable: 'timetable', ProfClasses: 'classes', ProfInbox: 'inbox', ProfMore: 'more' } },
        MarkAttendance: 'session/:sessionId/mark',
        Conflict: 'session/:sessionId/conflict',
        Register: 'session/:sessionId',
        ClassDetail: 'class/:groupId',
        LeaveApproval: 'leave/:leaveId',
        DisputeThread: 'dispute/:disputeId',
        StaffLeave: 'staff-leave',
        ...shared,
      },
    },
    Student: {
      path: 'student',
      initialRouteName: 'StuTabs',
      screens: {
        StuTabs: { screens: { StuHome: 'home', StuAttendance: 'attendance', StuTimetable: 'timetable', StuLeave: 'leave', StuMore: 'more' } },
        SubjectDetail: 'subject/:offeringId',
        LeaveDetail: 'leave/:leaveId',
        MyDisputes: 'disputes',
        ...shared,
      },
    },
    Parent: {
      path: 'parent',
      initialRouteName: 'ParTabs',
      screens: {
        ParTabs: {
          screens: {
            ParHome: 'home',
            ParAttendance: { path: 'attendance', alias: ['attendance/session/:sessionId'] },
            ParSchedule: 'schedule',
            ParNotices: 'notices',
            ParMore: 'more',
          },
        },
        SubjectDetail: 'subject/:offeringId',
        MyDisputes: 'questions',
        ...shared,
      },
    },
  },
};

function pathOf(url: string): string {
  return url.slice(PREFIX.length).replace(/^\/+/, '');
}

export function personaOfPath(path: string): Persona | null {
  const first = path.split(/[/?#]/)[0];
  return first === 'professor' || first === 'student' || first === 'parent' ? first : null;
}

function availablePersonas(): Persona[] {
  const s = useSession.getState();
  return personasFor(s.caps?.roles ?? rolesFromAccessToken(s.session?.access_token));
}

/** The persona tree the signed-in user is on, or null (signed out, picker, web-only). */
function currentRoot(): PersonaRoot | null {
  const s = useSession.getState();
  if (s.status !== 'signedIn' || !s.route || !(s.route in ROOT)) {
    return null;
  }
  return ROOT[s.route as Persona];
}

/** getStateFromPath with the allow-list fallback to the current persona's notification centre. */
export function resolveState(path: string, options?: Parameters<typeof defaultGetStateFromPath>[1]): ReturnType<typeof defaultGetStateFromPath> {
  const root = currentRoot();
  if (!root) {
    return undefined;
  }
  const state = defaultGetStateFromPath(path, options);
  if (state?.routes[0]?.name === root) {
    return state;
  }
  return { routes: [{ name: root, state: { routes: [{ name: TABS[root] }, { name: 'Notifications' }] } }] };
}

const nextTick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

async function whenNavigationReady(fn: () => void) {
  for (let i = 0; i < 30; i++) {
    if (navigationRef.isReady()) {
      fn();
      return;
    }
    await new Promise<void>(resolve => setTimeout(resolve, 100));
  }
}

/** Runs before a URL reaches the navigator. Returns the URL to open, or null when handled here. */
export async function prepareUrl(url: string): Promise<string | null> {
  if (!url.startsWith(PREFIX)) {
    return url;
  }
  const path = pathOf(url);
  if (path.startsWith('set-password')) {
    try {
      if (await sessionFromAuthLink(url)) {
        const { data } = await supabase.auth.getSession();
        useSession.getState().setSession(data.session);
        await nextTick();
        whenNavigationReady(() => navigationRef.navigate('SetPassword'));
      }
    } catch (e) {
      Alert.alert('Link not valid', errorMessage(e));
    }
    return null;
  }
  const persona = personaOfPath(path);
  const s = useSession.getState();
  if (persona && s.status === 'signedIn' && s.route !== persona && availablePersonas().includes(persona)) {
    s.choosePersona(persona);
    // Let the root navigator render the new persona tree before the link is applied.
    await nextTick();
  }
  return url;
}

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [PREFIX],
  config: linkingConfig,
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    return url ? prepareUrl(url) : null;
  },
  subscribe(listener) {
    const sub = Linking.addEventListener('url', ({ url }) => {
      prepareUrl(url)
        .then(next => {
          if (next) {
            listener(next);
          }
        })
        .catch(() => {});
    });
    return () => sub.remove();
  },
  getStateFromPath: resolveState,
};
