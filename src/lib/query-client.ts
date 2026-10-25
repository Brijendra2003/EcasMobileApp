// TanStack Query (§7.1): server state, persisted to encrypted MMKV so the app
// opens instantly with the last data. Query keys always include the scope
// (staff, student or child id), so switching persona or child never shows
// someone else's cache.
import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import DeviceInfo from 'react-native-device-info';
import { isNetworkError } from './errors';
import { secureStore } from './storage';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Stale times from §7.2. */
export const STALE = {
  sessions: 15 * MINUTE,
  roster: 12 * HOUR,
  summaries: 5 * MINUTE,
  timetable: 12 * HOUR,
  notices: MINUTE,
  profile: 24 * HOUR,
} as const;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE.summaries,
      gcTime: 7 * 24 * HOUR,
      retry: (count, error) => isNetworkError(error) && count < 2,
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'online',
      retry: false,
    },
  },
});

export function createPersistOptions(): Omit<PersistQueryClientOptions, 'queryClient'> {
  const store = secureStore();
  const persister = createSyncStoragePersister({
    key: 'ecas.query-cache',
    storage: {
      getItem: k => store.getString(k) ?? null,
      setItem: (k, v) => store.set(k, v),
      removeItem: k => {
        store.remove(k);
      },
    },
    throttleTime: 2000,
  });
  return {
    persister,
    maxAge: 7 * 24 * HOUR,
    // A new app build drops the cache, so changed response shapes never crash old caches.
    buster: DeviceInfo.getVersion(),
    dehydrateOptions: {
      shouldDehydrateQuery: q => q.state.status === 'success' && q.queryKey[0] !== 'local',
    },
  };
}

/** Query-key roots used for push-driven invalidation (§7.1, §12). */
export const INVALIDATE_ROOTS = ['attendance', 'timetable', 'leave', 'notices', 'notifications', 'exams', 'sessions', 'inbox'] as const;

export function invalidateFromPush(invalidate: string | undefined) {
  if (!invalidate) {
    return;
  }
  for (const root of invalidate.split(',').map(s => s.trim()).filter(Boolean)) {
    queryClient.invalidateQueries({ queryKey: [root] });
  }
}
