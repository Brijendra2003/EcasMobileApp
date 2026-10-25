// Day and week timetable with a session-type filter; changes and cancellations
// are highlighted (§10). Used by the student Timetable and parent Schedule tabs.
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/Card';
import { EmptyState, QueryView } from '../../components/feedback';
import { Segmented } from '../../components/Segmented';
import { StatusPill } from '../../components/StatusPill';
import { Text } from '../../components/Text';
import { timeRange } from '../../lib/format';
import { addDays, dayName, istDate, parseISODate, weekday } from '../../shared/dates';
import type { TimetableRow } from '../../types/database';
import { useTimetable } from './api';

type Kind = 'all' | 'theory' | 'practical';

function weekStart(iso: string) {
  const wd = weekday(iso);
  return addDays(iso, wd === 0 ? -6 : 1 - wd);
}

export function SessionLine({ s, statusColors }: { s: TimetableRow; statusColors?: Record<string, string> }) {
  const { t } = useTranslation();
  const changed = s.status === 'cancelled' || s.status === 'rescheduled';
  return (
    <Card className={`mb-2 ${changed ? 'border-danger/50' : s.has_substitute ? 'border-duty/50' : ''}`}>
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text variant="caption">{timeRange(s.start_time, s.end_time)}</Text>
          <Text variant="subheading" className={changed ? 'text-muted line-through' : ''}>
            {s.subject_name}
          </Text>
          <Text variant="muted">
            {[s.component, s.room_label ? `Room ${s.room_label}` : null, s.staff_name].filter(Boolean).join(' · ')}
          </Text>
          {s.status === 'cancelled' ? (
            <Text className="mt-1 text-sm font-medium text-danger">Cancelled{s.cancel_reason ? `: ${s.cancel_reason}` : ''}</Text>
          ) : s.status === 'rescheduled' ? (
            <Text className="mt-1 text-sm font-medium text-danger">Rescheduled</Text>
          ) : s.rescheduled_from_id ? (
            <Text className="mt-1 text-sm font-medium text-warn">Moved to this time</Text>
          ) : s.has_substitute ? (
            <Text className="mt-1 text-sm font-medium text-duty">Substitute teacher</Text>
          ) : null}
        </View>
        {s.my_status ? (
          <StatusPill code={s.my_status} label={t(`status.${s.my_status}`, { defaultValue: s.my_status })} color={statusColors?.[s.my_status]} size="sm" />
        ) : null}
      </View>
    </Card>
  );
}

export function TimetableView({ studentId, statusColors }: { studentId: string | null; statusColors?: Record<string, string> }) {
  const today = istDate();
  const [week, setWeek] = useState(weekStart(today));
  const [selected, setSelected] = useState(today);
  const [kind, setKind] = useState<Kind>('all');
  const q = useTimetable(studentId, week, addDays(week, 6));
  const days = useMemo(() => Array.from({ length: 6 }, (_, i) => addDays(week, i)), [week]);

  return (
    <View className="flex-1">
      <View className="border-b border-line bg-surface px-2 pb-2 pt-1">
        <View className="flex-row items-center justify-between px-2">
          <Pressable accessibilityRole="button" accessibilityLabel="Previous week" hitSlop={10} onPress={() => setWeek(addDays(week, -7))}>
            <Text className="p-2 text-lg text-primary">‹</Text>
          </Pressable>
          <Text variant="label">
            {parseISODate(week).getUTCDate()} – {parseISODate(addDays(week, 5)).getUTCDate()}{' '}
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][parseISODate(addDays(week, 5)).getUTCMonth()]}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Next week" hitSlop={10} onPress={() => setWeek(addDays(week, 7))}>
            <Text className="p-2 text-lg text-primary">›</Text>
          </Pressable>
        </View>
        <View className="flex-row">
          {days.map(d => {
            const active = d === selected;
            return (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setSelected(d)}
                className={`mx-0.5 min-h-12 flex-1 items-center justify-center rounded-md ${active ? 'bg-primary' : ''}`}
              >
                <Text className={`text-xs ${active ? 'text-white' : 'text-muted'}`}>{dayName(d)}</Text>
                <Text className={`text-base font-semibold ${active ? 'text-white' : d === today ? 'text-primary' : 'text-ink'}`}>
                  {parseISODate(d).getUTCDate()}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View className="mt-2 px-1">
          <Segmented<Kind>
            value={kind}
            onChange={setKind}
            options={[
              { value: 'all', label: 'All' },
              { value: 'theory', label: 'Theory' },
              { value: 'practical', label: 'Practical' },
            ]}
          />
        </View>
      </View>
      <ScrollView contentContainerClassName="p-4">
        <QueryView query={q}>
          {rows => {
            const list = rows.filter(
              r => r.session_date === selected && (kind === 'all' || (kind === 'practical' ? r.component === 'PR' : r.component !== 'PR')),
            );
            return list.length === 0 ? (
              <EmptyState title="No lectures" body={weekday(selected) === 0 ? 'Sunday' : undefined} />
            ) : (
              list.map(s => <SessionLine key={s.session_id} s={s} statusColors={statusColors} />)
            );
          }}
        </QueryView>
      </ScrollView>
    </View>
  );
}
