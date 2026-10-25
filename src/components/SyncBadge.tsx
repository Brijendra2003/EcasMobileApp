import { ActivityIndicator, Pressable, View } from 'react-native';
import { CloudOff, RefreshCw } from 'lucide-react-native';
import { syncNow } from '../offline/service';
import { useSyncStatus } from '../stores/sync';
import { useTheme } from './theme';
import { Text } from './Text';

/** Header badge (§6): unsynced registers; tap = "Sync now" (resets backoff). */
export function SyncBadge() {
  const { pending, running, online } = useSyncStatus();
  const { colors } = useTheme();
  if (pending === 0 && online) {
    return null;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={pending > 0 ? `${pending} registers waiting to sync. Sync now` : 'Offline'}
      onPress={() => syncNow(true).catch(() => {})}
      hitSlop={8}
      className="mr-2 flex-row items-center rounded-full bg-warn/15 px-2 py-1"
    >
      {running ? (
        <ActivityIndicator size="small" color={colors.warn} />
      ) : online ? (
        <RefreshCw size={14} color={colors.warn} />
      ) : (
        <CloudOff size={14} color={colors.warn} />
      )}
      {pending > 0 ? (
        <View className="ml-1">
          <Text className="text-xs font-bold text-warn">{pending}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
