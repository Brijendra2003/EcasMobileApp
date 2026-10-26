// Classes (§8.3): teaching groups, then per-group statistics with colour bands
// for students below the minimum and warning thresholds.
import { useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Card } from '../../components/Card';
import { Banner, EmptyState, QueryView, SectionTitle } from '../../components/feedback';
import { ListGroup, ListRow } from '../../components/ListRow';
import { standingColor } from '../../components/PercentRing';
import { Screen } from '../../components/Screen';
import { Segmented } from '../../components/Segmented';
import { useTheme } from '../../components/theme';
import { Text } from '../../components/Text';
import { COMPONENT_LABEL } from '../../features/attendance/derive';
import { useClassStats, useStaffId, useTeachingGroups } from '../../features/professor/api';
import { pct } from '../../lib/format';
import { standing, type Standing } from '../../shared/attendance';
import type { ProfessorStackParamList, ProfessorTabParamList } from '../../navigation/types';
import { useSession } from '../../stores/session';
import type { TeachingGroupRow } from '../../types/database';
import { Row } from './common';

type TabProps<T extends keyof ProfessorTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<ProfessorTabParamList, T>,
  NativeStackScreenProps<ProfessorStackParamList>
>;

const ROLE_LABEL: Record<string, string> = { primary: 'Main teacher', co: 'Co-teacher', substitute: 'Substitute' };

export function ClassesScreen({ navigation }: TabProps<'ProfClasses'>) {
  const staffId = useStaffId();
  const caps = useSession(s => s.caps);
  const q = useTeachingGroups();
  if (!staffId) {
    return (
      <Screen>
        <EmptyState title="Classes are not loaded yet" body="Connect to the internet to load your teaching groups." />
      </Screen>
    );
  }
  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      {caps?.class_teacher_of.length ? (
        <View className="mb-1">
          <Banner>{`Class teacher of ${caps.class_teacher_of.map(d => d.label).join(', ')}. Leave approvals are in Inbox.`}</Banner>
        </View>
      ) : null}
      <QueryView query={q} empty={d => d.length === 0}>
        {groups => {
          const bySubject = new Map<string, TeachingGroupRow[]>();
          for (const g of groups) {
            bySubject.set(g.subject_code, [...(bySubject.get(g.subject_code) ?? []), g]);
          }
          return [...bySubject.values()].map(list => (
            <View key={list[0].subject_code}>
              <SectionTitle>{`${list[0].subject_name} · ${list[0].subject_code}`}</SectionTitle>
              <ListGroup>
                {list.map((g, i) => (
                  <ListRow
                    key={g.group_id}
                    title={`${COMPONENT_LABEL[g.component]} · ${g.group_label}`}
                    subtitle={ROLE_LABEL[g.my_role] ?? g.my_role}
                    last={i === list.length - 1}
                    onPress={() => navigation.navigate('ClassDetail', { groupId: g.group_id, title: `${g.subject_code} ${g.component} · ${g.group_label}` })}
                  />
                ))}
              </ListGroup>
            </View>
          ));
        }}
      </QueryView>
    </Screen>
  );
}

type Filter = 'all' | 'shortage' | 'warning';

export function ClassDetailScreen({ route }: NativeStackScreenProps<ProfessorStackParamList, 'ClassDetail'>) {
  const { colors } = useTheme();
  const q = useClassStats(route.params.groupId);
  const [filter, setFilter] = useState<Filter>('all');
  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <QueryView query={q}>
        {s => {
          const min = Number(s.min_percent);
          const warn = Number(s.warn_percent);
          const rated = s.students.map(st => ({ ...st, standing: standing(st.percent === null ? null : Number(st.percent), min, warn) as Standing }));
          const shortage = rated.filter(st => st.standing === 'shortage');
          const close = rated.filter(st => st.standing === 'warning');
          const list = filter === 'shortage' ? shortage : filter === 'warning' ? close : rated;
          const due = Number(s.sessions.due);
          const completion = due > 0 ? ((due - Number(s.sessions.missing)) / due) * 100 : null;
          return (
            <>
              <Text variant="heading">{s.subject_name}</Text>
              <Text variant="muted" className="mb-3">
                {COMPONENT_LABEL[s.component]} · {s.group_label} · minimum {min}%
              </Text>
              <Card>
                <Row label="Sessions held / scheduled" value={`${s.sessions.held} / ${s.sessions.scheduled}`} />
                <Row label="Registers submitted" value={completion === null ? '—' : `${pct(completion)} of ${due} due`} />
                <Row label="Missing registers" value={String(s.sessions.missing)} />
                <Row label="Cancelled" value={String(s.sessions.cancelled)} />
              </Card>
              <View className="mt-4">
                <Segmented<Filter>
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: 'all', label: `All ${rated.length}` },
                    { value: 'shortage', label: `Below ${min}% · ${shortage.length}` },
                    { value: 'warning', label: `Close · ${close.length}` },
                  ]}
                />
              </View>
              <SectionTitle>Students</SectionTitle>
              {list.length === 0 ? (
                <EmptyState title="No students in this band" />
              ) : (
                <ListGroup>
                  {list.map((st, i) => (
                    <ListRow
                      key={st.student_id}
                      title={`${st.roll_no ?? '–'} · ${st.full_name}`}
                      subtitle={`${st.attended}/${st.held} attended`}
                      last={i === list.length - 1}
                      right={
                        <Text className="text-base font-bold" style={{ color: standingColor(st.standing, colors) }}>
                          {pct(st.percent)}
                        </Text>
                      }
                    />
                  ))}
                </ListGroup>
              )}
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}
