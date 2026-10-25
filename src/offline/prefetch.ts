// Prefetch (§9.4): the professor's sessions in today − 2 … today + 7 and their
// rosters (with leave hints) go into SQLite so marking works offline.
import { addDays, istDate } from '../shared/dates';
import { unwrap } from '../lib/errors';
import { PREF, secureStore } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { useSyncStatus } from '../stores/sync';
import type { MySessionRow, RosterRow } from '../types/database';
import { purgeBefore, replaceRoster, replaceSessionWindow, upsertSession } from './repo';

export const WINDOW_BEFORE = 2;
export const WINDOW_AFTER = 7;
const STALE_MS = 60 * 60_000;

let inFlight: Promise<void> | null = null;

export function prefetchWindow(): Promise<void> {
  inFlight ??= (async () => {
    const today = istDate();
    const from = addDays(today, -WINDOW_BEFORE);
    const to = addDays(today, WINDOW_AFTER);
    const [sessions, rosters] = await Promise.all([
      supabase.from('v_my_sessions').select('*').gte('session_date', from).lte('session_date', to).order('starts_at').then(unwrap),
      supabase.rpc('my_rosters_for_window', { p_from: from, p_to: to }).then(unwrap),
    ]);
    await replaceSessionWindow(from, to, (sessions ?? []) as MySessionRow[], (rosters ?? []) as RosterRow[]);
    await purgeBefore(addDays(today, -14));
    const at = new Date().toISOString();
    secureStore().set(PREF.lastPrefetchAt, at);
    useSyncStatus.getState().set({ lastPrefetchAt: at });
    useSyncStatus.getState().bump();
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** Foreground rule: refresh when the last prefetch is more than an hour old. */
export function prefetchIfStale(): Promise<void> {
  const last = secureStore().getString(PREF.lastPrefetchAt);
  if (last && Date.now() - new Date(last).getTime() < STALE_MS) {
    return Promise.resolve();
  }
  return prefetchWindow();
}

/** Live pre-check before marking (§8.2): refresh one session and its roster when online. */
export async function refreshSession(sessionId: string): Promise<MySessionRow | null> {
  const [session, roster] = await Promise.all([
    supabase.from('v_my_sessions').select('*').eq('id', sessionId).maybeSingle().then(unwrap),
    supabase.rpc('session_roster_for_marking', { p_session: sessionId }).then(unwrap),
  ]);
  if (session) {
    await upsertSession(session as MySessionRow);
  }
  if (roster) {
    await replaceRoster(sessionId, roster as RosterRow[]);
  }
  useSyncStatus.getState().bump();
  return (session as MySessionRow) ?? null;
}
