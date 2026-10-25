// Student experience (§10).
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/Card';
import { EmptyState, QueryView, SectionTitle } from '../../components/feedback';
import { ListGroup, ListRow } from '../../components/ListRow';
import { Screen } from '../../components/Screen';
import { Segmented } from '../../components/Segmented';
import { Text } from '../../components/Text';
import { useSummary, useTimetable } from '../../features/attendance/api';
import { AttendanceOverview, ShortageBanners, SubjectSummaryRow } from '../../features/attendance/components';
import { currentTerm } from '../../features/attendance/derive';
import { SessionLine, TimetableView } from '../../features/attendance/TimetableView';
import { useAnnouncements, useExams, useScopeStudentId, useStatusCodes } from '../../features/common/hooks';
import { clock, day, istDay } from '../../lib/format';
import { istDate } from '../../shared/dates';
import type { StudentStackParamList, StudentTabParamList } from '../../navigation/types';
import { confirmSignOut } from '../shared/SettingsScreen';

type TabProps<T extends keyof StudentTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<StudentTabParamList, T>,
  NativeStackScreenProps<StudentStackParamList>
>;

function useLiveColors() {
  const codes = useStatusCodes();
  return useMemo(() => Object.fromEntries((codes.data ?? []).map(c => [c.code, c.color])), [codes.data]);
}

export function StudentHomeScreen({ navigation }: TabProps<'StuHome'>) {
  const { t } = useTranslation();
  const studentId = useScopeStudentId();
  const summary = useSummary(studentId);
  const today = istDate();
  const timetable = useTimetable(studentId, today, today);
  const exams = useExams(studentId);
  const notices = useAnnouncements();
  const colors = useLiveColors();
  const refresh = () => Promise.all([summary.refetch(), timetable.refetch(), exams.refetch(), notices.refetch()]);
  const upcomingExams = (exams.data ?? []).filter(e => e.starts_at > new Date().toISOString()).slice(0, 3);

  return (
    <Screen onRefresh={refresh} refreshing={summary.isRefetching}>
      <QueryView query={summary}>
        {rows => {
          const term = currentTerm(rows);
          return term.length === 0 ? (
            <EmptyState title="No attendance yet" body="Your percentages appear after the first registers are submitted." />
          ) : (
            <>
              <AttendanceOverview rows={term} />
              <ShortageBanners rows={term} />
            </>
          );
        }}
      </QueryView>

      <SectionTitle>{t('common.today')}</SectionTitle>
      <QueryView query={timetable}>
        {rows => (rows.length === 0 ? <Text variant="muted">No lectures today.</Text> : rows.map(s => <SessionLine key={s.session_id} s={s} statusColors={colors} />))}
      </QueryView>

      {upcomingExams.length > 0 ? (
        <>
          <SectionTitle right={<Text className="text-sm text-primary" onPress={() => navigation.navigate('Exams')}>All</Text>}>
            {t('common.exams')}
          </SectionTitle>
          <ListGroup>
            {upcomingExams.map((e, i) => (
              <ListRow
                key={e.exam_session_id}
                title={e.subject_name}
                subtitle={`${e.exam_type_name} · ${day(istDay(e.starts_at), { weekday: true })}, ${clock(e.starts_at)}`}
                last={i === upcomingExams.length - 1}
              />
            ))}
          </ListGroup>
        </>
      ) : null}

      {(notices.data ?? []).length > 0 ? (
        <>
          <SectionTitle>{t('tabs.notices')}</SectionTitle>
          {(notices.data ?? []).slice(0, 3).map(n => (
            <Card key={n.id} className="mb-2">
              <Text variant="subheading">{n.title}</Text>
              <Text variant="muted" numberOfLines={2}>
                {n.body}
              </Text>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

/** Subject list with a term picker (previous semesters are read-only). Shared with parents. */
export function AttendanceList({ onOpen }: { onOpen: (offeringId: string, title: string) => void }) {
  const studentId = useScopeStudentId();
  const q = useSummary(studentId);
  const [term, setTerm] = useState<string | null>(null);
  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <QueryView query={q} empty={d => d.length === 0}>
        {rows => {
          const terms = [...new Map(rows.map(r => [r.term_id, r])).values()].sort((a, b) => (a.term_status === 'active' ? -1 : b.term_status === 'active' ? 1 : b.term_label.localeCompare(a.term_label)));
          const selected = term ?? currentTerm(rows)[0]?.term_id ?? terms[0]?.term_id;
          const list = rows.filter(r => r.term_id === selected);
          return (
            <>
              {terms.length > 1 ? (
                <View className="mb-3">
                  <Segmented value={selected} onChange={setTerm} options={terms.slice(0, 3).map(t => ({ value: t.term_id, label: t.term_label }))} />
                </View>
              ) : null}
              <AttendanceOverview rows={list} />
              <SectionTitle>Subjects</SectionTitle>
              {list.map(r => (
                <Card key={`${r.offering_id}-${r.component}`} className="mb-2" onPress={() => onOpen(r.offering_id, r.subject_name)} accessibilityLabel={`${r.subject_name} ${r.component}, ${r.percent ?? 0} percent`}>
                  <SubjectSummaryRow row={r} />
                </Card>
              ))}
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}

export function StudentAttendanceScreen({ navigation }: TabProps<'StuAttendance'>) {
  return <AttendanceList onOpen={(offeringId, title) => navigation.navigate('SubjectDetail', { offeringId, title })} />;
}

export function StudentTimetableScreen() {
  const studentId = useScopeStudentId();
  const colors = useLiveColors();
  return (
    <Screen scroll={false}>
      <TimetableView studentId={studentId} statusColors={colors} />
    </Screen>
  );
}

export function StudentMoreScreen({ navigation }: TabProps<'StuMore'>) {
  const { t } = useTranslation();
  return (
    <Screen>
      <ListGroup>
        <ListRow title={t('common.profile')} onPress={() => navigation.navigate('Profile')} />
        <ListRow title="My faculty" onPress={() => navigation.navigate('Faculty')} />
        <ListRow title={t('common.exams')} onPress={() => navigation.navigate('Exams')} />
        <ListRow title={t('common.calendar')} onPress={() => navigation.navigate('Calendar')} />
        <ListRow title="My reported problems" onPress={() => navigation.navigate('MyDisputes')} />
        <ListRow title={t('common.settings')} last onPress={() => navigation.navigate('Settings')} />
      </ListGroup>
      <Text variant="caption" className="mt-4">
        Results, report cards and attendance report downloads arrive with the college's document service.
      </Text>
      <View className="mt-8">
        <ListGroup>
          <ListRow title={t('common.signOut')} last onPress={confirmSignOut} />
        </ListGroup>
      </View>
    </Screen>
  );
}
