// Calendar, exams and notification preferences: shared by students and parents
// (exams/preferences also by professors).
import { Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/Card';
import { Banner, EmptyState, QueryView, SectionTitle } from '../../components/feedback';
import { ListGroup, ListRow } from '../../components/ListRow';
import { Screen } from '../../components/Screen';
import { Segmented } from '../../components/Segmented';
import { Text } from '../../components/Text';
import {
  PREF_EVENTS,
  useCalendar,
  useExams,
  useNotificationPreferences,
  useScopeStudentId,
  useSetPreference,
} from '../../features/common/hooks';
import { clock, dateRange, day, istDay } from '../../lib/format';
import { istDate } from '../../shared/dates';
import { useSession } from '../../stores/session';

const KIND_LABEL = { holiday: 'Holiday', exam: 'Exams', event: 'Event', working_override: 'Working day' } as const;

export function CalendarScreen() {
  const q = useCalendar();
  const today = istDate();
  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <QueryView query={q} empty={d => d.length === 0}>
        {events => {
          const upcoming = events.filter(e => e.ends_on >= today);
          const past = events.filter(e => e.ends_on < today);
          return (
            <>
              <SectionTitle>Upcoming</SectionTitle>
              {upcoming.length === 0 ? <Text variant="muted">No upcoming events.</Text> : null}
              <ListGroup>
                {upcoming.map((e, i) => (
                  <ListRow key={e.id} title={e.title} subtitle={`${KIND_LABEL[e.kind]} · ${dateRange(e.starts_on, e.ends_on)}`} last={i === upcoming.length - 1} />
                ))}
              </ListGroup>
              {past.length > 0 ? (
                <>
                  <SectionTitle>Earlier this year</SectionTitle>
                  <ListGroup>
                    {past
                      .slice()
                      .reverse()
                      .map((e, i, arr) => (
                        <ListRow key={e.id} title={e.title} subtitle={`${KIND_LABEL[e.kind]} · ${dateRange(e.starts_on, e.ends_on)}`} last={i === arr.length - 1} />
                      ))}
                  </ListGroup>
                </>
              ) : null}
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}

export function ExamsScreen() {
  const studentId = useScopeStudentId();
  const q = useExams(studentId);
  const { t } = useTranslation();
  if (!studentId) {
    return (
      <Screen>
        <EmptyState title={t('common.nothingHere')} body="Exam duties are listed on the web portal for now." />
      </Screen>
    );
  }
  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <QueryView query={q} empty={d => d.length === 0}>
        {exams => {
          const byExam = new Map<string, typeof exams>();
          for (const e of exams) {
            byExam.set(e.exam_title, [...(byExam.get(e.exam_title) ?? []), e]);
          }
          return [...byExam.entries()].map(([title, papers]) => (
            <View key={title}>
              <SectionTitle>{`${title} · ${papers[0].exam_type_name}`}</SectionTitle>
              {papers.map(p => (
                <Card key={p.exam_session_id} className="mb-2">
                  <Text variant="subheading">{p.subject_name}</Text>
                  <Text variant="muted">
                    {day(istDay(p.starts_at), { weekday: true })} · {clock(p.starts_at)} – {clock(p.ends_at)}
                    {p.room_label ? ` · Room ${p.room_label}` : ''}
                  </Text>
                  {p.my_status ? <Text variant="caption">Attendance: {p.my_status}</Text> : null}
                </Card>
              ))}
            </View>
          ));
        }}
      </QueryView>
    </Screen>
  );
}

export function NotificationPreferencesScreen() {
  const { t } = useTranslation();
  const route = useSession(s => s.route);
  const q = useNotificationPreferences();
  const setPref = useSetPreference();
  const pref = (event: string) => q.data?.find(p => p.event === event && p.channel === 'push');
  const absence = pref(PREF_EVENTS.absence);
  const shortage = pref(PREF_EVENTS.shortage);

  return (
    <Screen>
      {route === 'parent' ? (
        <>
          <SectionTitle>{t('status.A')}</SectionTitle>
          <Segmented
            value={absence?.mode ?? 'instant'}
            options={[
              { value: 'instant', label: 'Instant' },
              { value: 'digest', label: 'Daily 6:30 PM' },
            ]}
            onChange={mode => setPref.mutate({ event: PREF_EVENTS.absence, enabled: true, mode })}
          />
          <Text variant="caption" className="mt-2">
            {(absence?.mode ?? 'instant') === 'instant' ? t('parent.absenceInstant') : t('parent.absenceDigest')}
          </Text>
        </>
      ) : null}
      <SectionTitle>Alerts</SectionTitle>
      <ListGroup>
        <ListRow
          title={route === 'parent' ? t('parent.shortageAlerts') : 'Shortage warnings'}
          last
          right={
            <Switch
              value={shortage?.enabled ?? true}
              onValueChange={enabled => setPref.mutate({ event: PREF_EVENTS.shortage, enabled })}
              accessibilityLabel="Shortage alerts"
            />
          }
        />
      </ListGroup>
      <View className="mt-6">
        <Banner>
          Attendance, leave and timetable changes always appear in the notification centre. Each alert type can also be tuned in your phone's notification settings.
        </Banner>
      </View>
      {route === 'parent' ? (
        <Text variant="caption" className="mt-4">
          {t('parent.contactUpdate')}
        </Text>
      ) : null}
    </Screen>
  );
}
