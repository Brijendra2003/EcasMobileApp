import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell } from 'lucide-react-native';
import { useUnreadCount } from '../features/common/hooks';
import type { SharedStackParamList } from '../navigation/types';
import { SyncBadge } from './SyncBadge';
import { useTheme } from './theme';
import { Text } from './Text';

export function NotificationBell() {
  const navigation = useNavigation<NativeStackNavigationProp<SharedStackParamList>>();
  const unread = useUnreadCount();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      hitSlop={10}
      onPress={() => navigation.navigate('Notifications')}
      className="h-10 w-10 items-center justify-center"
    >
      <Bell size={22} color={colors.ink} />
      {unread > 0 ? (
        <View className="absolute right-1 top-1 min-w-4 items-center rounded-full bg-danger px-1">
          <Text className="text-[10px] font-bold text-white">{unread > 99 ? '99+' : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function HeaderActions({ sync }: { sync?: boolean }) {
  return (
    <View className="flex-row items-center">
      {sync ? <SyncBadge /> : null}
      <NotificationBell />
    </View>
  );
}
