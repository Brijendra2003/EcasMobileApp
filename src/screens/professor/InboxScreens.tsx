// Inbox (§8.3): student leave for the class teacher to decide, and record
// questions from students and parents.
import { useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Banner, EmptyState, QueryView, SectionTitle } from '../../components/feedback';
import { Screen } from '../../components/Screen';
import { Segmented } from '../../components/Segmented';
import { StatusPill } from '../../components/StatusPill';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { COMPONENT_LABEL } from '../../features/attendance/derive';
import { useDecideLeave, useDisputesForMe, useLeavePending, useReplyDispute } from '../../features/professor/api';
import { errorMessage } from '../../lib/errors';
import { dateRange, day, instant } from '../../lib/format';
import type { ProfessorStackParamList, ProfessorTabParamList } from '../../navigation/types';
import { useSession } from '../../stores/session';
import type { DisputeForMeRow, LeavePendingRow, LeaveType } from '../../types/database';
import { useLiveColors } from './common';

type TabProps<T extends keyof ProfessorTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<ProfessorTabParamList, T>,
  NativeStackScreenProps<ProfessorStackParamList>
>;

const TYPE_LABEL: Record<LeaveType, string> = { full_day: 'Full day', half_day: 'Half day', session: 'Selected lectures', medical: 'Medical' };
const DISPUTE_STATUS = { open: 'Open', resolved: 'Resolved', rejected: 'Closed' } as const;

function LeaveRequestCard({ l, onPress }: { l: LeavePendingRow; onPress?: () => void }) {
  return (
    <Card className="mb-2" onPress={onPress} accessibilityLabel={`${l.full_name}, ${TYPE_LABEL[l.leave_type]} leave, ${dateRange(l.from_date, l.to_date)}`}>
      <View className="flex-row items-center justify-between">
        <Text variant="subheading" className="flex-1" numberOfLines={1}>
          {l.full_name}
        </Text>
        <Text className={`text-sm font-semibold ${l.status === 'needs_info' ? 'text-warn' : 'text-primary'}`}>
          {l.status === 'needs_info' ? 'Waiting for student' : 'To decide'}
        </Text>
      </View>
      <Text variant="caption">{[l.division_label, l.roll_no ? `Roll ${l.roll_no}` : null].filter(Boolean).join(' · ')}</Text>
      <Text variant="muted">
        {TYPE_LABEL[l.leave_type]} · {dateRange(l.from_date, l.to_date)}
        {l.session_count ? ` · ${l.session_count} lectures` : ''}
      </Text>
      <Text className="mt-1" numberOfLines={2}>
        {l.reason}
      </Text>
    </Card>
  );
}

function DisputeCard({ d, onPress }: { d: DisputeForMeRow; onPress?: () => void }) {
  const colors = useLiveColors();
  return (
    <Card className="mb-2" onPress={onPress} accessibilityLabel={`${d.full_name}, ${d.subject_name}, ${DISPUTE_STATUS[d.status]}`}>
      <View className="flex-row items-center justify-between">
        <Text variant="subheading" className="flex-1" numberOfLines={1}>
          {d.full_name}
          {d.from_guardian ? ' (parent)' : ''}
        </Text>
        <StatusPill code={d.status_code} color={colors[d.status_code]} size="sm" />
      </View>
      <Text variant="caption">
        {d.subject_name} · {COMPONENT_LABEL[d.component]} · {day(d.session_date)} · {DISPUTE_STATUS[d.status]}
      </Text>
      <Text className="mt-1" numberOfLines={2}>
        {d.message}
      </Text>
    </Card>
  );
}

type InboxView = 'leave' | 'disputes';

export function InboxScreen({ navigation }: TabProps<'ProfInbox'>) {
  const isClassTeacher = useSession(s => (s.caps?.class_teacher_of.length ?? 0) > 0);
  const [view, setView] = useState<InboxView>(isClassTeacher ? 'leave' : 'disputes');
  const leave = useLeavePending();
  const disputes = useDisputesForMe();
  const openDisputes = (disputes.data ?? []).filter(d => d.status === 'open').length;
  const q = view === 'leave' ? leave : disputes;
  return (
    <View className="flex-1 bg-canvas">
      <View className="px-4 pt-3">
        <Segmented<InboxView>
          value={view}
          onChange={setView}
          options={[
            { value: 'leave', label: `Leave · ${leave.data?.length ?? 0}` },
            { value: 'disputes', label: `Questions · ${openDisputes}` },
          ]}
        />
      </View>
      <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
        {view === 'leave' ? (
          <QueryView query={leave}>
            {rows =>
              rows.length === 0 ? (
                <EmptyState
                  title="No leave to decide"
                  body={isClassTeacher ? 'New requests from your class appear here.' : 'Leave requests appear here when you are a class teacher.'}
                />
              ) : (
                rows.map(l => <LeaveRequestCard key={l.id} l={l} onPress={() => navigation.navigate('LeaveApproval', { leaveId: l.id })} />)
              )
            }
          </QueryView>
        ) : (
          <QueryView query={disputes}>
            {rows =>
              rows.length === 0 ? (
                <EmptyState title="No questions" body="When a student reports a problem with a record, or a parent asks about one, it appears here." />
              ) : (
                rows.map(d => <DisputeCard key={d.id} d={d} onPress={() => navigation.navigate('DisputeThread', { disputeId: d.id })} />)
              )
            }
          </QueryView>
        )}
      </Screen>
    </View>
  );
}

export function LeaveApprovalScreen({ route, navigation }: NativeStackScreenProps<ProfessorStackParamList, 'LeaveApproval'>) {
  const q = useLeavePending();
  const decide = useDecideLeave();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<'approved' | 'rejected' | 'needs_info' | null>(null);
  const l = q.data?.find(x => x.id === route.params.leaveId);

  if (!l) {
    return (
      <Screen>
        <QueryView query={q}>{() => <EmptyState title="Request not found" body="It may already have been decided." />}</QueryView>
      </Screen>
    );
  }

  const act = async (decision: 'approved' | 'rejected' | 'needs_info') => {
    setError(null);
    if (decision !== 'approved' && note.trim().length < 5) {
      setError(decision === 'rejected' ? 'Tell the student why the request is rejected.' : 'Say what information you need.');
      return;
    }
    setPending(decision);
    try {
      await decide.mutateAsync({ id: l.id, decision, note: note.trim() || undefined });
      navigation.goBack();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(null);
    }
  };

  return (
    <Screen
      footer={
        <View className="gap-2">
          <Button title="Approve" onPress={() => act('approved')} loading={pending === 'approved'} disabled={pending !== null} />
          <View className="flex-row gap-2">
            <Button className="flex-1" variant="secondary" title="Ask for details" onPress={() => act('needs_info')} loading={pending === 'needs_info'} disabled={pending !== null} />
            <Button className="flex-1" variant="danger" title="Reject" onPress={() => act('rejected')} loading={pending === 'rejected'} disabled={pending !== null} />
          </View>
        </View>
      }
    >
      <LeaveRequestCard l={l} />
      <SectionTitle>Details</SectionTitle>
      <Card>
        <Text variant="caption">Applied</Text>
        <Text className="mb-2">{instant(l.created_at)}</Text>
        <Text variant="caption">Covers</Text>
        <Text className="mb-2">
          {instant(l.starts_at)} – {instant(l.ends_at)}
        </Text>
        <Text variant="caption">Reason</Text>
        <Text>{l.reason}</Text>
      </Card>
      {l.has_document ? (
        <View className="mt-3">
          <Banner>A document is attached. Open it on the web portal.</Banner>
        </View>
      ) : null}
      <View className="mt-4">
        <TextField label="Note to the student" multiline value={note} onChangeText={setNote} maxLength={500} hint="Required when rejecting or asking for details." />
      </View>
      {l.leave_type !== 'session' ? (
        <Text variant="caption">Approved leave is pre-filled as L in every register it covers.</Text>
      ) : null}
      {error ? <Text className="mt-2 text-sm text-danger">{error}</Text> : null}
    </Screen>
  );
}

export function DisputeThreadScreen({ route, navigation }: NativeStackScreenProps<ProfessorStackParamList, 'DisputeThread'>) {
  const { t } = useTranslation();
  const colors = useLiveColors();
  const q = useDisputesForMe();
  const reply = useReplyDispute();
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<'reply' | 'resolved' | 'rejected' | null>(null);
  const d = q.data?.find(x => x.id === route.params.disputeId);

  if (!d) {
    return (
      <Screen>
        <QueryView query={q}>{() => <EmptyState title="Question not found" />}</QueryView>
      </Screen>
    );
  }

  const send = async (status?: 'resolved' | 'rejected') => {
    setError(null);
    if (message.trim().length < 2) {
      setError('Write a reply first.');
      return;
    }
    setPending(status ?? 'reply');
    try {
      await reply.mutateAsync({ id: d.id, message: message.trim(), status });
      setMessage('');
      if (status) {
        navigation.goBack();
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(null);
    }
  };

  const thread = d.thread.length > 0 ? d.thread : [{ by: d.full_name, role: d.from_guardian ? 'parent' : 'student', message: d.message, at: d.created_at }];
  const open = d.status === 'open';

  return (
    <Screen
      onRefresh={() => q.refetch()}
      refreshing={q.isRefetching}
      footer={
        open ? (
          <View className="gap-2">
            <Button title={t('common.send')} onPress={() => send()} loading={pending === 'reply'} disabled={pending !== null} />
            <View className="flex-row gap-2">
              <Button className="flex-1" variant="secondary" title="Send and resolve" onPress={() => send('resolved')} loading={pending === 'resolved'} disabled={pending !== null} />
              <Button className="flex-1" variant="secondary" title="Send and close" onPress={() => send('rejected')} loading={pending === 'rejected'} disabled={pending !== null} />
            </View>
          </View>
        ) : undefined
      }
    >
      <Card className="mb-3">
        <View className="flex-row items-center justify-between">
          <Text variant="subheading" className="flex-1">
            {d.full_name}
            {d.roll_no ? ` · Roll ${d.roll_no}` : ''}
          </Text>
          <StatusPill code={d.status_code} label={t(`status.${d.status_code}`, { defaultValue: d.status_code })} color={colors[d.status_code]} size="sm" />
        </View>
        <Text variant="muted">
          {d.subject_name} · {COMPONENT_LABEL[d.component]} · {day(d.session_date, { weekday: true, year: true })}
        </Text>
        <Text variant="caption">
          {d.from_guardian ? 'Asked by a parent' : 'Reported by the student'} · {DISPUTE_STATUS[d.status]}
        </Text>
      </Card>
      <View className="gap-2">
        {thread.map((m, i) => (
          <View key={i} className={`rounded-md p-3 ${m.role === 'staff' ? 'ml-8 bg-primary/10' : 'mr-8 bg-surface'}`}>
            <Text variant="caption">
              {m.by} · {instant(m.at)}
            </Text>
            <Text>{m.message}</Text>
          </View>
        ))}
      </View>
      {open ? (
        <>
          <View className="mt-4">
            <TextField label="Reply" multiline value={message} onChangeText={setMessage} maxLength={1000} error={error ?? undefined} />
          </View>
          <Button variant="ghost" title="Change the record (request correction)" onPress={() => navigation.navigate('CorrectionRequest', { sessionId: d.session_id })} />
        </>
      ) : null}
    </Screen>
  );
}
