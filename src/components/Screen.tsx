import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './theme';
import { OfflineBanner } from './OfflineBanner';

interface Props {
  children: ReactNode;
  /** Wrap in a ScrollView (default). Lists pass false and scroll themselves. */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Screens without a navigation header need the top inset. */
  topInset?: boolean;
  footer?: ReactNode;
}

export function Screen({ children, scroll = true, refreshing, onRefresh, topInset, footer }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: topInset ? insets.top : 0 }}>
      <OfflineBanner />
      {scroll ? (
        <ScrollView
          contentContainerClassName="p-4 pb-10"
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.muted} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View className="flex-1">{children}</View>
      )}
      {footer ? (
        <View className="border-t border-line bg-surface px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}
