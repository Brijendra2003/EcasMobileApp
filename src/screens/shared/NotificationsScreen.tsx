// Notification centre (§12): the source of truth; push is only a delivery channel.
import { useEffect } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { EmptyState, QueryView } from '../../components/feedback';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../components/theme';
import { Text } from '../../components/Text';
import { useMarkNotificationsRead, useNotifications } from '../../features/common/hooks';
import { instant } from '../../lib/format';
import type { SharedStackParamList } from '../../navigation/types';
import type { NotificationRow } from '../../types/database';

export function NotificationsScreen({ navigation }: NativeStackScreenProps<SharedStackParamList, 'Notifications'>) {
  const q = useNotifications();
  const markRead = useMarkNotificationsRead();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const unread = (q.data ?? []).filter(n => !n.read_at).length;

  useEffect(() => {
    navigation.setOptions({
      // eslint-disable-next-line react/no-unstable-nested-components -- header render callback
      headerRight: () =>
        unread > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => markRead.mutate(undefined)} hitSlop={8}>
            <Text className="font-semibold text-primary">Mark all read</Text>
          </Pressable>
        ) : null,
    });
  }, [navigation, unread, markRead]);

  const open = (n: NotificationRow) => {
    if (!n.read_at) {
      markRead.mutate([n.id]);
    }
    const url = typeof n.data?.url === 'string' ? n.data.url : null;
    if (url?.startsWith('collegeapp://') && !url.endsWith('/notifications')) {
      Linking.openURL(url).catch(() => {});
    }
  };

  return (
    <Screen scroll={false}>
      <QueryView query={q}>
        {data => (
          <FlatList
            data={data}
            keyExtractor={n => n.id}
            refreshControl={
              <RefreshControl
                refreshing={q.isRefetching}
                onRefresh={() => {
                  q.refetch();
                }}
                tintColor={colors.muted}
              />
            }
            ListEmptyComponent={<EmptyState title={t('common.nothingHere')} body="Attendance alerts, approvals and notices appear here." />}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.read_at ? '' : 'Unread. '}${item.title}. ${item.body ?? ''}`}
                onPress={() => open(item)}
                className={`border-b border-line px-4 py-3 ${item.read_at ? 'bg-canvas' : 'bg-surface'}`}
              >
                <View className="flex-row items-start">
                  {!item.read_at ? <View className="mr-2 mt-2 h-2 w-2 rounded-full bg-primary" /> : <View className="mr-2 w-2" />}
                  <View className="flex-1">
                    <Text variant={item.read_at ? 'body' : 'subheading'}>{item.title}</Text>
                    {item.body ? <Text variant="muted">{item.body}</Text> : null}
                    <Text variant="caption" className="mt-1">
                      {instant(item.created_at)}
                    </Text>
                  </View>
                </View>
              </Pressable>
            )}
          />
        )}
      </QueryView>
    </Screen>
  );
}
