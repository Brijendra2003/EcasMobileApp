// Professor "More" (§6.1): sync status, staff leave, class announcements, the
// read-only HOD summary (§8.3) and the shared settings screens.
import { useEffect, useState } from 'react';
import { Alert, Pressable, Switch, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Banner, EmptyState, QueryView, SectionTitle } from '../../components/feedback';
import { DateField } from '../../components/DateField';
import { ListGroup, ListRow } from '../../components/ListRow';
import { Screen } from '../../components/Screen';
import { Segmented } from '../../components/Segmented';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import {
  useAnnouncementDivisions,
  useApplyStaffLeave,
  useCancelStaffLeave,
  useCreateAnnouncement,
  useHodSummary,
  useStaffLeave,
} from '../../features/professor/api';
import { errorMessage } from '../../lib/errors';
import { dateRange, instant, pct } from '../../lib/format';
import { prefetchWindow } from '../../offline/prefetch';
import { syncNow } from '../../offline/service';
import { announcementSchema } from '../../shared/schemas';
import { addDays, istDate } from '../../shared/dates';
import type { ProfessorStackParamList, ProfessorTabParamList } from '../../navigation/types';
import { useSession } from '../../stores/session';
import { useSyncStatus } from '../../stores/sync';
import type { StaffLeaveRow, StaffLeaveType } from '../../types/database';
import { confirmSignOut } from '../shared/SettingsScreen';
import { Row } from './common';

type TabProps<T extends keyof ProfessorTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<ProfessorTabParamList, T>,
  NativeStackScreenProps<ProfessorStackParamList>
>;
type StackProps<T extends keyof ProfessorStackParamList> = NativeStackScreenProps<ProfessorStackParamList, T>;

export function ProfessorMoreScreen({ navigation }: TabProps<'ProfMore'>) {
  const { t } = useTranslation();
  const caps = useSession(s => s.caps);
  const { pending, running, online, lastSyncAt, lastPrefetchAt } = useSyncStatus();
  const [refreshing, setRefreshing] = useState(false);
  const isHod = (caps?.hod_of.length ?? 0) > 0;
  const roles = [
    ...(caps?.class_teacher_of ?? []).map(d => `Class teacher, ${d.label}`),
    ...(caps?.hod_of ?? []).map(d => `HOD, ${d.code}`),
  ];

  const refreshSessions = async () => {
    setRefreshing(true);
    try {
      await prefetchWindow();
    } catch (e) {
      Alert.alert('Could not refresh', errorMessage(e));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen>
      {caps ? (
        <View className="mb-2">
          <Text variant="title">{caps.display_name}</Text>
          {roles.length > 0 ? <Text variant="muted">{roles.join(' · ')}</Text> : null}
        </View>
      ) : null}

      <SectionTitle>Offline registers</SectionTitle>
      <Card>
        <Row label="Waiting to sync" value={String(pending)} />
        <Row label="Last synced" value={lastSyncAt ? instant(lastSyncAt) : '—'} />
        <Row label="Sessions downloaded" value={lastPrefetchAt ? instant(lastPrefetchAt) : '—'} />
        <View className="mt-3 flex-row gap-2">
          <Button compact className="flex-1" title="Sync now" loading={running} disabled={!online} onPress={() => syncNow(true).catch(() => {})} />
          <Button compact className="flex-1" variant="secondary" title="Refresh sessions" loading={refreshing} disabled={!online} onPress={refreshSessions} />
        </View>
      </Card>

      <SectionTitle>Work</SectionTitle>
      <ListGroup>
        <ListRow title="Staff leave" onPress={() => navigation.navigate('StaffLeave')} />
        <ListRow title="New class announcement" last={!isHod} onPress={() => navigation.navigate('NewAnnouncement')} />
        {isHod ? <ListRow title="Department summary" last onPress={() => navigation.navigate('HodSummary')} /> : null}
      </ListGroup>

      <SectionTitle>General</SectionTitle>
      <ListGroup>
        <ListRow title={t('common.calendar')} onPress={() => navigation.navigate('Calendar')} />
        <ListRow title={t('common.notifications')} onPress={() => navigation.navigate('Notifications')} />
        <ListRow title="Notification preferences" onPress={() => navigation.navigate('NotificationPreferences')} />
        <ListRow title={t('common.settings')} last onPress={() => navigation.navigate('Settings')} />
      </ListGroup>

      <View className="mt-8">
        <ListGroup>
          <ListRow title={t('common.signOut')} last onPress={confirmSignOut} />
        </ListGroup>
      </View>
    </Screen>
  );
}

// ── Staff leave ───────────────────────────────────────────────────────────
const STAFF_TYPE_LABEL: Record<StaffLeaveType, string> = { casual: 'Casual', medical: 'Medical', duty: 'On duty', earned: 'Earned' };
const STAFF_STATUS: Record<StaffLeaveRow['status'], { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'text-warn' },
  approved: { label: 'Approved', cls: 'text-safe' },
  rejected: { label: 'Rejected', cls: 'text-danger' },
  cancelled: { label: 'Cancelled', cls: 'text-muted' },
};

export function StaffLeaveScreen({ navigation }: StackProps<'StaffLeave'>) {
  const q = useStaffLeave();
  const cancel = useCancelStaffLeave();

  const confirmCancel = (l: StaffLeaveRow) =>
    Alert.alert('Cancel this leave request?', dateRange(l.from_date, l.to_date), [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel request',
        style: 'destructive',
        onPress: () => cancel.mutate(l.id, { onError: e => Alert.alert('Could not cancel', errorMessage(e)) }),
      },
    ]);

  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching} footer={<Button title="Apply for leave" onPress={() => navigation.navigate('NewStaffLeave')} />}>
      <QueryView query={q}>
        {rows =>
          rows.length === 0 ? (
            <EmptyState title="No leave requests" body="Your applications and their approval history appear here." />
          ) : (
            rows.map(l => {
              const st = STAFF_STATUS[l.status];
              return (
                <Card key={l.id} className="mb-2">
                  <View className="flex-row items-center justify-between">
                    <Text variant="subheading">{STAFF_TYPE_LABEL[l.leave_type]}</Text>
                    <Text className={`text-sm font-semibold ${st.cls}`}>{st.label}</Text>
                  </View>
                  <Text variant="muted">{dateRange(l.from_date, l.to_date)}</Text>
                  <Text className="mt-1" numberOfLines={3}>
                    {l.reason}
                  </Text>
                  <Text variant="caption" className="mt-1">
                    Applied {instant(l.created_at)}
                    {l.decided_at ? ` · decided ${instant(l.decided_at)}` : ''}
                    {l.status === 'approved' ? (l.substitute_arranged ? ' · substitute arranged' : ' · substitute not arranged yet') : ''}
                  </Text>
                  {l.status === 'pending' ? (
                    <Pressable accessibilityRole="button" onPress={() => confirmCancel(l)} className="mt-2 min-h-8 justify-center" hitSlop={6}>
                      <Text className="text-sm font-medium text-danger">Cancel request</Text>
                    </Pressable>
                  ) : null}
                </Card>
              );
            })
          )
        }
      </QueryView>
    </Screen>
  );
}

export function NewStaffLeaveScreen({ navigation }: StackProps<'NewStaffLeave'>) {
  const apply = useApplyStaffLeave();
  const today = istDate();
  const [type, setType] = useState<StaffLeaveType>('casual');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (reason.trim().length < 5) {
      setError('Give a reason of at least 5 characters.');
      return;
    }
    try {
      await apply.mutateAsync({ type, from, to, reason: reason.trim() });
      navigation.goBack();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Screen footer={<Button title="Submit request" onPress={submit} loading={apply.isPending} />}>
      <Text variant="label" className="mb-2">
        Type
      </Text>
      <Segmented<StaffLeaveType>
        value={type}
        onChange={setType}
        options={(Object.keys(STAFF_TYPE_LABEL) as StaffLeaveType[]).map(k => ({ value: k, label: STAFF_TYPE_LABEL[k] }))}
      />
      <View className="mt-4">
        <DateField
          label="From"
          value={from}
          min={addDays(today, -7)}
          max={addDays(today, 180)}
          onChange={d => {
            setFrom(d);
            if (to < d) {
              setTo(d);
            }
          }}
        />
        <DateField label="To" value={to} min={from} max={addDays(today, 180)} onChange={setTo} />
      </View>
      <TextField label="Reason" multiline value={reason} onChangeText={setReason} maxLength={500} />
      <Text variant="caption">Your HOD approves the request and arranges substitutes for your lectures.</Text>
      {error ? <Text className="mt-2 text-sm text-danger">{error}</Text> : null}
    </Screen>
  );
}

// ── Class announcement ────────────────────────────────────────────────────
type Priority = 'normal' | 'important' | 'urgent';
const formSchema = announcementSchema.pick({ title: true, body: true, priority: true });

export function NewAnnouncementScreen({ navigation }: StackProps<'NewAnnouncement'>) {
  const { divisions, isPending } = useAnnouncementDivisions();
  const create = useCreateAnnouncement();
  const options = [...divisions.entries()];
  const [divisionId, setDivisionId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [includeParents, setIncludeParents] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const only = options.length === 1 ? options[0][0] : null;
  useEffect(() => {
    if (only && !divisionId) {
      setDivisionId(only);
    }
  }, [only, divisionId]);

  const submit = async () => {
    const parsed = formSchema.safeParse({ title, body, priority });
    const next: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        next[String(issue.path[0])] ??= issue.message;
      }
    }
    if (!divisionId) {
      next.division = 'Choose a class';
    }
    setErrors(next);
    if (!parsed.success || !divisionId) {
      return;
    }
    try {
      const res = await create.mutateAsync({ divisionId, ...parsed.data, includeParents });
      Alert.alert('Announcement sent', `Delivered to ${res.recipients} ${res.recipients === 1 ? 'person' : 'people'}.`);
      navigation.goBack();
    } catch (e) {
      setErrors({ form: errorMessage(e) });
    }
  };

  if (!isPending && options.length === 0) {
    return (
      <Screen>
        <EmptyState title="No classes to announce to" body="You can post to divisions you teach or are class teacher of." />
      </Screen>
    );
  }

  return (
    <Screen footer={<Button title="Send announcement" onPress={submit} loading={create.isPending} />}>
      <Text variant="label" className="mb-2">
        Class
      </Text>
      <View className="mb-4">
        {options.map(([id, label]) => (
          <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityState={{ selected: id === divisionId }}
            onPress={() => setDivisionId(id)}
            className={`mb-2 min-h-12 justify-center rounded-md border px-3 ${id === divisionId ? 'border-primary bg-primary/10' : 'border-line bg-surface'}`}
          >
            <Text>{label}</Text>
          </Pressable>
        ))}
        {errors.division ? <Text className="text-sm text-danger">{errors.division}</Text> : null}
      </View>
      <TextField label="Title" value={title} onChangeText={setTitle} maxLength={140} error={errors.title} />
      <TextField label="Message" multiline value={body} onChangeText={setBody} maxLength={4000} error={errors.body} />
      <Text variant="label" className="mb-2">
        Priority
      </Text>
      <Segmented<Priority>
        value={priority}
        onChange={setPriority}
        options={[
          { value: 'normal', label: 'Normal' },
          { value: 'important', label: 'Important' },
          { value: 'urgent', label: 'Urgent' },
        ]}
      />
      <View className="mt-4">
        <ListGroup>
          <ListRow
            title="Also send to parents"
            subtitle="Verified guardians of students in this class"
            last
            right={<Switch value={includeParents} onValueChange={setIncludeParents} accessibilityLabel="Also send to parents" />}
          />
        </ListGroup>
      </View>
      {errors.form ? <Text className="mt-2 text-sm text-danger">{errors.form}</Text> : null}
    </Screen>
  );
}

// ── HOD summary (read-only, §8.3) ─────────────────────────────────────────
export function HodSummaryScreen() {
  const caps = useSession(s => s.caps);
  const departments = caps?.hod_of ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const departmentId = selected ?? departments[0]?.department_id ?? null;
  const today = istDate();
  const q = useHodSummary(departmentId, today);

  if (departments.length === 0) {
    return (
      <Screen>
        <EmptyState title="Department summary" body="This view is for heads of department." />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      {departments.length > 1 && departmentId ? (
        <View className="mb-3">
          <Segmented value={departmentId} onChange={setSelected} options={departments.map(d => ({ value: d.department_id, label: d.code }))} />
        </View>
      ) : null}
      <QueryView query={q}>
        {({ counts, faculty, divisions }) => (
          <>
            <SectionTitle>Today's registers</SectionTitle>
            <Card>
              <Row label="Submitted / scheduled" value={`${counts.held} / ${counts.total}`} />
              <Row label="Due, not submitted" value={String(counts.pending)} />
              <Row label="Missing (locked)" value={String(counts.missing)} />
              <Row label="Late" value={String(counts.late)} />
              <Row label="Cancelled" value={String(counts.cancelled)} />
              <Row label="Present" value={counts.roster > 0 ? pct((counts.present / counts.roster) * 100) : '—'} />
            </Card>
            {counts.missing > 0 ? (
              <View className="mt-3">
                <Banner tone="warn">{`${counts.missing} ${counts.missing === 1 ? 'register is' : 'registers are'} missing. Reopen them on the web portal.`}</Banner>
              </View>
            ) : null}

            <SectionTitle>Faculty submissions · last 7 days</SectionTitle>
            {faculty.length === 0 ? (
              <Text variant="muted">No sessions in the last 7 days.</Text>
            ) : (
              <ListGroup>
                {faculty.map((f, i) => (
                  <ListRow
                    key={f.staff_id}
                    title={f.full_name}
                    subtitle={`${f.on_time} on time · ${f.late} late · ${f.missing} missing${f.pending ? ` · ${f.pending} due` : ''}`}
                    last={i === faculty.length - 1}
                    right={<Text variant="label">{pct(f.on_time_percent)}</Text>}
                  />
                ))}
              </ListGroup>
            )}

            <SectionTitle>Divisions</SectionTitle>
            {divisions.length === 0 ? (
              <Text variant="muted">No divisions.</Text>
            ) : (
              <ListGroup>
                {divisions.map((d, i) => (
                  <ListRow
                    key={d.division_id}
                    title={d.label}
                    subtitle={`${d.students} students · ${d.shortage} below the minimum`}
                    last={i === divisions.length - 1}
                    right={<Text variant="label">{pct(d.percent)}</Text>}
                  />
                ))}
              </ListGroup>
            )}
            <Text variant="caption" className="mt-4">
              Full HOD tools (reopening registers, substitutes, approvals) are on the web portal.
            </Text>
          </>
        )}
      </QueryView>
    </Screen>
  );
}
