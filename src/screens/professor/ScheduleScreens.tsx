// Professor Today (§8.1) and Timetable (§6.1). Session cards come from SQLite
// (the prefetch window, §9.4) with one status each; tapping a card opens the
// screen that status calls for. Timetable weeks outside the window are read
// from the server and are view-only.
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation, type CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Button } from '../../components/Button';
import { Banner, EmptyState, ErrorState, LoadingState, SectionTitle } from '../../components/feedback';
import { Screen } from '../../components/Screen';
import { SessionCard } from '../../components/SessionCard';
import { useTheme } from '../../components/theme';
import { Text } from '../../components/Text';
import { matchesKind, WeekStrip, weekStart, type Kind } from '../../features/attendance/TimetableView';
import { useLocalSessions, useServerSessions, type LocalSession } from '../../features/professor/api';
import { sessionTarget } from '../../features/professor/routing';
import { cardState, pendingCounts, type CardState } from '../../features/professor/sessionState';
import { errorMessage } from '../../lib/errors';
import { day, instant } from '../../lib/format';
import { prefetchWindow, WINDOW_AFTER, WINDOW_BEFORE } from '../../offline/prefetch';
import { syncNow } from '../../offline/service';
import { addDays, istDate, weekday } from '../../shared/dates';
import type { ProfessorStackParamList, ProfessorTabParamList } from '../../navigation/types';
import { useSyncStatus } from '../../stores/sync';
import type { ProfNav } from './common';

type TabProps<T extends keyof ProfessorTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<ProfessorTabParamList, T>,
  NativeStackScreenProps<ProfessorStackParamList>
>;

interface Rated extends LocalSession {
  state: CardState;
}

/** Card statuses depend on the clock (marking opens, edit windows close). */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const isDue = (s: CardState) => s.status === 'markNow' || s.status === 'attention' || s.status === 'missed';

const byStart = (a: LocalSession, b: LocalSession) => a.session.starts_at.localeCompare(b.session.starts_at);

/** Prefetch the window and push the outbox; pull-to-refresh on both tabs. */
function useRefreshWindow() {
  const online = useSyncStatus(s => s.online);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    if (!online) {
      return;
    }
    setRefreshing(true);
    try {
      await Promise.all([prefetchWindow(), syncNow()]);
    } catch (e) {
      Alert.alert('Could not refresh', errorMessage(e));
    } finally {
      setRefreshing(false);
    }
  };
  return { refresh, refreshing, online };
}

/** Pre-checks run again on the target screen; notices (cancelled, rescheduled, not open yet) render there. */
function useOpenSession(now: Date) {
  const navigation = useNavigation<ProfNav>();
  return (s: LocalSession) => {
    const sessionId = s.session.id;
    const target = sessionTarget(s.session, s.local, now);
    if (target.screen === 'Register') {
      navigation.navigate('Register', { sessionId });
    } else if (target.screen === 'Conflict') {
      navigation.navigate('Conflict', { sessionId });
    } else {
      navigation.navigate('MarkAttendance', { sessionId });
    }
  };
}

function CardList({ rows, onOpen }: { rows: Rated[]; onOpen?: (s: LocalSession) => void }) {
  return (
    <>
      {rows.map(r => (
        <SessionCard key={r.session.id} session={r.session} state={r.state} onPress={onOpen ? () => onOpen(r) : undefined} />
      ))}
    </>
  );
}

// ── Today ─────────────────────────────────────────────────────────────────
export function ProfessorTodayScreen(_: TabProps<'ProfToday'>) {
  const now = useNow();
  const today = istDate(now);
  const q = useLocalSessions(addDays(today, -WINDOW_BEFORE), addDays(today, WINDOW_AFTER));
  const lastPrefetchAt = useSyncStatus(s => s.lastPrefetchAt);
  const { refresh, refreshing, online } = useRefreshWindow();
  const open = useOpenSession(now);
  const [dueOnly, setDueOnly] = useState(false);

  const rows = useMemo<Rated[]>(() => (q.data ?? []).map(s => ({ ...s, state: cardState(s.session, s.local, now) })).sort(byStart), [q.data, now]);
  const counts = pendingCounts(rows, today, now);
  const overdue = rows.filter(r => r.session.session_date < today && isDue(r.state));
  const todays = rows.filter(r => r.session.session_date === today && (!dueOnly || (isDue(r.state) && r.session.starts_at <= now.toISOString())));
  const nextDay = rows.find(r => r.session.session_date > today)?.session.session_date;
  const upcoming = nextDay ? rows.filter(r => r.session.session_date === nextDay) : [];
  const recent = rows.filter(r => r.session.session_date < today && !isDue(r.state)).reverse();

  if (!q.data) {
    return <Screen>{q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <LoadingState />}</Screen>;
  }
  if (rows.length === 0) {
    return (
      <Screen onRefresh={refresh} refreshing={refreshing}>
        <EmptyState
          title={lastPrefetchAt ? 'No lectures in the next 7 days' : 'Your sessions are not on this phone yet'}
          body={lastPrefetchAt ? `Sessions downloaded ${instant(lastPrefetchAt)}.` : 'Connect to the internet to download them. Marking then works offline too.'}
          action={<Button variant="secondary" title="Refresh sessions" loading={refreshing} disabled={!online} onPress={refresh} />}
        />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Text variant="caption">{day(today, { weekday: true, year: true })}</Text>

      {counts.today + counts.overdue > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: dueOnly }}
          accessibilityHint={dueOnly ? 'Shows all sessions' : 'Shows only registers still to submit'}
          onPress={() => setDueOnly(v => !v)}
          className="mt-2"
        >
          <Banner tone={counts.overdue > 0 ? 'danger' : 'warn'}>
            <Text variant="label">
              {[counts.today > 0 ? `${counts.today} to submit today` : null, counts.overdue > 0 ? `${counts.overdue} overdue from earlier days` : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <Text variant="caption">{dueOnly ? 'Showing pending only. Tap to show everything.' : 'Tap to show only these.'}</Text>
          </Banner>
        </Pressable>
      ) : null}

      {overdue.length > 0 ? (
        <>
          <SectionTitle>Overdue</SectionTitle>
          <CardList rows={overdue} onOpen={open} />
        </>
      ) : null}

      <SectionTitle>Today</SectionTitle>
      {todays.length === 0 ? (
        <Text variant="muted">{dueOnly ? 'Nothing left to submit today.' : weekday(today) === 0 ? 'Sunday. No lectures today.' : 'No lectures today.'}</Text>
      ) : (
        <CardList rows={todays} onOpen={open} />
      )}

      {!dueOnly && nextDay ? (
        <>
          <SectionTitle>{`Next · ${day(nextDay, { weekday: true })}`}</SectionTitle>
          <CardList rows={upcoming} onOpen={open} />
        </>
      ) : null}

      {!dueOnly && recent.length > 0 ? (
        <>
          <SectionTitle>Recent</SectionTitle>
          <CardList rows={recent} onOpen={open} />
        </>
      ) : null}

      {lastPrefetchAt ? (
        <Text variant="caption" className="mt-4 text-center">
          {`Sessions downloaded ${instant(lastPrefetchAt)}`}
        </Text>
      ) : null}
    </Screen>
  );
}

// ── Timetable ─────────────────────────────────────────────────────────────
export function ProfessorTimetableScreen(_: TabProps<'ProfTimetable'>) {
  const { colors } = useTheme();
  const now = useNow();
  const today = istDate(now);
  const [week, setWeek] = useState(() => weekStart(today));
  const [selected, setSelected] = useState(today);
  const [kind, setKind] = useState<Kind>('all');
  const weekEnd = addDays(week, 6);
  const windowFrom = addDays(today, -WINDOW_BEFORE);
  const windowTo = addDays(today, WINDOW_AFTER);
  const { refresh, refreshing, online } = useRefreshWindow();
  const open = useOpenSession(now);

  // SQLite holds the prefetch window and the last 14 days of own sessions;
  // weeks reaching outside the window also ask the server.
  const local = useLocalSessions(week, weekEnd);
  const outside = week < windowFrom || weekEnd > windowTo;
  const server = useServerSessions(week, weekEnd, outside && online);

  const changeWeek = (w: string) => {
    setWeek(w);
    setSelected(w <= today && today <= addDays(w, 5) ? today : w);
  };

  const rows = useMemo(() => {
    const map = new Map<string, Rated & { stored: boolean }>();
    for (const s of server.data ?? []) {
      map.set(s.id, { session: s, local: undefined, state: cardState(s, undefined, now), stored: false });
    }
    for (const s of local.data ?? []) {
      map.set(s.session.id, { ...s, state: cardState(s.session, s.local, now), stored: true });
    }
    return [...map.values()].filter(r => r.session.session_date === selected && matchesKind(r.session.component, kind)).sort(byStart);
  }, [server.data, local.data, selected, kind, now]);

  const selectedOutside = selected < windowFrom || selected > windowTo;
  const loading = !local.data || (outside && online && server.isPending);
  const pullToRefresh = () => {
    if (outside) {
      server.refetch();
    }
    refresh();
  };

  let body;
  if (loading) {
    body = <LoadingState />;
  } else if (rows.length === 0) {
    body =
      selectedOutside && !online ? (
        <EmptyState title="Not saved on this phone" body="Only the last 2 days and the next 7 days work offline. Connect to the internet to see this day." />
      ) : selectedOutside && server.error ? (
        <ErrorState error={server.error} onRetry={() => server.refetch()} />
      ) : (
        <EmptyState title="No lectures" body={weekday(selected) === 0 ? 'Sunday' : undefined} />
      );
  } else {
    body = (
      <>
        {rows.map(r => (
          <SessionCard key={r.session.id} session={r.session} state={r.state} onPress={r.stored ? () => open(r) : undefined} />
        ))}
        {rows.some(r => !r.stored) ? (
          <Text variant="caption" className="mt-1 text-center">
            Sessions not saved on this phone are view-only. Registers can be opened for the last 14 days and the next 7.
          </Text>
        ) : null}
      </>
    );
  }

  return (
    <Screen scroll={false}>
      <WeekStrip week={week} onWeek={changeWeek} selected={selected} onSelect={setSelected} kind={kind} onKind={setKind} />
      <ScrollView
        contentContainerClassName="p-4 pb-10"
        refreshControl={<RefreshControl refreshing={refreshing || server.isRefetching} onRefresh={pullToRefresh} tintColor={colors.muted} />}
      >
        {body}
      </ScrollView>
    </Screen>
  );
}
