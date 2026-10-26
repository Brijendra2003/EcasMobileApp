// Helpers shared by the professor screens.
import { useMemo } from 'react';
import { Alert, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { useStatusCodes } from '../../features/common/hooks';
import type { RosterEntry } from '../../features/marking/logic';
import { day, timeRange } from '../../lib/format';
import { getMarks, getRegister, getRoster, getSession } from '../../offline/repo';
import type { ProfessorStackParamList } from '../../navigation/types';
import { useSyncStatus } from '../../stores/sync';
import type { MySessionRow } from '../../types/database';

export type ProfNav = NativeStackNavigationProp<ProfessorStackParamList>;

export function useLiveColors() {
  const codes = useStatusCodes();
  return useMemo(() => Object.fromEntries((codes.data ?? []).map(c => [c.code, c.color])), [codes.data]);
}

export interface SettableStatus {
  code: string;
  label: string;
}

/** Used until the status codes are cached, so a first offline submission never drops every mark. */
const FALLBACK_SETTABLE: SettableStatus[] = [
  { code: 'P', label: 'Present' },
  { code: 'A', label: 'Absent' },
];

/** Statuses a professor may set (`professor_can_set`, §8.2). */
export function useSettable() {
  const codes = useStatusCodes();
  return useMemo(() => {
    const live = (codes.data ?? []).filter(c => c.professor_can_set).map(c => ({ code: c.code, label: c.label }));
    const list = live.length > 0 ? live : FALLBACK_SETTABLE;
    return { list, set: new Set(list.map(s => s.code)) };
  }, [codes.data]);
}

/** One session's offline state from SQLite: session row, local register, roster and marks. */
export function useLocalRegister(sessionId: string) {
  const revision = useSyncStatus(s => s.revision);
  return useQuery({
    queryKey: ['local', 'register', sessionId, revision],
    staleTime: Infinity,
    placeholderData: prev => prev,
    queryFn: async () => {
      const [session, register, roster, marks] = await Promise.all([getSession(sessionId), getRegister(sessionId), getRoster(sessionId), getMarks(sessionId)]);
      return { session, register, roster: roster as RosterEntry[], marks };
    },
  });
}

export function sessionLine(s: MySessionRow): string {
  return [s.component, s.group_label, timeRange(s.start_time, s.end_time), s.room_label ? `Room ${s.room_label}` : null].filter(Boolean).join(' · ');
}

export function SessionHeader({ session }: { session: MySessionRow }) {
  return (
    <Card className="mb-3">
      <Text variant="caption">{day(session.session_date, { weekday: true, year: true })}</Text>
      <Text variant="heading">{session.subject_name}</Text>
      <Text variant="muted">{sessionLine(session)}</Text>
    </Card>
  );
}

export function rollLabel(r: { roll_no: number | null }) {
  return r.roll_no === null ? '–' : String(r.roll_no);
}

/** After Submit (§9.3): show the result of the sync, or say it is queued. */
export async function routeAfterSubmit(navigation: ProfNav, sessionId: string) {
  const reg = await getRegister(sessionId);
  if (reg?.state === 'synced' || reg?.state === 'rejected') {
    navigation.replace('Register', { sessionId });
  } else if (reg?.state === 'conflict') {
    navigation.replace('Conflict', { sessionId });
  } else {
    Alert.alert('Saved on this phone', 'The register syncs automatically when you are back online. You can keep using the app.');
    navigation.goBack();
  }
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-1">
      <Text variant="muted">{label}</Text>
      <Text variant="label">{value}</Text>
    </View>
  );
}
