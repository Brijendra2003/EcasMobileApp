import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useSyncStatus } from '../stores/sync';

/** Tracks connectivity for the offline banner, TanStack Query and the sync worker. */
export function startConnectivity(): () => void {
  return NetInfo.addEventListener(state => {
    const online = !!state.isConnected && state.isInternetReachable !== false;
    onlineManager.setOnline(online);
    useSyncStatus.getState().set({ online });
  });
}
