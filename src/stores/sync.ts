import { create } from 'zustand';

interface SyncStatus {
  online: boolean;
  /** Registers waiting to sync (Today tab badge, rule 7). */
  pending: number;
  running: boolean;
  lastSyncAt: string | null;
  lastPrefetchAt: string | null;
  /** Bumped after any local register change so SQLite-backed queries refresh. */
  revision: number;
  set: (patch: Partial<Omit<SyncStatus, 'set' | 'bump'>>) => void;
  bump: () => void;
}

export const useSyncStatus = create<SyncStatus>(set => ({
  online: true,
  pending: 0,
  running: false,
  lastSyncAt: null,
  lastPrefetchAt: null,
  revision: 0,
  set: patch => set(patch),
  bump: () => set(s => ({ revision: s.revision + 1 })),
}));
