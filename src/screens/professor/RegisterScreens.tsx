// Submitted register (§8.2), conflict resolution and correction requests (§9.3).
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, Pressable, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Banner, EmptyState, ErrorState, LoadingState, SectionTitle } from '../../components/feedback';
import { ListGroup } from '../../components/ListRow';
import { Screen } from '../../components/Screen';
import { Sheet } from '../../components/Sheet';
import { StatusPill } from '../../components/StatusPill';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { diffMarks, displayStatus, type Marks } from '../../features/marking/logic';
import { submitRegister } from '../../features/marking/submit';
import { useRegisterDetail, useRequestCorrection } from '../../features/professor/api';
import { canEdit } from '../../features/professor/sessionState';
import { errorMessage, messageForCode } from '../../lib/errors';
import { instant } from '../../lib/format';
import { acceptServerCopy, acknowledgeDefaulted, setMarksBulk, settleToServer } from '../../offline/repo';
import { refreshSession } from '../../offline/prefetch';
import { syncNow } from '../../offline/service';
import type { LocalRegister } from '../../offline/types';
import type { ProfessorStackParamList } from '../../navigation/types';
import { useSyncStatus } from '../../stores/sync';
import type { MySessionRow } from '../../types/database';
import { routeAfterSubmit, rollLabel, Row, SessionHeader, useLiveColors, useLocalRegister, useSettable } from './common';

type ScreenProps<T extends keyof ProfessorStackParamList> = NativeStackScreenProps<ProfessorStackParamList, T>;

interface RecordLine {
  student_id: string;
  roll_no: number | null;
  name: string;
  status: string | null;
}

const STATE_LABEL: Record<string, string> = {
  pending: 'Not submitted',
  submitted: 'Submitted',
  locked: 'Locked',
  reopened: 'Reopened for edits',
  voided: 'Voided',
};

function rejectText(reg: LocalRegister): string {
  if (reg.reject_code === 'locked') {
    return 'The register locked before this phone could sync.';
  }
  if (reg.reject_code === 'cancelled') {
    return 'The session was cancelled before this phone could sync.';
  }
  return reg.last_error ?? messageForCode(reg.reject_code ?? 'UNKNOWN');
}

function RecordRow({ line, colors, label, last, right }: { line: RecordLine; colors: Record<string, string>; label: (c: string) => string; last?: boolean; right?: ReactNode }) {
  return (
    <View
      accessible
      accessibilityLabel={`Roll ${rollLabel(line)}, ${line.name}, ${line.status ? label(line.status) : 'not marked'}`}
      className={`min-h-12 flex-row items-center px-4 py-2 ${last ? '' : 'border-b border-line'}`}
    >
      <Text className="w-12 text-lg font-bold text-ink">{rollLabel(line)}</Text>
      <Text className="flex-1" numberOfLines={1}>
        {line.name}
      </Text>
      {right ?? (line.status ? <StatusPill code={line.status} color={colors[line.status]} size="sm" /> : <Text variant="caption">Pending</Text>)}
    </View>
  );
}

/** Refreshes the local session row (state, version, edit window) when online. */
function useRefreshOnOpen(sessionId: string) {
  useEffect(() => {
    if (useSyncStatus.getState().online) {
      refreshSession(sessionId).catch(() => {});
    }
  }, [sessionId]);
}

export function RegisterScreen({ route, navigation }: ScreenProps<'Register'>) {
  const { sessionId } = route.params;
  const { t } = useTranslation();
  const label = (c: string) => t(`status.${c}`, { defaultValue: c });
  const colors = useLiveColors();
  const local = useLocalRegister(sessionId);
  const detail = useRegisterDetail(sessionId);
  const online = useSyncStatus(s => s.online);
  const [busy, setBusy] = useState(false);
  useRefreshOnOpen(sessionId);

  if (!local.data) {
    return <Screen>{local.error ? <ErrorState error={local.error} onRetry={() => local.refetch()} /> : <LoadingState />}</Screen>;
  }
  const { session, register, roster, marks } = local.data;
  const serverRows = detail.data && detail.data.length > 0 ? detail.data : null;
  const lines: RecordLine[] = serverRows
    ? serverRows.map(r => ({ student_id: r.student_id, roll_no: r.roll_no, name: r.full_name, status: r.status_code }))
    : roster.map(r => ({ student_id: r.student_id, roll_no: r.roll_no, name: r.name, status: displayStatus(marks[r.student_id], r.suggested_status) }));
  const names = new Map(lines.map(l => [l.student_id, l]));
  const counts = new Map<string, number>();
  for (const l of lines) {
    const k = l.status ?? 'pending';
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const now = new Date();
  const state = register?.state;
  const busyLocally = state === 'queued' || state === 'syncing' || state === 'conflict' || state === 'rejected';
  const editable = !!session && canEdit(session, now) && !busyLocally;
  const correctable = !!session?.submitted_at && !editable && !busyLocally;
  const defaulted = state === 'synced' && !register?.defaulted_ack ? register?.defaulted_students ?? [] : [];

  const refresh = () => Promise.all([detail.refetch(), refreshSession(sessionId).catch(() => null)]);
  const dismissRejected = async () => {
    setBusy(true);
    try {
      await settleToServer(sessionId, session?.register_version ?? 0, (serverRows ?? []).map(r => ({ student_id: r.student_id, status: r.status_code })));
      useSyncStatus.getState().bump();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      onRefresh={refresh}
      refreshing={detail.isRefetching}
      footer={
        editable ? (
          <Button title="Edit register" onPress={() => navigation.navigate('MarkAttendance', { sessionId, edit: true })} />
        ) : correctable ? (
          <Button variant="secondary" title="Request correction" onPress={() => navigation.navigate('CorrectionRequest', { sessionId })} />
        ) : undefined
      }
    >
      {session ? <SessionHeader session={session} /> : null}

      {state === 'rejected' && register ? (
        <View className="mb-3">
          <Banner tone="danger">
            <Text variant="label">Not accepted by the server</Text>
            <Text variant="body">{rejectText(register)} Your marks are still on this phone.</Text>
            <View className="mt-2 flex-row gap-2">
              {register.reject_code !== 'cancelled' ? (
                <Button compact title="Request correction" onPress={() => navigation.navigate('CorrectionRequest', { sessionId })} />
              ) : null}
              <Button compact variant="secondary" title="Discard my marks" loading={busy} onPress={dismissRejected} />
            </View>
          </Banner>
        </View>
      ) : null}
      {state === 'queued' || state === 'syncing' ? (
        <View className="mb-3">
          <Banner tone="warn">
            <Text variant="label">Waiting to sync</Text>
            <Text variant="body">{register?.last_error ? `Last attempt: ${register.last_error}` : 'This register syncs automatically when you are online.'}</Text>
            <View className="mt-2 flex-row">
              <Button compact title="Sync now" onPress={() => syncNow(true).catch(() => {})} />
            </View>
          </Banner>
        </View>
      ) : null}
      {state === 'conflict' ? (
        <View className="mb-3">
          <Banner tone="danger">
            <Text variant="label">Someone else submitted this register first</Text>
            <View className="mt-2 flex-row">
              <Button compact title="Compare and resolve" onPress={() => navigation.replace('Conflict', { sessionId })} />
            </View>
          </Banner>
        </View>
      ) : null}
      {state === 'draft' && session?.submitted_at ? (
        <View className="mb-3">
          <Banner>
            <Text variant="body">You have unsubmitted edits to this register on this phone.</Text>
            <View className="mt-2 flex-row">
              <Button compact title="Continue editing" onPress={() => navigation.navigate('MarkAttendance', { sessionId, edit: true })} />
            </View>
          </Banner>
        </View>
      ) : null}
      {defaulted.length > 0 ? (
        <View className="mb-3">
          <Banner tone="warn">
            <Text variant="label">{`${defaulted.length} ${defaulted.length === 1 ? 'student was' : 'students were'} recorded by policy`}</Text>
            <Text variant="body">
              They were not marked or joined the class after the roster was downloaded:{' '}
              {defaulted.map(d => `${names.get(d.student_id)?.name ?? 'Student'} (${d.status})`).join(', ')}.
            </Text>
            <View className="mt-2 flex-row gap-2">
              <Button
                compact
                variant="secondary"
                title="Mark as reviewed"
                onPress={async () => {
                  await acknowledgeDefaulted(sessionId);
                  useSyncStatus.getState().bump();
                }}
              />
              {editable ? <Button compact title="Edit register" onPress={() => navigation.navigate('MarkAttendance', { sessionId, edit: true })} /> : null}
            </View>
          </Banner>
        </View>
      ) : null}

      {session && !session.submitted_at && (session.register_state === 'locked' || session.register_state === 'voided') && !busyLocally ? (
        <View className="mb-3">
          <Banner tone="warn">{messageForCode('ATT_NEEDS_REOPEN')}</Banner>
        </View>
      ) : null}

      {session ? (
        <Card>
          <Row label="Status" value={STATE_LABEL[session.register_state ?? 'pending'] ?? String(session.register_state)} />
          {session.submitted_at ? <Row label="Submitted" value={`${instant(session.submitted_at)}${session.is_late ? ' · late' : ''}`} /> : null}
          {session.total_count ? <Row label="Present" value={`${session.present_count ?? 0} of ${session.total_count}`} /> : null}
          {editable && session.edit_until ? <Row label="Editable until" value={instant(session.edit_until)} /> : null}
          {!session.locked_at && session.locks_at ? <Row label="Locks" value={instant(session.locks_at)} /> : null}
        </Card>
      ) : null}

      <SectionTitle>{[...counts.entries()].map(([k, n]) => `${k === 'pending' ? 'Pending' : k} ${n}`).join(' · ') || 'Students'}</SectionTitle>
      {!serverRows ? (
        <Text variant="caption" className="mb-2">
          {detail.isPending && online ?'Loading the server copy…' : 'Showing the marks saved on this phone.'}
        </Text>
      ) : null}
      {lines.length === 0 ? (
        <EmptyState title="No records yet" />
      ) : (
        <ListGroup>
          {lines.map((l, i) => (
            <RecordRow key={l.student_id} line={l} colors={colors} label={label} last={i === lines.length - 1} />
          ))}
        </ListGroup>
      )}
    </Screen>
  );
}

function editableSession(session: MySessionRow | null): boolean {
  // A session row from before the conflict may not know about the other submission yet;
  // the server decides in that case (a locked register comes back as rejected).
  if (!session || session.register_state === null || session.register_state === 'pending') {
    return true;
  }
  return canEdit(session, new Date());
}

export function ConflictScreen({ route, navigation }: ScreenProps<'Conflict'>) {
  const { sessionId } = route.params;
  const { t } = useTranslation();
  const label = (c: string) => t(`status.${c}`, { defaultValue: c });
  const colors = useLiveColors();
  const settable = useSettable();
  const local = useLocalRegister(sessionId);
  const [busy, setBusy] = useState<'keep' | 'mine' | null>(null);
  const [error, setError] = useState<string | null>(null);
  useRefreshOnOpen(sessionId);

  if (!local.data) {
    return <Screen>{local.error ? <ErrorState error={local.error} onRetry={() => local.refetch()} /> : <LoadingState />}</Screen>;
  }
  const { session, register, roster, marks } = local.data;
  const copy = register?.state === 'conflict' ? register.server_copy : null;
  if (!copy) {
    return (
      <Screen>
        <EmptyState title="Nothing to resolve" body="This register is no longer in conflict." action={<Button title="Open register" onPress={() => navigation.replace('Register', { sessionId })} />} />
      </Screen>
    );
  }
  const byId = new Map(roster.map(r => [r.student_id, r]));
  const diffs = diffMarks(marks, copy.records);
  const editable = editableSession(session);

  const keepServer = async () => {
    setBusy('keep');
    try {
      await acceptServerCopy(sessionId);
      useSyncStatus.getState().bump();
      navigation.replace('Register', { sessionId });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  };

  const submitMine = async () => {
    setBusy('mine');
    setError(null);
    try {
      // The other submission stays for students I did not mark; my marks win where I did.
      const merged: Marks = Object.fromEntries(copy.records.map(r => [r.student_id, r.status]));
      for (const [id, status] of Object.entries(marks)) {
        if (status !== null) {
          merged[id] = status;
        }
      }
      await setMarksBulk(sessionId, merged);
      await submitRegister({ sessionId, roster, marks: merged, settable: settable.set, baseVersion: copy.version });
      await routeAfterSubmit(navigation, sessionId);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  };

  return (
    <Screen
      footer={
        <View className="gap-2">
          {error ? <Text className="text-sm text-danger">{error}</Text> : null}
          <Button variant="secondary" title="Keep server version" onPress={keepServer} loading={busy === 'keep'} disabled={busy !== null} />
          {editable ? (
            <Button title="Submit mine as an edit" onPress={submitMine} loading={busy === 'mine'} disabled={busy !== null} />
          ) : (
            <Button title="Request correction" onPress={() => navigation.navigate('CorrectionRequest', { sessionId })} disabled={busy !== null} />
          )}
        </View>
      }
    >
      {session ? <SessionHeader session={session} /> : null}
      <Banner tone="warn">
        A co-teacher or substitute submitted this register before your phone synced. Compare the two and choose which to keep.
      </Banner>
      <SectionTitle>{diffs.length === 0 ? 'No differences' : `${diffs.length} ${diffs.length === 1 ? 'difference' : 'differences'}`}</SectionTitle>
      {diffs.length > 0 ? (
        <ListGroup>
          <View className="flex-row border-b border-line px-4 py-2">
            <Text variant="caption" className="flex-1">
              Student
            </Text>
            <Text variant="caption" className="w-16 text-center">
              Server
            </Text>
            <Text variant="caption" className="w-16 text-center">
              Mine
            </Text>
          </View>
          {diffs.map((d, i) => {
            const r = byId.get(d.student_id);
            return (
              <View
                key={d.student_id}
                accessible
                accessibilityLabel={`Roll ${r ? rollLabel(r) : '–'}, ${r?.name ?? ''}. Server ${d.server ? label(d.server) : 'not marked'}, yours ${label(d.local)}`}
                className={`min-h-12 flex-row items-center bg-warn/10 px-4 py-2 ${i === diffs.length - 1 ? '' : 'border-b border-line'}`}
              >
                <Text className="w-10 font-bold text-ink">{r ? rollLabel(r) : '–'}</Text>
                <Text className="flex-1" numberOfLines={1}>
                  {r?.name ?? 'Student'}
                </Text>
                <View className="w-16 items-center">{d.server ? <StatusPill code={d.server} color={colors[d.server]} size="sm" /> : <Text variant="caption">—</Text>}</View>
                <View className="w-16 items-center">
                  <StatusPill code={d.local} color={colors[d.local]} size="sm" />
                </View>
              </View>
            );
          })}
        </ListGroup>
      ) : (
        <Text variant="muted">Your marks match the server copy. Keep the server version to finish.</Text>
      )}
      {!editable ? (
        <Text variant="caption" className="mt-3">
          The edit window has closed, so your marks can only go in as a correction request.
        </Text>
      ) : null}
    </Screen>
  );
}

export function CorrectionRequestScreen({ route, navigation }: ScreenProps<'CorrectionRequest'>) {
  const { sessionId } = route.params;
  const { t } = useTranslation();
  const label = (c: string) => t(`status.${c}`, { defaultValue: c });
  const colors = useLiveColors();
  const settable = useSettable();
  const local = useLocalRegister(sessionId);
  const detail = useRegisterDetail(sessionId);
  const request = useRequestCorrection();
  const [changes, setChanges] = useState<Map<string, string> | null>(null);
  const [pick, setPick] = useState<RecordLine | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const server = useMemo(() => detail.data ?? [], [detail.data]);

  // Start from the marks this phone still holds (e.g. a register rejected as locked).
  useEffect(() => {
    if (changes !== null || !detail.data || !local.data) {
      return;
    }
    const mine = Object.fromEntries(Object.entries(local.data.marks).filter(([, s]) => s !== null && settable.set.has(s)));
    const diff = diffMarks(mine, detail.data.map(r => ({ student_id: r.student_id, status: r.status_code })));
    setChanges(new Map(diff.filter(d => d.server !== null).map(d => [d.student_id, d.local])));
  }, [changes, detail.data, local.data, settable.set]);

  if (detail.data === undefined) {
    return <Screen>{detail.isPending && !detail.error ? <LoadingState /> : <ErrorState error={detail.error} onRetry={() => detail.refetch()} />}</Screen>;
  }
  if (server.length === 0) {
    return (
      <Screen>
        <EmptyState title="No submitted register" body={messageForCode('ATT_NEEDS_REOPEN')} />
      </Screen>
    );
  }
  const selected = changes ?? new Map<string, string>();

  const submit = async () => {
    setError(null);
    if (selected.size === 0) {
      setError('Choose at least one student to change.');
      return;
    }
    if (reason.trim().length < 5) {
      setError('Give a reason of at least 5 characters.');
      return;
    }
    try {
      const count = await request.mutateAsync({
        sessionId,
        changes: [...selected.entries()].map(([student_id, to_status]) => ({ student_id, to_status })),
        reason: reason.trim(),
      });
      await settleToServer(
        sessionId,
        local.data?.session?.register_version ?? 0,
        server.map(r => ({ student_id: r.student_id, status: r.status_code })),
      );
      useSyncStatus.getState().bump();
      Alert.alert('Correction requested', `${count} ${count === 1 ? 'change was' : 'changes were'} sent to your HOD for approval.`);
      navigation.goBack();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Screen footer={<Button title="Send request" onPress={submit} loading={request.isPending} />}>
      {local.data?.session ? <SessionHeader session={local.data.session} /> : null}
      <Text variant="muted" className="mb-2">
        Tap a student to choose the corrected status. Your HOD approves each change.
      </Text>
      <ListGroup>
        {server.map((r, i) => {
          const line: RecordLine = { student_id: r.student_id, roll_no: r.roll_no, name: r.full_name, status: r.status_code };
          const to = selected.get(r.student_id);
          return (
            <Pressable key={r.student_id} accessibilityRole="button" onPress={() => setPick(line)} className={to ? 'bg-primary/10' : ''}>
              <RecordRow
                line={line}
                colors={colors}
                label={label}
                last={i === server.length - 1}
                right={
                  <View className="flex-row items-center gap-1">
                    <StatusPill code={r.status_code} color={colors[r.status_code]} size="sm" />
                    {to ? (
                      <>
                        <Text variant="caption">→</Text>
                        <StatusPill code={to} color={colors[to]} size="sm" />
                      </>
                    ) : null}
                  </View>
                }
              />
            </Pressable>
          );
        })}
      </ListGroup>
      <View className="mt-4">
        <TextField label="Reason" multiline value={reason} onChangeText={setReason} maxLength={500} placeholder="For example: marked before the student arrived from the lab." />
      </View>
      {error ? <Text className="text-sm text-danger">{error}</Text> : null}

      <Sheet visible={pick !== null} onClose={() => setPick(null)} title={pick ? `Roll ${rollLabel(pick)} · ${pick.name}` : undefined}>
        {settable.list
          .filter(s => s.code !== pick?.status)
          .map(s => (
            <Pressable
              key={s.code}
              accessibilityRole="button"
              onPress={() => {
                if (pick) {
                  setChanges(new Map(selected).set(pick.student_id, s.code));
                }
                setPick(null);
              }}
              className="mb-2 min-h-12 flex-row items-center rounded-md border border-line px-3"
            >
              <StatusPill code={s.code} color={colors[s.code]} />
              <Text className="ml-3">{s.label}</Text>
            </Pressable>
          ))}
        <Button
          variant="ghost"
          title="No change"
          onPress={() => {
            if (pick) {
              const next = new Map(selected);
              next.delete(pick.student_id);
              setChanges(next);
            }
            setPick(null);
          }}
        />
      </Sheet>
    </Screen>
  );
}
