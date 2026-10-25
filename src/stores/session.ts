// Session, capabilities and the active persona (§5).
import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { routeFor, rolesFromAccessToken, type Persona, type PersonaRoute } from '../lib/personas';
import { PREF, secureStore } from '../lib/storage';
import type { Capabilities } from '../types/database';

interface SessionState {
  status: 'loading' | 'signedOut' | 'signedIn';
  session: Session | null;
  caps: Capabilities | null;
  route: PersonaRoute | null;
  /** Shown once on the sign-in screen after a forced sign-out. */
  signOutReason: string | null;
  /** Parent: the child whose data every query is scoped to. */
  childId: string | null;
  setSession: (session: Session | null) => void;
  setCaps: (caps: Capabilities | null) => void;
  choosePersona: (p: Persona) => void;
  setChild: (id: string | null) => void;
  setSignOutReason: (reason: string | null) => void;
}

function rememberedPersona() {
  try {
    return secureStore().getString(PREF.persona);
  } catch {
    return undefined;
  }
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  session: null,
  caps: null,
  route: null,
  signOutReason: null,
  childId: null,
  setSession: session => {
    if (!session) {
      set({ status: 'signedOut', session: null, caps: null, route: null, childId: null });
      return;
    }
    const prev = get();
    const sameUser = prev.session?.user.id === session.user.id;
    const roles = sameUser && prev.caps ? prev.caps.roles : rolesFromAccessToken(session.access_token);
    set({
      status: 'signedIn',
      session,
      caps: sameUser ? prev.caps : null,
      route: sameUser && prev.route ? prev.route : routeFor(roles, rememberedPersona()),
      childId: sameUser ? prev.childId : secureStore().getString(PREF.selectedChild) ?? null,
    });
  },
  setCaps: caps => {
    const route = get().route;
    // Capabilities are authoritative for roles; only re-route if the current route is no longer valid.
    const next = caps ? routeFor(caps.roles, route === 'choose' || route === 'web' ? rememberedPersona() : route) : route;
    set({ caps, route: next });
  },
  choosePersona: p => {
    secureStore().set(PREF.persona, p);
    set({ route: p });
  },
  setChild: id => {
    if (id) {
      secureStore().set(PREF.selectedChild, id);
    } else {
      secureStore().remove(PREF.selectedChild);
    }
    set({ childId: id });
  },
  setSignOutReason: reason => set({ signOutReason: reason }),
}));

export const useUserId = () => useSession(s => s.session?.user.id ?? null);
