// Subject detail (§10): session-by-session list, heatmap, trend and the
// remaining-requirement preview. Students report a problem; parents ask.
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/Card';
import { QueryView, SectionTitle } from '../../components/feedback';
import { Screen } from '../../components/Screen';
import { Segmented } from '../../components/Segmented';
import { StatusPill } from '../../components/StatusPill';
import { Text } from '../../components/Text';
import { useSubjectAttendance, useSummary } from '../../features/attendance/api';
import { Heatmap, ShortageBanners, SubjectSummaryRow, TrendChart } from '../../features/attendance/components';
import { trend } from '../../features/attendance/derive';
import { useScopeStudentId, useStatusCodes } from '../../features/common/hooks';
import { day, instant, timeRange } from '../../lib/format';
import type { SharedStackParamList } from '../../navigation/types';
import { useSession } from '../../stores/session';
import type { Component } from '../../types/database';

type Filter = 'all' | Component;

export function SubjectDetailScreen({ route, navigation }: NativeStackScreenProps<SharedStackParamList, 'SubjectDetail'>) {
  const { offeringId } = route.params;
  const studentId = useScopeStudentId();
  const persona = useSession(s => s.route);
  const { t } = useTranslation();
  const q = useSubjectAttendance(studentId, offeringId);
  const summary = useSummary(studentId);
  const codes = useStatusCodes();
  const [filter, setFilter] = useState<Filter>('all');

  const live = useMemo(() => Object.fromEntries((codes.data ?? []).map(c => [c.code, c.color])), [codes.data]);
  const held = useMemo(() => new Set((codes.data ?? []).filter(c => c.counts_in_held).map(c => c.code)), [codes.data]);
  const attended = useMemo(() => new Set((codes.data ?? []).filter(c => c.counts_as_attended).map(c => c.code)), [codes.data]);
  const rows = (summary.data ?? []).filter(r => r.offering_id === offeringId);
  const components = [...new Set(rows.map(r => r.component))];

  const ask = (recordId: string, label: string) => navigation.navigate('AskAboutRecord', { recordId, label });

  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      {rows.map(r => (
        <Card key={r.component} className="mb-2">
          <SubjectSummaryRow row={r} />
        </Card>
      ))}
      <ShortageBanners rows={rows} />
      <QueryView query={q}>
        {data => {
          const sessions = data.sessions.filter(s => filter === 'all' || s.component === filter);
          return (
            <>
              {components.length > 1 ? (
                <View className="mt-4">
                  <Segmented<Filter>
                    value={filter}
                    onChange={setFilter}
                    options={[{ value: 'all', label: 'All' }, ...components.map(c => ({ value: c as Filter, label: c }))]}
                  />
                </View>
              ) : null}
              <SectionTitle>Trend</SectionTitle>
              <Card>
                <TrendChart points={trend(sessions, held, attended)} min={Number(data.min_percent)} />
              </Card>
              <SectionTitle>By day</SectionTitle>
              <Card>
                <Heatmap sessions={sessions} colors={live} />
              </Card>
              <SectionTitle>{`Sessions (${sessions.length})`}</SectionTitle>
              {sessions.map(s => {
                const label = `${data.subject_name} ${s.component}, ${day(s.session_date)} ${timeRange(s.start_time, s.end_time)}`;
                return (
                  <View key={s.record_id} className="mb-2 rounded-md border border-line bg-surface p-3">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text variant="body">
                          {day(s.session_date, { weekday: true })} · {timeRange(s.start_time, s.end_time)}
                        </Text>
                        <Text variant="caption">
                          {s.component} · {s.session_type}
                          {s.submitted_at ? ` · marked ${instant(s.submitted_at)}` : ''}
                        </Text>
                      </View>
                      <StatusPill code={s.status} label={t(`status.${s.status}`, { defaultValue: s.status })} color={live[s.status]} size="sm" />
                    </View>
                    {s.open_dispute ? (
                      <Text variant="caption" className="mt-2 text-warn">
                        Under review
                      </Text>
                    ) : (
                      <Pressable accessibilityRole="button" onPress={() => ask(s.record_id, label)} className="mt-2 min-h-8 justify-center" hitSlop={6}>
                        <Text className="text-sm font-medium text-primary">{persona === 'parent' ? t('parent.askAboutThis') : 'Report a problem'}</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}
