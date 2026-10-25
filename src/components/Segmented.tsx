import { Pressable, View } from 'react-native';
import { Text } from './Text';

interface Props<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}

export function Segmented<T extends string>({ value, options, onChange }: Props<T>) {
  return (
    <View className="flex-row rounded-md border border-line bg-surface p-1" accessibilityRole="tablist">
      {options.map(o => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            className={`min-h-10 flex-1 items-center justify-center rounded-sm ${active ? 'bg-primary' : ''}`}
          >
            <Text className={`text-sm font-medium ${active ? 'text-white' : 'text-ink'}`}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
