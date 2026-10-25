// Student and parent data (§7.3, §10, §11). Every query takes an explicit
// studentId and puts it in the key, so switching child never mixes caches.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '../../lib/errors';
import { STALE } from '../../lib/query-client';
import { supabase } from '../../lib/supabase';
import type {
  ChildRow,
  FacultyRow,
  LeaveRow,
  LeaveType,
  MyDisputeRow,
  ProfileRow,
  SubjectAttendance,
  SummaryRow,
  TimetableRow,
} from '../../types/database';

export function useSummary(studentId: string | null) {
  return useQuery({
    queryKey: ['attendance', 'summary', studentId],
    enabled: !!studentId,
    staleTime: STALE.summaries,
    queryFn: async () =>
      unwrap(
        await supabase.from('v_my_attendance_summary').select('*').eq('student_id', studentId!).order('subject_code').order('component', { ascending: false }),
      ) as SummaryRow[],
  });
}

export function useSubjectAttendance(studentId: string | null, offeringId: string) {
  return useQuery({
    queryKey: ['attendance', 'subject', studentId, offeringId],
    enabled: !!studentId,
    staleTime: STALE.summaries,
    queryFn: async () =>
      unwrap(await supabase.rpc('my_subject_attendance', { p_offering: offeringId, p_student: studentId! })) as unknown as SubjectAttendance,
  });
}

/** Absences across subjects for the parent view (§11). */
export function useRecentRecords(studentId: string | null, from: string, to: string) {
  return useQuery({
    queryKey: ['attendance', 'timetable-status', studentId, from, to],
    enabled: !!studentId,
    staleTime: STALE.summaries,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('v_my_timetable')
          .select('*')
          .eq('student_id', studentId!)
          .gte('session_date', from)
          .lte('session_date', to)
          .order('starts_at', { ascending: false }),
      ) as TimetableRow[],
  });
}

export function useTimetable(studentId: string | null, from: string, to: string) {
  return useQuery({
    queryKey: ['timetable', studentId, from, to],
    enabled: !!studentId,
    staleTime: STALE.timetable,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('v_my_timetable')
          .select('*')
          .eq('student_id', studentId!)
          .gte('session_date', from)
          .lte('session_date', to)
          .order('starts_at'),
      ) as TimetableRow[],
  });
}

export function useLeave(studentId: string | null) {
  return useQuery({
    queryKey: ['leave', studentId],
    enabled: !!studentId,
    staleTime: STALE.summaries,
    queryFn: async () =>
      unwrap(await supabase.from('v_my_leave').select('*').eq('student_id', studentId!).order('from_date', { ascending: false })) as LeaveRow[],
  });
}

export interface LeaveInput {
  leave_type: LeaveType;
  from_date: string;
  to_date?: string;
  half?: 'first' | 'second';
  session_ids?: string[];
  reason: string;
}

export function useApplyLeave(studentId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LeaveInput) => unwrap(await supabase.rpc('apply_leave', { p: input as never })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave', studentId] }),
  });
}

export function useCancelLeave(studentId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.rpc('cancel_leave', { p_id: id })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave', studentId] }),
  });
}

export function useRaiseDispute(studentId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { recordId: string; message: string }) =>
      unwrap(await supabase.rpc('raise_attendance_dispute', { p_record: p.recordId, p_message: p.message })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance', 'subject', studentId] });
      qc.invalidateQueries({ queryKey: ['disputes'] });
    },
  });
}

export function useRaiseGuardianQuery(studentId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { recordId: string; message: string }) =>
      unwrap(await supabase.rpc('raise_guardian_query', { p_student: studentId!, p_record: p.recordId, p_message: p.message })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['disputes'] }),
  });
}

export function useMyDisputes(scope: string | null) {
  return useQuery({
    queryKey: ['disputes', scope],
    enabled: !!scope,
    staleTime: STALE.notices,
    queryFn: async () => unwrap(await supabase.from('v_my_disputes').select('*').order('created_at', { ascending: false })) as MyDisputeRow[],
  });
}

export function useProfile(studentId: string | null) {
  return useQuery({
    queryKey: ['profile', studentId],
    enabled: !!studentId,
    staleTime: STALE.profile,
    queryFn: async () => unwrap(await supabase.from('v_my_profile').select('*').eq('student_id', studentId!).maybeSingle()) as ProfileRow | null,
  });
}

export function useFaculty(studentId: string | null) {
  return useQuery({
    queryKey: ['faculty', studentId],
    enabled: !!studentId,
    staleTime: STALE.profile,
    queryFn: async () => unwrap(await supabase.from('v_my_faculty').select('*').eq('student_id', studentId!)) as FacultyRow[],
  });
}

export function useChildren(guardianUserId: string | null) {
  return useQuery({
    queryKey: ['children', guardianUserId],
    enabled: !!guardianUserId,
    staleTime: STALE.profile,
    queryFn: async () => unwrap(await supabase.from('v_my_children').select('*').order('full_name')) as ChildRow[],
  });
}
