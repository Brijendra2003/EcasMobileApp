import type { ReactNode } from 'react';
import { Pressable, View, type ViewProps } from 'react-native';

interface Props extends ViewProps {
  children: ReactNode;
  className?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
}

/** Flat card: border instead of heavy shadows, which are slow on low-end Android (§14). */
export function Card({ children, className, onPress, accessibilityLabel, ...rest }: Props) {
  const cls = `rounded-lg border border-line bg-surface p-4 ${className ?? ''}`;
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} className={`${cls} active:opacity-80`}>
        {children}
      </Pressable>
    );
  }
  return (
    <View className={cls} {...rest}>
      {children}
    </View>
  );
}
