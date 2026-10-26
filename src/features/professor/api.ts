// Professor data (§7.3, §8). Sessions and rosters are read from SQLite (the
// offline source of truth, filled by prefetch); everything else is a server query.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '../../lib/errors';
import { STALE } from '../../lib/query-client';
import { supabase } from '../../lib/supabase';
import { registersFor, sessionsBetween } from '../../offline/repo';
import type { LocalRegister } from '../../offline/types';
import { useSession } from '../../stores/session';
import { useSyncStatus } from '../../stores/sync';
import type {
  ClassStats,
  DisputeForMeRow,
  DivisionStatsRow,
  FacultySubmissionRow,
  LeavePendingRow,
  MySessionRow,
  RegisterCounts,
  RegisterDetailRow,
  StaffLeaveRow,
  StaffLeaveType,
  TeachingGroupRow,
} from '../../types/database';

export const useStaffId = () => useSession(s => s.caps?.staff_id ?? null);

export interface LocalSession {
  session: MySessionRow;
  local: LocalRegister | undefined;
}

/** Sessions in a date range from SQLite, joined with local register state. */
export function useLocalSessions(from: string, to: string) {
  const revision = useSyncStatus(s => s.revision);
  return useQuery({
    queryKey: ['local', 'sessions', from, to, revision],
    staleTime: Infinity,
    placeholderData: prev => prev,
    queryFn: async (): Promise<LocalSession[]> => {
      const sessions = await sessionsBetween(from, to);
      const locals = await registersFor(sessions.map(s => s.id));
      return sessions.map(session => ({ session, local: locals.get(session.id) }));
    },
  });
}

/** Sessions outside the offline window (Timetable weeks further away), from the server. */
export function useServerSessions(from: string, to: string, enabled: boolean) {
  const staffId = useStaffId();
  return useQuery({
    queryKey: ['sessions', 'range', staffId, from, to],
    enabled: enabled && !!staffId,
    staleTime: STALE.timetable,
    queryFn: async () =>
      unwrap(await supabase.from('v_my_sessions').select('*').gte('session_date', from).lte('session_date', to).order('starts_at')) as MySessionRow[],
  });
}

export function useTeachingGroups() {
  const staffId = useStaffId();
  return useQuery({
    queryKey: ['sessions', 'groups', staffId],
    enabled: !!staffId,
    staleTime: STALE.profile,
    queryFn: async () =>
      unwrap(await supabase.from('v_my_teaching_groups').select('*').order('subject_code').order('component', { ascending: false })) as TeachingGroupRow[],
  });
}

export function useClassStats(groupId: string) {
  const staffId = useStaffId();
  return useQuery({
    queryKey: ['attendance', 'class', staffId, groupId],
    staleTime: STALE.summaries,
    queryFn: async () => unwrap(await supabase.rpc('class_attendance_stats', { p_group: groupId })) as unknown as ClassStats,
  });
}

export function useRegisterDetail(sessionId: string) {
  const staffId = useStaffId();
  return useQuery({
    queryKey: ['register', staffId, sessionId],
    staleTime: STALE.summaries,
    queryFn: async () =>
      unwrap(await supabase.from('v_register_detail').select('*').eq('session_id', sessionId).order('roll_no')) as RegisterDetailRow[],
  });
}

export function useRequestCorrection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { sessionId: string; changes: { student_id: string; to_status: string }[]; reason: string }) =>
      unwrap(await supabase.rpc('request_attendance_correction', { p_session: p.sessionId, p_changes: p.changes, p_reason: p.reason })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['register'] }),
  });
}

// ── Inbox: approvals and disputes ─────────────────────────────────────────
export function useLeavePending() {
  const staffId = useStaffId();
  return useQuery({
    queryKey: ['inbox', 'leave', staffId],
    enabled: !!staffId,
    staleTime: STALE.notices,
    queryFn: async () => unwrap(await supabase.from('v_leave_pending_for_me').select('*').order('from_date')) as LeavePendingRow[],
  });
}

export function useDecideLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; decision: 'approved' | 'rejected' | 'needs_info'; note?: string }) =>
      unwrap(await supabase.rpc('decide_leave', { p_request: p.id, p_decision: p.decision, p_note: p.note })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox'] }),
  });
}

export function useDisputesForMe() {
  const staffId = useStaffId();
  return useQuery({
    queryKey: ['inbox', 'disputes', staffId],
    enabled: !!staffId,
    staleTime: STALE.notices,
    queryFn: async () => unwrap(await supabase.from('v_disputes_for_me').select('*').order('created_at', { ascending: false }).limit(100)) as DisputeForMeRow[],
  });
}

export function useReplyDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; message: string; status?: 'resolved' | 'rejected' }) =>
      unwrap(await supabase.rpc('reply_dispute', { p_id: p.id, p_message: p.message, p_status: p.status })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox', 'disputes'] }),
  });
}

// ── Staff leave and announcements ─────────────────────────────────────────
export function useStaffLeave() {
  const staffId = useStaffId();
  return useQuery({
    queryKey: ['leave', 'staff', staffId],
    enabled: !!staffId,
    queryFn: async () => unwrap(await supabase.from('v_my_staff_leave').select('*').order('from_date', { ascending: false })) as StaffLeaveRow[],
  });
}

export function useApplyStaffLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { type: StaffLeaveType; from: string; to: string; reason: string }) =>
      unwrap(await supabase.rpc('apply_staff_leave', { p_type: p.type, p_from: p.from, p_to: p.to, p_reason: p.reason })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave', 'staff'] }),
  });
}

export function useCancelStaffLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.rpc('cancel_staff_leave', { p_id: id })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave', 'staff'] }),
  });
}

export function useCreateAnnouncement() {
  return useMutation({
    mutationFn: async (p: { divisionId: string; title: string; body: string; priority: string; includeParents: boolean }) =>
      unwrap(
        await supabase.rpc('create_class_announcement', {
          p_division: p.divisionId,
          p_title: p.title,
          p_body: p.body,
          p_priority: p.priority,
          p_include_parents: p.includeParents,
        }),
      ) as unknown as { id: string; recipients: number },
  });
}

/** Divisions the professor may announce to: class-teacher divisions plus divisions they teach. */
export function useAnnouncementDivisions() {
  const caps = useSession(s => s.caps);
  const groups = useTeachingGroups();
  const map = new Map<string, string>();
  for (const d of caps?.class_teacher_of ?? []) {
    map.set(d.division_id, d.label);
  }
  for (const g of groups.data ?? []) {
    if (g.division_id && g.division_label) {
      map.set(g.division_id, g.division_label);
    }
  }
  return { divisions: map, isPending: groups.isPending };
}

// ── HOD summary (read-only, §8.3) ─────────────────────────────────────────
export function useHodSummary(departmentId: string | null, date: string) {
  return useQuery({
    queryKey: ['sessions', 'hod', departmentId, date],
    enabled: !!departmentId,
    staleTime: STALE.summaries,
    queryFn: async () => {
      const [counts, faculty, divisions] = await Promise.all([
        supabase.rpc('register_counts', { p_date: date, p_department: departmentId! }).then(unwrap),
        supabase.rpc('faculty_submission', { p_days: 7, p_department: departmentId! }).then(unwrap),
        supabase.rpc('division_stats', { p_department: departmentId! }).then(unwrap),
      ]);
      return {
        counts: counts as unknown as RegisterCounts,
        faculty: (faculty ?? []) as FacultySubmissionRow[],
        divisions: (divisions ?? []) as DivisionStatsRow[],
      };
    },
  });
}
