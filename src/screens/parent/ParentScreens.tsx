// Parent experience (§11). Every query is keyed by the selected child.
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react-native';
import { Card } from '../../components/Card';
import { Banner, EmptyState, QueryView, SectionTitle } from '../../components/feedback';
import { ListGroup, ListRow } from '../../components/ListRow';
import { Screen } from '../../components/Screen';
import { Segmented } from '../../components/Segmented';
import { Sheet } from '../../components/Sheet';
import { StatusPill } from '../../components/StatusPill';
import { useTheme } from '../../components/theme';
import { Text } from '../../components/Text';
import { useChildren, useLeave, useRecentRecords, useSummary } from '../../features/attendance/api';
import { AttendanceOverview, ShortageBanners } from '../../features/attendance/components';
import { currentTerm } from '../../features/attendance/derive';
import { TimetableView } from '../../features/attendance/TimetableView';
import { useAnnouncements, useMarkAnnouncementRead, useScopeStudentId, useStatusCodes } from '../../features/common/hooks';
import { day, instant, timeRange } from '../../lib/format';
import { addDays, istDate } from '../../shared/dates';
import type { ParentStackParamList, ParentTabParamList } from '../../navigation/types';
import { useSession, useUserId } from '../../stores/session';
import { AttendanceList } from '../student/StudentScreens';
import { LeaveCard } from '../student/LeaveScreens';
import { confirmSignOut } from '../shared/SettingsScreen';

type TabProps<T extends keyof ParentTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<ParentTabParamList, T>,
  NativeStackScreenProps<ParentStackParamList>
>;

function useLiveColors() {
  const codes = useStatusCodes();
  return useMemo(() => Object.fromEntries((codes.data ?? []).map(c => [c.code, c.color])), [codes.data]);
}

/** Header child switcher: verified links only, last choice remembered (§11). */
export function ChildSwitcher() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const userId = useUserId();
  const children = useChildren(userId);
  const childId = useSession(s => s.childId);
  const [open, setOpen] = useState(false);
  const current = children.data?.find(c => c.student_id === childId);
  const many = (children.data?.length ?? 0) > 1;
  return (
    <>
      <Pressable
        accessibilityRole={many ? 'button' : 'text'}
        accessibilityLabel={many ? `${current?.full_name ?? ''}. ${t('parent.switchChild')}` : current?.full_name}
        disabled={!many}
        onPress={() => setOpen(true)}
        className="flex-row items-center"
        hitSlop={8}
      >
        <View>
          <Text variant="subheading" numberOfLines={1}>
            {current?.full_name.split(' ')[0] ?? ''}
          </Text>
          {current?.division_label ? <Text variant="caption">{current.division_label}</Text> : null}
        </View>
        {many ? (
          <View className="ml-1">
            <ChevronDown size={18} color={colors.ink} />
          </View>
        ) : null}
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={t('parent.switchChild')}>
        {(children.data ?? []).map(c => (
          <Pressable
            key={c.student_id}
            accessibilityRole="button"
            accessibilityState={{ selected: c.student_id === childId }}
            onPress={() => {
              useSession.getState().setChild(c.student_id);
              setOpen(false);
            }}
            className={`mb-2 min-h-14 justify-center rounded-md border px-4 ${c.student_id === childId ? 'border-primary bg-primary/10' : 'border-line'}`}
          >
            <Text variant="subheading">{c.full_name}</Text>
            <Text variant="caption">{[c.division_label, c.roll_no ? `Roll ${c.roll_no}` : null].filter(Boolean).join(' · ')}</Text>
          </Pressable>
        ))}
      </Sheet>
    </>
  );
}

export function ParentHomeScreen({ navigation }: TabProps<'ParHome'>) {
  const { t } = useTranslation();
  const studentId = useScopeStudentId();
  const today = istDate();
  const summary = useSummary(studentId);
  const todayRows = useRecentRecords(studentId, today, today);
  const colors = useLiveColors();
  const marked = (todayRows.data ?? []).filter(r => r.my_status);
  const present = marked.filter(r => r.my_status === 'P' || r.my_status === 'OD').length;
  const absent = marked.filter(r => r.my_status === 'A');

  return (
    <Screen onRefresh={() => Promise.all([summary.refetch(), todayRows.refetch()])} refreshing={summary.isRefetching}>
      <SectionTitle>{t('parent.todaySoFar')}</SectionTitle>
      <Card>
        {marked.length === 0 ? (
          <Text variant="muted">{t('parent.noLecturesYet')}</Text>
        ) : (
          <>
            <Text variant="subheading">{t('parent.presentOf', { present, marked: marked.length })}</Text>
            {absent.map(a => (
              <Pressable
                key={a.session_id}
                accessibilityRole="button"
                onPress={() => navigation.navigate('SubjectDetail', { offeringId: a.offering_id, title: a.subject_name })}
                className="mt-2 flex-row items-center"
              >
                <StatusPill code="A" color={colors.A} size="sm" />
                <Text className="ml-2 flex-1 text-danger">{t('parent.absentIn', { subject: a.subject_name, time: timeRange(a.start_time, a.end_time) })}</Text>
              </Pressable>
            ))}
          </>
        )}
      </Card>
      <QueryView query={summary}>
        {rows => {
          const term = currentTerm(rows);
          if (term.length === 0) {
            return null;
          }
          return (
            <>
              <SectionTitle>{t('common.overall')}</SectionTitle>
              <AttendanceOverview rows={term} />
              <ShortageBanners rows={term} />
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}

type AttendanceView = 'subjects' | 'absences' | 'leave';

export function ParentAttendanceScreen({ navigation }: TabProps<'ParAttendance'>) {
  const { t } = useTranslation();
  const [view, setView] = useState<AttendanceView>('subjects');
  const studentId = useScopeStudentId();
  const today = istDate();
  const history = useRecentRecords(studentId, addDays(today, -60), today);
  const leave = useLeave(studentId);
  const colors = useLiveColors();

  return (
    <View className="flex-1 bg-canvas">
      <View className="px-4 pt-3">
        <Segmented<AttendanceView>
          value={view}
          onChange={setView}
          options={[
            { value: 'subjects', label: 'Subjects' },
            { value: 'absences', label: t('parent.absences') },
            { value: 'leave', label: t('parent.approvedLeave') },
          ]}
        />
      </View>
      {view === 'subjects' ? (
        <AttendanceList onOpen={(offeringId, title) => navigation.navigate('SubjectDetail', { offeringId, title })} />
      ) : view === 'absences' ? (
        <Screen onRefresh={() => history.refetch()} refreshing={history.isRefetching}>
          <QueryView query={history}>
            {rows => {
              const absences = rows.filter(r => r.my_status === 'A');
              return absences.length === 0 ? (
                <EmptyState title="No absences in the last 60 days" />
              ) : (
                <ListGroup>
                  {absences.map((r, i) => (
                    <ListRow
                      key={r.session_id}
                      title={`${r.subject_name} · ${r.component}`}
                      subtitle={`${day(r.session_date, { weekday: true })}, ${timeRange(r.start_time, r.end_time)}`}
                      left={<StatusPill code="A" color={colors.A} size="sm" />}
                      last={i === absences.length - 1}
                      onPress={() => navigation.navigate('SubjectDetail', { offeringId: r.offering_id, title: r.subject_name })}
                    />
                  ))}
                </ListGroup>
              );
            }}
          </QueryView>
        </Screen>
      ) : (
        <Screen onRefresh={() => leave.refetch()} refreshing={leave.isRefetching}>
          <QueryView query={leave}>
            {rows => {
              const list = rows.filter(l => l.status === 'approved' || l.status === 'pending');
              return list.length === 0 ? <EmptyState title={t('common.nothingHere')} /> : list.map(l => <LeaveCard key={l.id} l={l} />);
            }}
          </QueryView>
        </Screen>
      )}
    </View>
  );
}

export function ParentScheduleScreen({ navigation }: TabProps<'ParSchedule'>) {
  const { t } = useTranslation();
  const studentId = useScopeStudentId();
  const colors = useLiveColors();
  return (
    <View className="flex-1 bg-canvas">
      <View className="flex-row gap-2 px-4 pt-3">
        <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Exams')} className="min-h-10 flex-1 items-center justify-center rounded-md border border-line bg-surface">
          <Text variant="label">{t('common.exams')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Calendar')} className="min-h-10 flex-1 items-center justify-center rounded-md border border-line bg-surface">
          <Text variant="label">{t('common.calendar')}</Text>
        </Pressable>
      </View>
      <TimetableView studentId={studentId} statusColors={colors} />
    </View>
  );
}

export function NoticesScreen() {
  const { t } = useTranslation();
  const q = useAnnouncements();
  const markRead = useMarkAnnouncementRead();
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <QueryView query={q}>
        {rows =>
          rows.length === 0 ? (
            <EmptyState title={t('common.nothingHere')} />
          ) : (
            rows.map(n => {
              const open = openId === n.id;
              return (
                <Card
                  key={n.id}
                  className={`mb-2 ${n.priority === 'urgent' ? 'border-danger/60' : n.priority === 'important' ? 'border-warn/60' : ''}`}
                  onPress={() => {
                    setOpenId(open ? null : n.id);
                    if (!n.read_at) {
                      markRead.mutate(n.id);
                    }
                  }}
                  accessibilityLabel={`${n.read_at ? '' : 'Unread. '}${n.title}`}
                >
                  <View className="flex-row items-center">
                    {!n.read_at ? <View className="mr-2 h-2 w-2 rounded-full bg-primary" /> : null}
                    <Text variant="subheading" className="flex-1">
                      {n.title}
                    </Text>
                  </View>
                  <Text variant="caption">
                    {n.author_name} · {instant(n.publish_at)}
                  </Text>
                  <Text variant="body" className="mt-1" numberOfLines={open ? undefined : 3}>
                    {n.body}
                  </Text>
                </Card>
              );
            })
          )
        }
      </QueryView>
    </Screen>
  );
}

export function ParentMoreScreen({ navigation }: TabProps<'ParMore'>) {
  const { t } = useTranslation();
  return (
    <Screen>
      <ListGroup>
        <ListRow title={t('common.profile')} onPress={() => navigation.navigate('Profile')} />
        <ListRow title="Faculty" onPress={() => navigation.navigate('Faculty')} />
        <ListRow title="My questions" onPress={() => navigation.navigate('MyDisputes')} />
        <ListRow title={t('parent.preferences')} onPress={() => navigation.navigate('NotificationPreferences')} />
        <ListRow title={t('common.notifications')} onPress={() => navigation.navigate('Notifications')} />
        <ListRow title={t('common.settings')} last onPress={() => navigation.navigate('Settings')} />
      </ListGroup>
      <View className="mt-4">
        <Banner>{t('parent.contactUpdate')}</Banner>
      </View>
      <View className="mt-8">
        <ListGroup>
          <ListRow title={t('common.signOut')} last onPress={confirmSignOut} />
        </ListGroup>
      </View>
    </Screen>
  );
}

/** Parent with no verified link (the server would refuse anything else anyway). */
export function NoChildrenScreen() {
  const { t } = useTranslation();
  return (
    <Screen topInset>
      <View className="mt-16">
        <EmptyState title={t('parent.noChildren')} />
        <ListGroup>
          <ListRow title={t('common.signOut')} last onPress={confirmSignOut} />
        </ListGroup>
      </View>
    </Screen>
  );
}
