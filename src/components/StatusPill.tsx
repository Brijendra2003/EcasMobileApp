import { View } from 'react-native';
import { statusColors } from '../shared/tokens';
import { Text } from './Text';

export function statusColor(code: string | null | undefined, live?: string): string {
  return live ?? (code ? (statusColors as Record<string, string>)[code] : undefined) ?? '#64748b';
}

/** Status is never shown by colour alone: the code letter is always present (§14). */
export function StatusPill({ code, label, color, size = 'md' }: { code: string; label?: string; color?: string; size?: 'sm' | 'md' }) {
  const c = statusColor(code, color);
  return (
    <View
      accessibilityLabel={label ?? code}
      className={`flex-row items-center rounded-full ${size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1'}`}
      style={{ backgroundColor: `${c}22` }}
    >
      <Text className={`${size === 'sm' ? 'text-xs' : 'text-sm'} font-bold`} style={{ color: c }}>
        {code}
      </Text>
      {label ? (
        <Text className={`${size === 'sm' ? 'text-xs' : 'text-sm'} ml-1`} style={{ color: c }}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}
