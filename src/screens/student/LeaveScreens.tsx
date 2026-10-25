// Student leave (§10): apply (full day, half day, selected sessions, medical),
// track, cancel while pending. The overlap check here is a courtesy; the
// server's exclusion constraint is authoritative.
import { useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DateField } from '../../components/DateField';
import { Banner, EmptyState, QueryView, SectionTitle } from '../../components/feedback';
import { Screen } from '../../components/Screen';
import { Segmented } from '../../components/Segmented';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { useApplyLeave, useCancelLeave, useLeave, useTimetable, type LeaveInput } from '../../features/attendance/api';
import { useScopeStudentId } from '../../features/common/hooks';
import { errorMessage } from '../../lib/errors';
import { dateRange, instant, timeRange } from '../../lib/format';
import { addDays, istDate } from '../../shared/dates';
import type { StudentStackParamList, StudentTabParamList } from '../../navigation/types';
import type { LeaveRow, LeaveStatus, LeaveType } from '../../types/database';

const TYPE_LABEL: Record<LeaveType, string> = { full_day: 'Full day', half_day: 'Half day', session: 'Selected lectures', medical: 'Medical' };
const STATUS_STYLE: Record<LeaveStatus, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'text-warn' },
  needs_info: { label: 'More information needed', cls: 'text-warn' },
  approved: { label: 'Approved', cls: 'text-safe' },
  rejected: { label: 'Rejected', cls: 'text-danger' },
  cancelled: { label: 'Cancelled', cls: 'text-muted' },
};

export function LeaveCard({ l, onPress }: { l: LeaveRow; onPress?: () => void }) {
  const st = STATUS_STYLE[l.status];
  return (
    <Card className="mb-2" onPress={onPress} accessibilityLabel={`${TYPE_LABEL[l.leave_type]} leave, ${dateRange(l.from_date, l.to_date)}, ${st.label}`}>
      <View className="flex-row items-center justify-between">
        <Text variant="subheading">{TYPE_LABEL[l.leave_type]}</Text>
        <Text className={`text-sm font-semibold ${st.cls}`}>{st.label}</Text>
      </View>
      <Text variant="muted">{dateRange(l.from_date, l.to_date)}</Text>
      <Text variant="body" numberOfLines={2} className="mt-1">
        {l.reason}
      </Text>
    </Card>
  );
}

type TabProps = CompositeScreenProps<BottomTabScreenProps<StudentTabParamList, 'StuLeave'>, NativeStackScreenProps<StudentStackParamList>>;

export function StudentLeaveScreen({ navigation }: TabProps) {
  const studentId = useScopeStudentId();
  const q = useLeave(studentId);
  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching} footer={<Button title="Apply for leave" onPress={() => navigation.navigate('NewLeave')} />}>
      <QueryView query={q}>
        {rows =>
          rows.length === 0 ? (
            <EmptyState title="No leave requests" body="Approved leave shows as L in your registers." />
          ) : (
            rows.map(l => <LeaveCard key={l.id} l={l} onPress={() => navigation.navigate('LeaveDetail', { leaveId: l.id })} />)
          )
        }
      </QueryView>
    </Screen>
  );
}

function overlaps(existing: LeaveRow[], from: string, to: string) {
  return existing.some(l => ['pending', 'needs_info', 'approved'].includes(l.status) && l.from_date <= to && from <= l.to_date);
}

export function NewLeaveScreen({ navigation }: NativeStackScreenProps<StudentStackParamList, 'NewLeave'>) {
  const studentId = useScopeStudentId();
  const existing = useLeave(studentId);
  const apply = useApplyLeave(studentId);
  const today = istDate();
  const [type, setType] = useState<LeaveType>('full_day');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [half, setHalf] = useState<'first' | 'second'>('first');
  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const timetable = useTimetable(studentId, from, from);
  const sessions = useMemo(() => (timetable.data ?? []).filter(s => s.status === 'scheduled' || s.status === 'held'), [timetable.data]);

  const end = type === 'full_day' || type === 'medical' ? to : from;
  const overlap = overlaps(existing.data ?? [], from, end);

  const submit = async () => {
    setError(null);
    if (reason.trim().length < 5) {
      setError('Give a reason of at least 5 characters.');
      return;
    }
    if (type === 'session' && sessionIds.length === 0) {
      setError('Choose at least one lecture.');
      return;
    }
    const input: LeaveInput = { leave_type: type, from_date: from, to_date: end, reason: reason.trim() };
    if (type === 'half_day') {
      input.half = half;
    }
    if (type === 'session') {
      input.session_ids = sessionIds;
    }
    try {
      await apply.mutateAsync(input);
      navigation.goBack();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Screen footer={<Button title="Submit request" onPress={submit} loading={apply.isPending} disabled={overlap} />}>
      <Text variant="label" className="mb-2">
        Type
      </Text>
      <Segmented<LeaveType>
        value={type}
        onChange={setType}
        options={[
          { value: 'full_day', label: 'Full day' },
          { value: 'half_day', label: 'Half day' },
          { value: 'session', label: 'Lectures' },
          { value: 'medical', label: 'Medical' },
        ]}
      />
      <View className="mt-4">
        <DateField
          label={type === 'full_day' || type === 'medical' ? 'From' : 'Date'}
          value={from}
          min={addDays(today, -30)}
          max={addDays(today, 120)}
          onChange={d => {
            setFrom(d);
            setSessionIds([]);
            if (to < d) {
              setTo(d);
            }
          }}
        />
        {type === 'full_day' || type === 'medical' ? <DateField label="To" value={to} min={from} max={addDays(today, 120)} onChange={setTo} /> : null}
      </View>
      {type === 'half_day' ? (
        <View className="mb-4">
          <Segmented
            value={half}
            onChange={setHalf}
            options={[
              { value: 'first', label: 'Before 1 PM' },
              { value: 'second', label: 'After 1 PM' },
            ]}
          />
        </View>
      ) : null}
      {type === 'session' ? (
        <View className="mb-4">
          <Text variant="label" className="mb-2">
            Lectures
          </Text>
          {sessions.length === 0 ? <Text variant="muted">No lectures on this day.</Text> : null}
          {sessions.map(s => {
            const on = sessionIds.includes(s.session_id);
            return (
              <Pressable
                key={s.session_id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => setSessionIds(ids => (on ? ids.filter(x => x !== s.session_id) : [...ids, s.session_id]))}
                className={`mb-2 min-h-12 flex-row items-center rounded-md border px-3 ${on ? 'border-primary bg-primary/10' : 'border-line bg-surface'}`}
              >
                <Text className="w-6 text-lg">{on ? '☑' : '☐'}</Text>
                <Text className="flex-1">
                  {timeRange(s.start_time, s.end_time)} · {s.subject_name} ({s.component})
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <TextField label="Reason" multiline value={reason} onChangeText={setReason} maxLength={500} />
      {type === 'medical' ? (
        <View className="mb-3">
          <Banner>Bring the medical certificate to your class teacher. Uploading documents from the app arrives with the college's document service.</Banner>
        </View>
      ) : null}
      {overlap ? <Banner tone="warn">You already have leave for part of this time.</Banner> : null}
      {error ? <Text className="mt-2 text-sm text-danger">{error}</Text> : null}
    </Screen>
  );
}

export function LeaveDetailScreen({ route, navigation }: NativeStackScreenProps<StudentStackParamList, 'LeaveDetail'>) {
  const studentId = useScopeStudentId();
  const q = useLeave(studentId);
  const cancel = useCancelLeave(studentId);
  const l = q.data?.find(x => x.id === route.params.leaveId);

  const confirmCancel = () =>
    Alert.alert('Cancel this request?', undefined, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel request',
        style: 'destructive',
        onPress: () =>
          cancel.mutate(route.params.leaveId, {
            onSuccess: () => navigation.goBack(),
            onError: e => Alert.alert('Could not cancel', errorMessage(e)),
          }),
      },
    ]);

  if (!l) {
    return (
      <Screen>
        <QueryView query={q}>{() => <EmptyState title="Request not found" />}</QueryView>
      </Screen>
    );
  }
  return (
    <Screen
      footer={l.status === 'pending' || l.status === 'needs_info' ? <Button variant="danger" title="Cancel request" onPress={confirmCancel} loading={cancel.isPending} /> : undefined}
    >
      <LeaveCard l={l} />
      <SectionTitle>Details</SectionTitle>
      <Card>
        <Text variant="caption">Applied</Text>
        <Text className="mb-2">{instant(l.created_at)}</Text>
        <Text variant="caption">Covers</Text>
        <Text className="mb-2">
          {instant(l.starts_at)} – {instant(l.ends_at)}
          {l.session_count ? ` · ${l.session_count} lectures` : ''}
        </Text>
        <Text variant="caption">Reason</Text>
        <Text>{l.reason}</Text>
      </Card>
      {l.decided_at || l.decision_note ? (
        <>
          <SectionTitle>Decision</SectionTitle>
          <Card>
            {l.decided_at ? <Text variant="caption">{instant(l.decided_at)}</Text> : null}
            <Text>{l.decision_note ?? STATUS_STYLE[l.status].label}</Text>
          </Card>
        </>
      ) : null}
      {l.status === 'needs_info' ? (
        <View className="mt-3">
          <Banner tone="warn">Your class teacher needs more information. Talk to them, or cancel and apply again with the details.</Banner>
        </View>
      ) : null}
    </Screen>
  );
}
