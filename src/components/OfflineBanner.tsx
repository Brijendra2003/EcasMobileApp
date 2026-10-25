import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSyncStatus } from '../stores/sync';
import { Text } from './Text';

export function OfflineBanner() {
  const online = useSyncStatus(s => s.online);
  const { t } = useTranslation();
  if (online) {
    return null;
  }
  return (
    <View accessibilityRole="alert" className="bg-ink px-4 py-2">
      <Text className="text-center text-sm text-canvas">{t('common.offline')}</Text>
    </View>
  );
}
