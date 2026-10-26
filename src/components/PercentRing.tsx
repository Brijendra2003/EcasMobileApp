import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { standing, type Standing } from '../shared/attendance';
import { useTheme } from './theme';
import { Text } from './Text';

export function standingColor(s: Standing, colors: { safe: string; warn: string; danger: string; muted: string }) {
  return s === 'safe' ? colors.safe : s === 'warning' ? colors.warn : s === 'shortage' ? colors.danger : colors.muted;
}

interface Props {
  percent: number | null;
  min: number;
  warn: number;
  size?: number;
  label?: string;
}

export function PercentRing({ percent, min, warn, size = 132, label }: Props) {
  const { colors } = useTheme();
  const stroke = Math.max(8, size / 11);
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const value = Math.max(0, Math.min(100, percent ?? 0));
  const color = standingColor(standing(percent, min, warn), colors);
  return (
    <View
      accessible
      accessibilityLabel={`${label ?? 'Attendance'} ${percent === null ? 'not available' : `${percent.toFixed(1)} percent`}`}
      style={{ width: size, height: size }}
      className="items-center justify-center"
    >
      <Svg width={size} height={size} style={styles.ring}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.line} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * circumference} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text className="font-bold text-ink" style={{ fontSize: size / 5 }}>
        {percent === null ? '—' : `${Math.round(percent)}%`}
      </Text>
      {label ? <Text variant="caption">{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({ ring: { position: 'absolute' } });
