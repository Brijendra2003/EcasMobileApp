// Wires the sync engine to Supabase and to its triggers (§9.3): coming online,
// foreground, a timer for backoff retries while the app is open, and "Sync now".
import { AppState } from 'react-native';
import { unwrap } from '../lib/errors';
import { queryClient } from '../lib/query-client';
import { supabase } from '../lib/supabase';
import { useSyncStatus } from '../stores/sync';
import type { SubmitResult } from '../types/database';
import { unsyncedCount, sqliteSyncStore } from './repo';
import { createSyncEngine, type SyncReport } from './sync';
import type { SubmitPayload } from './types';

async function submit(p: SubmitPayload): Promise<SubmitResult> {
  const data = await supabase
    .rpc('submit_attendance', {
      p_session_id: p.session_id,
      p_client_submission_id: p.client_submission_id,
      p_base_version: p.base_version,
      p_records: p.records.map(r => ({ student_id: r.student_id, status: r.status, marked_at: r.marked_at })),
      p_client_marked_at: p.client_marked_at,
      p_device_id: p.device_id,
    })
    .then(unwrap);
  return data as unknown as SubmitResult;
}

async function refreshCounts() {
  const pending = await unsyncedCount();
  useSyncStatus.getState().set({ pending });
  useSyncStatus.getState().bump();
}

export const syncEngine = createSyncEngine({
  store: sqliteSyncStore,
  submit,
  onChange: () => {
    refreshCounts().catch(() => {});
  },
});

export async function syncNow(force = false): Promise<SyncReport | null> {
  if (!useSyncStatus.getState().online) {
    await refreshCounts();
    return null;
  }
  useSyncStatus.getState().set({ running: true });
  try {
    const report = await syncEngine.run({ force });
    if (report.synced > 0) {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['register'] });
    }
    useSyncStatus.getState().set({ lastSyncAt: new Date().toISOString() });
    return report;
  } finally {
    useSyncStatus.getState().set({ running: false });
    await refreshCounts();
  }
}

let started = false;
let timer: ReturnType<typeof setInterval> | null = null;

/** Starts the triggers once per signed-in professor session. Returns a stop function. */
export function startSyncTriggers(): () => void {
  if (started) {
    return () => {};
  }
  started = true;
  const unsubNet = useSyncStatus.subscribe((s, prev) => {
    if (s.online && !prev.online) {
      syncNow().catch(() => {});
    }
  });
  const appSub = AppState.addEventListener('change', s => {
    if (s === 'active') {
      syncNow().catch(() => {});
    }
  });
  // Backoff retries while the app is open (the OS background task is best effort).
  timer = setInterval(() => {
    if (AppState.currentState === 'active') {
      syncNow().catch(() => {});
    }
  }, 15_000);
  syncNow().catch(() => {});
  return () => {
    unsubNet();
    appSub.remove();
    if (timer) {
      clearInterval(timer);
    }
    timer = null;
    started = false;
  };
}
