import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMarking, useStudentStatus } from '../features/marking/store';
import type { RosterEntry } from '../features/marking/logic';
import { StatusPill, statusColor } from './StatusPill';
import { Text } from './Text';

interface Props {
  entry: RosterEntry & { batch_code?: string | null };
  colors: Record<string, string>;
  onLongPress?: (entry: RosterEntry) => void;
}

function useA11yLabel(entry: RosterEntry, status: string | null, readOnly: boolean) {
  const { t } = useTranslation();
  const label = status ? t(`status.${status}`, { defaultValue: status }) : t('status.pending');
  const roll = entry.roll_no === null ? entry.name : `Roll ${entry.roll_no}`;
  if (readOnly) {
    return `${roll}, ${label}`;
  }
  return `${roll}, ${entry.name}, ${label}. Double-tap to mark ${status === 'P' ? 'absent' : 'present'}`;
}

/** List layout: large roll number, name, status letter (§8.2). */
export const RosterRow = memo(function RosterRow({ entry, colors, onLongPress }: Props) {
  const status = useStudentStatus(entry.student_id, entry.suggested_status);
  const readOnly = useMarking(s => s.readOnly);
  const label = useA11yLabel(entry, status, readOnly);
  const onLeave = entry.suggested_status === 'L';
  const c = status ? statusColor(status, colors[status]) : undefined;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={readOnly}
      onPress={() => useMarking.getState().toggle(entry.student_id)}
      onLongPress={onLongPress ? () => onLongPress(entry) : undefined}
      delayLongPress={350}
      className="min-h-14 flex-row items-center border-b border-line bg-surface px-4"
      style={c ? { borderLeftWidth: 4, borderLeftColor: c } : { borderLeftWidth: 4, borderLeftColor: 'transparent' }}
    >
      <Text className="w-14 text-2xl font-bold text-ink">{entry.roll_no ?? '–'}</Text>
      <View className="flex-1 py-2">
        <Text variant="body" numberOfLines={1}>
          {entry.name}
        </Text>
        {onLeave || entry.batch_code ? (
          <Text variant="caption">
            {[onLeave ? 'On leave' : null, entry.batch_code ? `Batch ${entry.batch_code}` : null].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
      </View>
      {status ? <StatusPill code={status} color={colors[status]} /> : <Text variant="caption">Pending</Text>}
    </Pressable>
  );
});

/** Grid layout: roll-number tiles, fastest for tapping a few absentees. */
export const RosterTile = memo(function RosterTile({ entry, colors, onLongPress }: Props) {
  const status = useStudentStatus(entry.student_id, entry.suggested_status);
  const readOnly = useMarking(s => s.readOnly);
  const label = useA11yLabel(entry, status, readOnly);
  const c = status ? statusColor(status, colors[status]) : undefined;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={readOnly}
      onPress={() => useMarking.getState().toggle(entry.student_id)}
      onLongPress={onLongPress ? () => onLongPress(entry) : undefined}
      delayLongPress={350}
      className="m-1 h-16 flex-1 items-center justify-center rounded-md border-2 bg-surface"
      style={{ borderColor: c ?? 'transparent', backgroundColor: c ? `${c}1f` : undefined }}
    >
      <Text className="text-xl font-bold text-ink">{entry.roll_no ?? '–'}</Text>
      <Text className="text-xs font-bold" style={{ color: c }}>
        {status ?? '·'}
      </Text>
    </Pressable>
  );
});
