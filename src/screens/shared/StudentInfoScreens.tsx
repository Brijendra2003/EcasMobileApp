// Shared by the student and parent stacks: record questions and their
// threads, profile, and faculty.
import { useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Banner, EmptyState, QueryView, SectionTitle } from '../../components/feedback';
import { ListGroup, ListRow } from '../../components/ListRow';
import { Screen } from '../../components/Screen';
import { StatusPill } from '../../components/StatusPill';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { useFaculty, useMyDisputes, useProfile, useRaiseDispute, useRaiseGuardianQuery } from '../../features/attendance/api';
import { COMPONENT_LABEL } from '../../features/attendance/derive';
import { useScopeStudentId } from '../../features/common/hooks';
import { errorMessage } from '../../lib/errors';
import { day, instant } from '../../lib/format';
import type { SharedStackParamList } from '../../navigation/types';
import { useSession, useUserId } from '../../stores/session';

export function AskAboutRecordScreen({ route, navigation }: NativeStackScreenProps<SharedStackParamList, 'AskAboutRecord'>) {
  const { recordId, label } = route.params;
  const { t } = useTranslation();
  const studentId = useScopeStudentId();
  const isParent = useSession(s => s.route) === 'parent';
  const dispute = useRaiseDispute(studentId);
  const query = useRaiseGuardianQuery(studentId);
  const mutation = isParent ? query : dispute;
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (message.trim().length < 5) {
      setError('Write at least a few words');
      return;
    }
    setError(null);
    try {
      await mutation.mutateAsync({ recordId, message: message.trim() });
      setSent(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  if (sent) {
    return (
      <Screen>
        <Banner tone="safe">{isParent ? t('parent.askSent') : 'Sent to your professor. You will be notified when they reply.'}</Banner>
        <Button className="mt-6" variant="secondary" title={t('common.close')} onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Card className="mb-4">
        <Text variant="caption">{isParent ? t('parent.askTitle') : 'Report a problem with this record'}</Text>
        <Text variant="subheading">{label}</Text>
      </Card>
      <TextField
        label={isParent ? t('parent.askPlaceholder') : 'What is wrong with this record?'}
        multiline
        value={message}
        onChangeText={setMessage}
        maxLength={1000}
        error={error ?? undefined}
        placeholder={isParent ? '' : 'For example: I was present; I sat in the second row.'}
      />
      <Button title={t('common.send')} onPress={submit} loading={mutation.isPending} />
    </Screen>
  );
}

export function MyDisputesScreen() {
  const userId = useUserId();
  const q = useMyDisputes(userId);
  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <QueryView query={q}>
        {rows =>
          rows.length === 0 ? (
            <EmptyState title="No questions yet" body="Use “Report a problem” on a session to start one." />
          ) : (
            rows.map(d => (
              <Card key={d.id} className="mb-3">
                <View className="flex-row items-center justify-between">
                  <Text variant="subheading" className="flex-1">
                    {d.subject_name} · {COMPONENT_LABEL[d.component]}
                  </Text>
                  <StatusPill code={d.status_code} size="sm" />
                </View>
                <Text variant="caption">
                  {day(d.session_date, { year: true })} · {d.status === 'open' ? 'Open' : d.status === 'resolved' ? 'Resolved' : 'Closed'}
                </Text>
                <View className="mt-2 gap-2">
                  {d.thread.map((m, i) => (
                    <View key={i} className={`rounded-md p-2 ${m.role === 'staff' ? 'bg-primary/10' : 'bg-canvas'}`}>
                      <Text variant="caption">
                        {m.by} · {instant(m.at)}
                      </Text>
                      <Text variant="body">{m.message}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            ))
          )
        }
      </QueryView>
    </Screen>
  );
}

export function ProfileScreen() {
  const studentId = useScopeStudentId();
  const q = useProfile(studentId);
  const isParent = useSession(s => s.route) === 'parent';
  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <QueryView query={q}>
        {p =>
          !p ? (
            <EmptyState title="Profile not available" />
          ) : (
            <>
              <Text variant="title">{p.full_name}</Text>
              <Text variant="muted">
                {[p.program_year, p.department_code, p.division_label].filter(Boolean).join(' · ')}
              </Text>
              <SectionTitle>Academic</SectionTitle>
              <ListGroup>
                <ListRow title="Enrollment no." subtitle={p.enrollment_no} />
                <ListRow title="PRN" subtitle={p.prn ?? 'Not assigned yet'} />
                <ListRow title="Branch" subtitle={p.department_name ?? p.department_code} />
                <ListRow title="Year / semester" subtitle={`${p.program_year ?? '—'} · Semester ${p.semester ?? '—'}`} />
                <ListRow title="Division / batch / roll" subtitle={`${p.division_label ?? '—'} · Batch ${p.batch_code ?? '—'} · Roll ${p.roll_no ?? '—'}`} last />
              </ListGroup>
              <SectionTitle>{`Subjects (${p.subjects.length})`}</SectionTitle>
              <ListGroup>
                {p.subjects.map((s, i) => (
                  <ListRow key={s.code} title={s.name} subtitle={`${s.code} · ${s.credits} credits${s.is_elective ? ' · elective' : ''}`} last={i === p.subjects.length - 1} />
                ))}
              </ListGroup>
              {!isParent ? (
                <>
                  <SectionTitle>Contact</SectionTitle>
                  <ListGroup>
                    <ListRow title="Email" subtitle={p.email ?? '—'} />
                    <ListRow title="Phone" subtitle={p.phone ?? '—'} last />
                  </ListGroup>
                  <View className="mt-4">
                    <Banner>To correct your name, PRN, or other official details, contact the college office with proof. Changes are verified before they apply.</Banner>
                  </View>
                </>
              ) : null}
            </>
          )
        }
      </QueryView>
    </Screen>
  );
}

export function FacultyScreen() {
  const studentId = useScopeStudentId();
  const q = useFaculty(studentId);
  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <QueryView query={q} empty={d => d.length === 0}>
        {rows => {
          const ct = rows.filter(r => r.role === 'class_teacher');
          const teaching = rows.filter(r => r.role !== 'class_teacher');
          return (
            <>
              {ct.length ? (
                <>
                  <SectionTitle>Class teacher</SectionTitle>
                  <ListGroup>
                    {ct.map((r, i) => (
                      <ListRow key={r.staff_name} title={r.staff_name} subtitle={r.designation} last={i === ct.length - 1} />
                    ))}
                  </ListGroup>
                </>
              ) : null}
              <SectionTitle>Subjects</SectionTitle>
              <ListGroup>
                {teaching.map((r, i) => (
                  <ListRow
                    key={`${r.subject_code}-${r.component}-${r.staff_name}`}
                    title={`${r.subject_name} · ${r.component}`}
                    subtitle={`${r.staff_name}, ${r.designation}${r.role !== 'primary' ? ` (${r.role})` : ''}`}
                    last={i === teaching.length - 1}
                  />
                ))}
              </ListGroup>
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}
