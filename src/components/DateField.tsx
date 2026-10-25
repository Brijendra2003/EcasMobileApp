// Date field with a month-grid picker in a sheet (no native date picker dependency).
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { parseISODate, toISODate } from '../shared/dates';
import { day } from '../lib/format';
import { Sheet } from './Sheet';
import { Text } from './Text';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface Props {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
}

export function DateField({ label, value, onChange, min, max }: Props) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(value.slice(0, 7));
  const first = parseISODate(`${month}-01`);
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  const shift = (n: number) => {
    const d = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + n, 1));
    setMonth(toISODate(d).slice(0, 7));
  };

  return (
    <View className="mb-4">
      <Text variant="label" className="mb-1">
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${day(value, { weekday: true, year: true })}`}
        onPress={() => {
          setMonth(value.slice(0, 7));
          setOpen(true);
        }}
        className="min-h-12 justify-center rounded-md border border-line bg-surface px-3"
      >
        <Text>{day(value, { weekday: true, year: true })}</Text>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        <View className="mb-2 flex-row items-center justify-between">
          <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => shift(-1)} hitSlop={10}>
            <Text className="p-2 text-lg text-primary">‹</Text>
          </Pressable>
          <Text variant="subheading">
            {MONTHS[first.getUTCMonth()]} {first.getUTCFullYear()}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => shift(1)} hitSlop={10}>
            <Text className="p-2 text-lg text-primary">›</Text>
          </Pressable>
        </View>
        <View className="flex-row">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <Text key={i} variant="caption" className="flex-1 text-center">
              {d}
            </Text>
          ))}
        </View>
        <View className="flex-row flex-wrap">
          {cells.map((c, i) => {
            const disabled = !c || (min !== undefined && c < min) || (max !== undefined && c > max);
            const selected = c === value;
            return (
              <View key={i} style={{ width: `${100 / 7}%` }} className="p-0.5">
                {c ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled, selected }}
                    disabled={disabled}
                    onPress={() => {
                      onChange(c);
                      setOpen(false);
                    }}
                    className={`h-11 items-center justify-center rounded-md ${selected ? 'bg-primary' : ''}`}
                  >
                    <Text className={selected ? 'font-semibold text-white' : disabled ? 'text-muted opacity-40' : 'text-ink'}>{Number(c.slice(8))}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      </Sheet>
    </View>
  );
}
