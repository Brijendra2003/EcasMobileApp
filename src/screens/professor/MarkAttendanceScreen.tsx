// Marking (§8.2): pre-checks, roster from SQLite with every tap autosaved to
// the draft, bulk actions, roll search, then a confirmation sheet and Submit
// (freeze → outbox → sync now if online). Read-only while queued or syncing.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';
import { LayoutGrid, List, Search } from 'lucide-react-native';
import { Button } from '../../components/Button';
import { Banner, EmptyState, LoadingState } from '../../components/feedback';
import { RosterRow, RosterTile } from '../../components/RosterRow';
import { Screen } from '../../components/Screen';
import { Sheet } from '../../components/Sheet';
import { StatusPill } from '../../components/StatusPill';
import { useTheme } from '../../components/theme';
import { Text } from '../../components/Text';
import { useRegisterDetail } from '../../features/professor/api';
import { absentRolls, countMarks, findRoll, type Marks, type RosterEntry } from '../../features/marking/logic';
import { useMarking } from '../../features/marking/store';
import { submitRegister } from '../../features/marking/submit';
import { canEdit, canMark } from '../../features/professor/sessionState';
import { sessionTarget } from '../../features/professor/routing';
import { errorMessage } from '../../lib/errors';
import { clock, day, istDay } from '../../lib/format';
import { PREF, secureStore } from '../../lib/storage';
import { getMarks, getRegister, getRoster, getSession, openDraft } from '../../offline/repo';
import { refreshSession } from '../../offline/prefetch';
import { syncNow } from '../../offline/service';
import type { ProfessorStackParamList } from '../../navigation/types';
import { useSyncStatus } from '../../stores/sync';
import type { MySessionRow } from '../../types/database';
import { routeAfterSubmit, sessionLine, useLiveColors, useSettable, type SettableStatus } from './common';

type Props = NativeStackScreenProps<ProfessorStackParamList, 'MarkAttendance'>;
type Layout = 'list' | 'grid';

const styles = StyleSheet.create({ grid: { padding: 8 } });

type Prepared =
  | { kind: 'redirect'; screen: 'Register' | 'Conflict' }
  | { kind: 'notice'; title: string; body: string; nextSessionId?: string; register?: boolean }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; session: MySessionRow; readOnly: boolean; roster: RosterEntry[]; marks: Marks };

/**
 * Pre-checks (§8.2), cached and live when online: cancelled / rescheduled →
 * notice, submitted elsewhere → register, conflict → conflict screen. Then
 * opens (or resumes) the draft. An edit of a register that changed since it was
 * last on this phone starts from the server's marks.
 */
async function prepare(sessionId: string, edit: boolean, serverMarks: () => Promise<Marks>): Promise<Prepared> {
  const online = useSyncStatus.getState().online;
  let session = await getSession(sessionId);
  if (online) {
    try {
      session = (await refreshSession(sessionId)) ?? session;
    } catch {
      // Use the cached copy.
    }
  }
  if (!session) {
    return { kind: 'error', message: 'This session is not on this phone yet. Connect to the internet and pull to refresh on Today.' };
  }
  const local = (await getRegister(sessionId)) ?? undefined;
  const now = new Date();
  const target = sessionTarget(session, local, now);
  if (target.screen === 'notice') {
    return { kind: 'notice', title: target.title, body: target.body, nextSessionId: target.nextSessionId };
  }
  if (target.screen === 'Conflict') {
    return { kind: 'redirect', screen: 'Conflict' };
  }
  if (target.screen === 'Register' && !(edit && canEdit(session, now))) {
    return { kind: 'redirect', screen: 'Register' };
  }
  const readOnly = local?.state === 'queued' || local?.state === 'syncing';
  if (!readOnly && !canMark(session, now)) {
    if (now.getTime() < new Date(session.marking_opens_at).getTime()) {
      return {
        kind: 'notice',
        title: 'Marking is not open yet',
        body: `Marking opens at ${clock(session.marking_opens_at)} on ${day(istDay(session.marking_opens_at), { weekday: true })}.`,
      };
    }
    return { kind: 'notice', title: 'The edit window has closed', body: 'This register can no longer be edited. Open it to request a correction.', register: true };
  }
  if (!readOnly) {
    const version = session.register_version ?? 0;
    const stale = !!session.submitted_at && (!local || (local.state === 'synced' && local.base_version !== version));
    let seed: Marks | undefined;
    if (stale) {
      if (!online) {
        return { kind: 'error', message: 'This register changed since it was last on this phone. Connect to the internet to edit it.' };
      }
      seed = await serverMarks();
    }
    await openDraft(sessionId, version, seed);
  }
  const [roster, marks] = await Promise.all([getRoster(sessionId), getMarks(sessionId)]);
  return { kind: 'ready', session, readOnly, roster, marks };
}

export function MarkAttendanceScreen({ route, navigation }: Props) {
  const { sessionId, edit = false } = route.params;
  const settable = useSettable();
  const detail = useRegisterDetail(sessionId);
  const detailRef = useRef(detail.refetch);
  detailRef.current = detail.refetch;
  const settableRef = useRef(settable.set);
  settableRef.current = settable.set;
  const [phase, setPhase] = useState<Prepared | { kind: 'loading' }>({ kind: 'loading' });

  useEffect(() => {
    let alive = true;
    const serverMarks = async (): Promise<Marks> => {
      const res = await detailRef.current();
      if (res.error || !res.data) {
        throw res.error ?? new Error('Register not available');
      }
      return Object.fromEntries(res.data.filter(r => settableRef.current.has(r.status_code)).map(r => [r.student_id, r.status_code]));
    };
    prepare(sessionId, edit, serverMarks)
      .then(p => {
        if (!alive) {
          return;
        }
        if (p.kind === 'redirect') {
          navigation.replace(p.screen, { sessionId });
          return;
        }
        if (p.kind === 'ready') {
          useMarking.getState().load(sessionId, p.roster, p.marks, p.readOnly);
          navigation.setOptions({ title: p.session.subject_name });
        }
        setPhase(p);
      })
      .catch(e => alive && setPhase({ kind: 'error', message: errorMessage(e) }));
    return () => {
      alive = false;
      useMarking.getState().clear();
    };
  }, [sessionId, edit, navigation]);

  if (phase.kind === 'loading' || phase.kind === 'redirect') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (phase.kind === 'error') {
    return (
      <Screen>
        <EmptyState title={phase.message} action={<Button variant="secondary" title="Back" onPress={() => navigation.goBack()} />} />
      </Screen>
    );
  }
  if (phase.kind === 'notice') {
    const next = phase.nextSessionId;
    return (
      <Screen>
        <EmptyState
          title={phase.title}
          body={phase.body}
          action={
            next ? (
              <Button title="Open the new session" onPress={() => navigation.replace('MarkAttendance', { sessionId: next })} />
            ) : phase.register ? (
              <Button title="Open register" onPress={() => navigation.replace('Register', { sessionId })} />
            ) : (
              <Button variant="secondary" title="Back" onPress={() => navigation.goBack()} />
            )
          }
        />
      </Screen>
    );
  }
  return <Marking session={phase.session} readOnly={phase.readOnly} settable={settable} navigation={navigation} />;
}

function Counters({ roster }: { roster: RosterEntry[] }) {
  const marks = useMarking(s => s.marks);
  const c = countMarks(roster, marks);
  return (
    <Text accessibilityLiveRegion="polite" className="text-sm font-semibold text-ink">
      P {c.P} · A {c.A} · L {c.L}
      {c.other > 0 ? ` · Other ${c.other}` : ''} · Pending {c.pending}
    </Text>
  );
}

function initialLayout(): Layout {
  try {
    return secureStore().getString(PREF.rosterLayout) === 'grid' ? 'grid' : 'list';
  } catch {
    return 'list';
  }
}

interface MarkingProps {
  session: MySessionRow;
  readOnly: boolean;
  settable: { list: SettableStatus[]; set: Set<string> };
  navigation: Props['navigation'];
}

function Marking({ session, readOnly, settable, navigation }: MarkingProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const live = useLiveColors();
  const { width } = useWindowDimensions();
  const roster = useMarking(s => s.roster);
  const listRef = useRef<FlashListRef<RosterEntry>>(null);
  const [layout, setLayoutState] = useState<Layout>(initialLayout);
  const [query, setQuery] = useState('');
  const [noMatch, setNoMatch] = useState(false);
  const [sheetFor, setSheetFor] = useState<RosterEntry | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const columns = Math.max(4, Math.floor((width - 16) / 76));
  const statusLabel = useCallback((code: string) => t(`status.${code}`, { defaultValue: code }), [t]);

  const setLayout = (l: Layout) => {
    setLayoutState(l);
    try {
      secureStore().set(PREF.rosterLayout, l);
    } catch {
      // Preference only.
    }
  };

  const jump = (q: string) => {
    setQuery(q);
    const index = findRoll(roster, q);
    setNoMatch(q.trim() !== '' && index < 0);
    if (index >= 0) {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 });
    }
  };

  const openSheet = useCallback((entry: RosterEntry) => setSheetFor(entry), []);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const { roster: r, marks } = useMarking.getState();
      await submitRegister({ sessionId: session.id, roster: r, marks, settable: settable.set });
      setConfirm(false);
      await routeAfterSubmit(navigation, session.id);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const syncAndShow = async () => {
    await syncNow(true).catch(() => null);
    await routeAfterSubmit(navigation, session.id);
  };

  if (roster.length === 0) {
    return (
      <Screen>
        <EmptyState title="No roster on this phone" body="Connect to the internet and open this session again to download the student list." />
      </Screen>
    );
  }

  return (
    <Screen
      scroll={false}
      footer={
        readOnly ? (
          <Button variant="secondary" title="Waiting to sync · Sync now" onPress={syncAndShow} />
        ) : (
          <Button title={t('common.submit')} onPress={() => setConfirm(true)} disabled={submitting} loading={submitting} />
        )
      }
    >
      <View className="border-b border-line bg-surface px-4 pb-3 pt-2">
        <Text variant="muted" numberOfLines={1}>
          {sessionLine(session)}
        </Text>
        <Counters roster={roster} />
        {readOnly ? (
          <View className="mt-2">
            <Banner tone="warn">Submitted and waiting to sync. Marks can't be changed until the server has them.</Banner>
          </View>
        ) : null}
        <View className="mt-3 flex-row items-center gap-2">
          <View className="h-10 flex-1 flex-row items-center rounded-md border border-line bg-canvas px-2">
            <Search size={16} color={colors.muted} />
            <TextInput
              accessibilityLabel="Jump to roll number"
              placeholder="Roll no. or name"
              placeholderTextColor={colors.muted}
              value={query}
              onChangeText={jump}
              keyboardType="default"
              returnKeyType="search"
              className="ml-2 flex-1 text-base text-ink"
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={layout === 'list' ? 'Show as grid' : 'Show as list'}
            onPress={() => setLayout(layout === 'list' ? 'grid' : 'list')}
            className="h-10 w-10 items-center justify-center rounded-md border border-line"
          >
            {layout === 'list' ? <LayoutGrid size={18} color={colors.ink} /> : <List size={18} color={colors.ink} />}
          </Pressable>
        </View>
        {noMatch ? (
          <Text variant="caption" className="mt-1">
            No student matches “{query}”.
          </Text>
        ) : null}
        {!readOnly ? (
          <View className="mt-3 flex-row gap-2">
            <Button
              compact
              variant="secondary"
              className="flex-1"
              title="All present"
              accessibilityHint="Marks every student not marked yet as present"
              onPress={() => useMarking.getState().bulk('P')}
            />
            <Button
              compact
              variant="secondary"
              className="flex-1"
              title="All absent"
              accessibilityHint="Marks every student not marked yet as absent"
              onPress={() => useMarking.getState().bulk('A')}
            />
          </View>
        ) : null}
      </View>
      <FlashList
        key={layout}
        ref={listRef}
        data={roster}
        numColumns={layout === 'grid' ? columns : 1}
        keyExtractor={r => r.student_id}
        contentContainerStyle={layout === 'grid' ? styles.grid : undefined}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) =>
          layout === 'grid' ? (
            <RosterTile entry={item} colors={live} onLongPress={readOnly ? undefined : openSheet} />
          ) : (
            <RosterRow entry={item} colors={live} onLongPress={readOnly ? undefined : openSheet} />
          )
        }
      />

      <Sheet visible={sheetFor !== null} onClose={() => setSheetFor(null)} title={sheetFor ? `Roll ${sheetFor.roll_no ?? '–'} · ${sheetFor.name}` : undefined}>
        {settable.list.map(s => (
          <Pressable
            key={s.code}
            accessibilityRole="button"
            onPress={() => {
              if (sheetFor) {
                useMarking.getState().setStatus(sheetFor.student_id, s.code);
              }
              setSheetFor(null);
            }}
            className="mb-2 min-h-12 flex-row items-center rounded-md border border-line px-3"
          >
            <StatusPill code={s.code} color={live[s.code]} />
            <Text className="ml-3">{s.label}</Text>
          </Pressable>
        ))}
        <Button
          variant="ghost"
          title="Clear mark"
          onPress={() => {
            if (sheetFor) {
              useMarking.getState().setStatus(sheetFor.student_id, null);
            }
            setSheetFor(null);
          }}
        />
      </Sheet>

      <ConfirmSheet
        visible={confirm}
        session={session}
        statusLabel={statusLabel}
        submitting={submitting}
        error={error}
        onClose={() => setConfirm(false)}
        onSubmit={submit}
      />
    </Screen>
  );
}

function ConfirmSheet({
  visible,
  session,
  statusLabel,
  submitting,
  error,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  session: MySessionRow;
  statusLabel: (code: string) => string;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const roster = useMarking(s => s.roster);
  const marks = useMarking(s => s.marks);
  const c = useMemo(() => countMarks(roster, marks), [roster, marks]);
  const absent = useMemo(() => absentRolls(roster, marks), [roster, marks]);
  const fallback = session.default_unmarked_status;
  return (
    <Sheet visible={visible} onClose={onClose} title="Submit register?">
      <View className="mb-3 flex-row gap-2">
        {(['P', 'A', 'L'] as const).map(k => (
          <View key={k} className="flex-1 items-center rounded-md border border-line py-2">
            <Text className="text-2xl font-bold text-ink">{c[k]}</Text>
            <Text variant="caption">{statusLabel(k)}</Text>
          </View>
        ))}
      </View>
      {c.other > 0 ? <Text variant="muted">{c.other} with other statuses (e.g. on duty).</Text> : null}
      <Text variant="label" className="mt-2">
        Absent roll numbers
      </Text>
      <Text variant="body" className="mb-2">
        {absent.length === 0 ? 'None' : absent.join(', ')}
      </Text>
      {c.pending > 0 ? (
        <View className="mb-3">
          <Banner tone="warn">{`${c.pending} ${c.pending === 1 ? 'student is' : 'students are'} not marked and will be recorded as ${statusLabel(fallback)} (${fallback}) under college policy.`}</Banner>
        </View>
      ) : null}
      {error ? <Text className="mb-2 text-sm text-danger">{error}</Text> : null}
      <Button title="Submit" onPress={onSubmit} loading={submitting} disabled={submitting} />
      <Button variant="ghost" className="mt-1" title="Keep marking" onPress={onClose} />
    </Sheet>
  );
}
