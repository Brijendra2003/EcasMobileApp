import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from './theme';
import { Text } from './Text';

interface Props {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  last?: boolean;
}

export function ListRow({ title, subtitle, left, right, onPress, last }: Props) {
  const { colors } = useTheme();
  const body = (
    <View className={`min-h-14 flex-row items-center gap-3 px-4 py-3 ${last ? '' : 'border-b border-line'}`}>
      {left}
      <View className="flex-1">
        <Text variant="body">{title}</Text>
        {subtitle ? <Text variant="muted">{subtitle}</Text> : null}
      </View>
      {right}
      {onPress ? <ChevronRight size={18} color={colors.muted} /> : null}
    </View>
  );
  if (!onPress) {
    return body;
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title} onPress={onPress} className="active:opacity-70">
      {body}
    </Pressable>
  );
}

export function ListGroup({ children }: { children: ReactNode }) {
  return <View className="overflow-hidden rounded-lg border border-line bg-surface">{children}</View>;
}
