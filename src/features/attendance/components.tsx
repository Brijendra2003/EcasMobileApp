import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Line, Polyline, Rect } from 'react-native-svg';
import { Banner } from '../../components/feedback';
import { PercentRing, standingColor } from '../../components/PercentRing';
import { statusColor } from '../../components/StatusPill';
import { useTheme } from '../../components/theme';
import { Text } from '../../components/Text';
import { pct } from '../../lib/format';
import { standing } from '../../shared/attendance';
import { parseISODate } from '../../shared/dates';
import type { SummaryRow } from '../../types/database';
import { COMPONENT_LABEL, overview, shortageMessage, shortageNotes } from './derive';

export function AttendanceOverview({ rows }: { rows: SummaryRow[] }) {
  const { t } = useTranslation();
  const o = overview(rows);
  return (
    <View className="flex-row items-center rounded-lg border border-line bg-surface p-4">
      <PercentRing percent={o.overall.percent} min={o.min} warn={o.warn} label={t('common.overall')} />
      <View className="ml-5 flex-1 gap-3">
        <Stat label={t('common.theory')} value={o.theory.percent} min={o.min} warn={o.warn} sub={`${o.theory.attended}/${o.theory.held}`} />
        <Stat label={t('common.practical')} value={o.practical.percent} min={o.min} warn={o.warn} sub={`${o.practical.attended}/${o.practical.held}`} />
        <Text variant="caption">Minimum {o.min}%</Text>
      </View>
    </View>
  );
}

function Stat({ label, value, min, warn, sub }: { label: string; value: number | null; min: number; warn: number; sub: string }) {
  const { colors } = useTheme();
  return (
    <View>
      <Text variant="caption">{label}</Text>
      <View className="flex-row items-baseline gap-2">
        <Text className="text-xl font-bold" style={{ color: standingColor(standing(value, min, warn), colors) }}>
          {pct(value)}
        </Text>
        <Text variant="caption">{sub}</Text>
      </View>
    </View>
  );
}

export function ShortageBanners({ rows, limit = 3 }: { rows: SummaryRow[]; limit?: number }) {
  const notes = shortageNotes(rows).slice(0, limit);
  if (notes.length === 0) {
    return null;
  }
  return (
    <View className="mt-3 gap-2">
      {notes.map(n => (
        <Banner key={`${n.row.offering_id}-${n.row.component}`} tone={n.standing === 'shortage' ? 'danger' : 'warn'}>
          {shortageMessage(n)}
        </Banner>
      ))}
    </View>
  );
}

export function SubjectSummaryRow({ row }: { row: SummaryRow }) {
  const { colors } = useTheme();
  const s = standing(row.percent === null ? null : Number(row.percent), Number(row.min_percent), Number(row.warn_percent));
  const color = standingColor(s, colors);
  const value = Math.max(0, Math.min(100, Number(row.percent ?? 0)));
  return (
    <View>
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-2">
          <Text variant="body" numberOfLines={1}>
            {row.subject_name}
          </Text>
          <Text variant="caption">
            {COMPONENT_LABEL[row.component]} · {Number(row.attended)}/{Number(row.held)} attended · {row.absent} absent
            {Number(row.excused) > 0 ? ` · ${Number(row.excused)} excused` : ''}
          </Text>
        </View>
        <Text className="text-lg font-bold" style={{ color }}>
          {pct(row.percent)}
        </Text>
      </View>
      <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <View style={{ width: `${value}%`, backgroundColor: color }} className="h-full" />
      </View>
    </View>
  );
}

/** Running percentage with the minimum line. */
export function TrendChart({ points, min }: { points: { date: string; percent: number | null }[]; min: number }) {
  const { colors } = useTheme();
  const W = 320;
  const H = 120;
  const values = points.filter(p => p.percent !== null);
  if (values.length < 2) {
    return <Text variant="muted">Not enough sessions for a trend yet.</Text>;
  }
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (p: number) => H - (p / 100) * H;
  return (
    <View accessible accessibilityLabel={`Trend from ${values[0].percent}% to ${values[values.length - 1].percent}%`}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <Line x1={0} x2={W} y1={y(min)} y2={y(min)} stroke={colors.danger} strokeDasharray="4 4" strokeWidth={1} />
        <Polyline points={values.map((p, i) => `${x(i)},${y(p.percent!)}`).join(' ')} fill="none" stroke={colors.primary} strokeWidth={2} />
      </Svg>
      <View className="mt-1 flex-row justify-between">
        <Text variant="caption">{values[0].date.slice(5)}</Text>
        <Text variant="caption" className="text-danger">
          {min}% minimum
        </Text>
        <Text variant="caption">{values[values.length - 1].date.slice(5)}</Text>
      </View>
    </View>
  );
}

/** Calendar heatmap: one cell per day, coloured by the worst status that day. */
export function Heatmap({ sessions, colors: live }: { sessions: { session_date: string; status: string }[]; colors: Record<string, string> }) {
  const { colors } = useTheme();
  if (sessions.length === 0) {
    return null;
  }
  const rank: Record<string, number> = { A: 3, L: 2, ML: 2, OD: 1, P: 0 };
  const byDay = new Map<string, string>();
  for (const s of sessions) {
    const prev = byDay.get(s.session_date);
    if (!prev || (rank[s.status] ?? 1) > (rank[prev] ?? 1)) {
      byDay.set(s.session_date, s.status);
    }
  }
  const days = [...byDay.keys()].sort();
  const start = parseISODate(days[0]);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const end = parseISODate(days[days.length - 1]);
  const weeks: string[][] = [];
  for (let d = new Date(start); d <= end; ) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
    weeks.push(week);
  }
  const cell = 14;
  const gap = 3;
  return (
    <View accessible accessibilityLabel={`Attendance by day, ${byDay.size} days`}>
      <Svg width={weeks.length * (cell + gap)} height={7 * (cell + gap)}>
        {weeks.map((w, wi) =>
          w.map((d, di) => {
            const st = byDay.get(d);
            return (
              <Rect
                key={d}
                x={wi * (cell + gap)}
                y={di * (cell + gap)}
                width={cell}
                height={cell}
                rx={3}
                fill={st ? statusColor(st, live[st]) : colors.line}
                opacity={st ? 1 : 0.5}
              />
            );
          }),
        )}
      </Svg>
      <View className="mt-2 flex-row gap-3">
        {['P', 'A', 'L'].map(c => (
          <View key={c} className="flex-row items-center gap-1">
            <View className="h-3 w-3 rounded-sm" style={{ backgroundColor: statusColor(c, live[c]) }} />
            <Text variant="caption">{c}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
