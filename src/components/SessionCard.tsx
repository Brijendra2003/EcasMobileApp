import { View } from 'react-native';
import type { CardState, CardStatus } from '../features/professor/sessionState';
import { formatTime } from '../shared/dates';
import type { MySessionRow } from '../types/database';
import { Card } from './Card';
import { Text } from './Text';

const STATUS: Record<CardStatus, { label: string; cls: string }> = {
  upcoming: { label: 'Upcoming', cls: 'bg-line text-ink' },
  markNow: { label: 'Mark now', cls: 'bg-primary text-white' },
  submitted: { label: 'Submitted ✓', cls: 'bg-safe/15 text-safe' },
  waiting: { label: 'Waiting to sync ⟳', cls: 'bg-warn/15 text-warn' },
  attention: { label: 'Needs attention ⚠', cls: 'bg-danger/15 text-danger' },
  cancelled: { label: 'Cancelled', cls: 'bg-line text-muted' },
  rescheduled: { label: 'Rescheduled', cls: 'bg-line text-muted' },
  missed: { label: 'Locked, not submitted', cls: 'bg-danger/15 text-danger' },
};

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export function SessionCard({ session, state, onPress }: { session: MySessionRow; state: CardState; onPress?: () => void }) {
  const s = STATUS[state.status];
  const time = `${formatTime(minutes(session.start_time))} – ${formatTime(minutes(session.end_time))}`;
  const struck = state.status === 'cancelled' || state.status === 'rescheduled';
  return (
    <Card
      className="mb-3"
      onPress={onPress}
      accessibilityLabel={`${session.subject_name} ${session.component}, ${session.group_label}, ${time}, ${s.label}`}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text variant="caption">{time}</Text>
          <Text variant="subheading" className={struck ? 'line-through text-muted' : ''} numberOfLines={1}>
            {session.subject_name}
          </Text>
          <Text variant="muted" numberOfLines={1}>
            {[session.component, session.group_label, session.room_label ? `Room ${session.room_label}` : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <View className={`rounded-full px-2.5 py-1 ${s.cls.split(' ')[0]}`}>
          <Text className={`text-xs font-semibold ${s.cls.split(' ')[1]}`}>{s.label}</Text>
        </View>
      </View>
      {state.substitute || state.draft || session.cancel_reason || (state.status === 'submitted' && session.total_count) ? (
        <View className="mt-2 flex-row flex-wrap gap-x-3">
          {state.substitute ? (
            <Text variant="caption" className="text-duty">
              {session.my_role === 'substitute' ? 'You are substituting' : `Substitute: ${session.substitute_name}`}
            </Text>
          ) : null}
          {state.draft ? <Text variant="caption">Draft saved</Text> : null}
          {state.status === 'submitted' && session.total_count ? (
            <Text variant="caption">
              {session.present_count}/{session.total_count} present{session.is_late ? ' · late' : ''}
            </Text>
          ) : null}
          {session.cancel_reason && struck ? <Text variant="caption">{session.cancel_reason}</Text> : null}
        </View>
      ) : null}
    </Card>
  );
}
