import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View, type PressableProps } from 'react-native';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const BOX: Record<Variant, string> = {
  primary: 'bg-primary',
  secondary: 'bg-surface border border-line',
  danger: 'bg-danger',
  ghost: 'bg-transparent',
};
const LABEL: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-ink',
  danger: 'text-white',
  ghost: 'text-primary',
};

interface Props extends Omit<PressableProps, 'children'> {
  title: string;
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
  compact?: boolean;
}

/** 48 dp minimum touch target (§14). */
export function Button({ title, variant = 'primary', loading, disabled, icon, className, compact, ...rest }: Props) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      className={`${compact ? 'min-h-10 px-3' : 'min-h-12 px-4'} flex-row items-center justify-center rounded-md ${BOX[variant]} ${inactive ? 'opacity-50' : 'active:opacity-80'} ${className ?? ''}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#fff' : undefined} />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon}
          <Text className={`text-base font-semibold ${LABEL[variant]}`}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}
