// Queries shared by every persona. Keys always start with a scope id (§7.1).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '../../lib/errors';
import { STALE } from '../../lib/query-client';
import { supabase } from '../../lib/supabase';
import { useSession, useUserId } from '../../stores/session';
import type {
  AnnouncementRow,
  CalendarRow,
  Capabilities,
  ExamRow,
  NotificationPreferenceRow,
  NotificationRow,
  StatusCodeRow,
} from '../../types/database';

export function useCapabilities() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['caps', userId],
    enabled: !!userId,
    staleTime: STALE.sessions,
    queryFn: async () => unwrap(await supabase.rpc('my_capabilities')) as unknown as Capabilities,
  });
}

/** Live status codes (colours, professor_can_set) from attendance_status_codes. */
export function useStatusCodes() {
  return useQuery({
    queryKey: ['statusCodes'],
    staleTime: STALE.profile,
    queryFn: async () =>
      unwrap(await supabase.from('attendance_status_codes').select('*').eq('is_active', true).order('sort_order')) as StatusCodeRow[],
  });
}

export function useStatusCodeMap() {
  const q = useStatusCodes();
  return new Map((q.data ?? []).map(c => [c.code, c]));
}

/**
 * The student whose data a student/parent screen shows: the caller (student)
 * or the selected child (parent). Every query key includes it.
 */
export function useScopeStudentId(): string | null {
  const route = useSession(s => s.route);
  const childId = useSession(s => s.childId);
  const caps = useSession(s => s.caps);
  if (route === 'parent') {
    return childId;
  }
  return caps?.student_id ?? null;
}

export function useNotifications() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['notifications', userId],
    enabled: !!userId,
    staleTime: STALE.notices,
    queryFn: async () =>
      unwrap(await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100)) as NotificationRow[],
  });
}

export function useUnreadCount() {
  const q = useNotifications();
  return (q.data ?? []).filter(n => !n.read_at).length;
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (ids?: string[]) => unwrap(await supabase.rpc('mark_notifications_read', ids ? { p_ids: ids } : {})),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', userId] }),
  });
}

export function useAnnouncements() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['notices', userId],
    enabled: !!userId,
    staleTime: STALE.notices,
    queryFn: async () =>
      unwrap(await supabase.from('v_my_announcements').select('*').order('publish_at', { ascending: false }).limit(50)) as AnnouncementRow[],
  });
}

export function useMarkAnnouncementRead() {
  const qc = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (announcementId: string) =>
      unwrap(
        await supabase
          .from('announcement_recipients')
          .update({ read_at: new Date().toISOString() })
          .eq('announcement_id', announcementId)
          .eq('user_id', userId!),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notices', userId] }),
  });
}

export function useCalendar() {
  return useQuery({
    queryKey: ['calendar'],
    staleTime: STALE.profile,
    queryFn: async () => unwrap(await supabase.from('v_academic_calendar').select('*').order('starts_on')) as CalendarRow[],
  });
}

export function useExams(studentId: string | null) {
  return useQuery({
    queryKey: ['exams', studentId],
    enabled: !!studentId,
    staleTime: STALE.timetable,
    queryFn: async () =>
      unwrap(await supabase.from('v_my_exams').select('*').eq('student_id', studentId!).order('starts_at')) as ExamRow[],
  });
}

// ── Notification preferences (§11) ────────────────────────────────────────
export const PREF_EVENTS = {
  absence: 'student_marked_absent',
  shortage: 'shortage_warning',
} as const;

export function useNotificationPreferences() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['prefs', userId],
    enabled: !!userId,
    queryFn: async () => unwrap(await supabase.from('notification_preferences').select('*')) as NotificationPreferenceRow[],
  });
}

export function useSetPreference() {
  const qc = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (p: { event: string; channel?: string; enabled: boolean; mode?: 'instant' | 'digest' }) =>
      unwrap(
        await supabase.from('notification_preferences').upsert(
          { user_id: userId!, event: p.event, channel: p.channel ?? 'push', enabled: p.enabled, mode: p.mode ?? 'instant' },
          { onConflict: 'user_id,event,channel' },
        ),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prefs', userId] }),
  });
}
