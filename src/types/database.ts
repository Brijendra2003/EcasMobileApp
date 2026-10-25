// Database types for the endpoints the mobile app uses (§7.3).
// Hand-written from Webapp/supabase/migrations + backend/20261026000100_mobile_api.sql
// until `supabase gen types typescript` can run in CI; regenerate then and
// delete this note.
/* eslint-disable @typescript-eslint/no-explicit-any */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type View<Row> = { Row: Row; Relationships: [] };
type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Component = 'TH' | 'PR' | 'TUT';
export type SessionStatus = 'scheduled' | 'held' | 'cancelled' | 'rescheduled';
export type RegisterState = 'pending' | 'submitted' | 'locked' | 'reopened' | 'voided';
export type LeaveType = 'full_day' | 'half_day' | 'session' | 'medical';
export type LeaveStatus = 'pending' | 'needs_info' | 'approved' | 'rejected' | 'cancelled';
export type StaffLeaveType = 'casual' | 'medical' | 'duty' | 'earned';

export interface MySessionRow {
  id: string;
  session_date: string;
  starts_at: string;
  ends_at: string;
  start_time: string;
  end_time: string;
  component: Component;
  session_type: string;
  room_label: string | null;
  status: SessionStatus;
  cancel_reason: string | null;
  rescheduled_from_id: string | null;
  rescheduled_to_id: string | null;
  subject_code: string;
  subject_name: string;
  offering_id: string;
  teaching_group_id: string;
  term_id: string;
  department_id: string;
  group_label: string;
  my_role: 'primary' | 'co' | 'substitute';
  substitute_name: string | null;
  register_state: RegisterState | null;
  register_version: number | null;
  submitted_at: string | null;
  locked_at: string | null;
  reopen_until: string | null;
  present_count: number | null;
  total_count: number | null;
  is_late: boolean | null;
  marking_opens_at: string;
  edit_until: string | null;
  locks_at: string;
  default_unmarked_status: string;
}

export interface RosterRow {
  session_id: string;
  student_id: string;
  full_name: string;
  roll_no: number | null;
  batch_code: string | null;
  suggested_status: string | null;
  photo_url: string | null;
}

export interface RegisterDetailRow {
  session_id: string;
  record_id: string;
  student_id: string;
  full_name: string;
  roll_no: number | null;
  status_code: string;
  source: string;
  marked_at: string;
}

export interface TeachingGroupRow {
  group_id: string;
  component: Component;
  kind: 'division' | 'batch' | 'custom';
  group_label: string;
  subject_code: string;
  subject_name: string;
  offering_id: string;
  term_id: string;
  department_id: string;
  my_role: string;
  division_id: string | null;
  division_label: string | null;
}

export interface LeavePendingRow {
  id: string;
  student_id: string;
  full_name: string;
  roll_no: number | null;
  division_label: string | null;
  leave_type: LeaveType;
  from_date: string;
  to_date: string;
  starts_at: string;
  ends_at: string;
  reason: string;
  status: LeaveStatus;
  has_document: boolean;
  created_at: string;
  session_count: number;
}

export interface StaffLeaveRow {
  id: string;
  leave_type: StaffLeaveType;
  from_date: string;
  to_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  decided_at: string | null;
  substitute_arranged: boolean;
  created_at: string;
}

export interface ThreadEntry {
  by: string;
  role: 'student' | 'parent' | 'staff' | 'author';
  message: string;
  at: string;
}

export interface DisputeForMeRow {
  id: string;
  record_id: string;
  message: string;
  status: 'open' | 'resolved' | 'rejected';
  thread: ThreadEntry[];
  created_at: string;
  session_id: string;
  student_id: string;
  full_name: string;
  roll_no: number | null;
  status_code: string;
  session_date: string;
  subject_code: string;
  subject_name: string;
  component: Component;
  from_guardian: boolean;
}

export interface MyDisputeRow {
  id: string;
  record_id: string;
  message: string;
  status: 'open' | 'resolved' | 'rejected';
  thread: ThreadEntry[];
  created_at: string;
  resolved_at: string | null;
  student_id: string;
  session_id: string;
  session_date: string;
  status_code: string;
  component: Component;
  subject_code: string;
  subject_name: string;
}

export interface ChildRow {
  student_id: string;
  full_name: string;
  enrollment_no: string;
  is_primary: boolean;
  relation: string;
  program_year: string | null;
  semester: number | null;
  roll_no: number | null;
  department_code: string | null;
  division_label: string | null;
  batch_code: string | null;
}

export interface ProfileRow {
  student_id: string;
  enrollment_no: string;
  prn: string | null;
  full_name: string;
  gender: string | null;
  dob: string | null;
  email: string | null;
  phone: string | null;
  admission_year: number;
  admission_type: string;
  status: string;
  department_id: string;
  department_code: string;
  department_name: string | null;
  program_year: string | null;
  semester: number | null;
  division_label: string | null;
  batch_code: string | null;
  roll_no: number | null;
  enrollment_type: string | null;
  subjects: { code: string; name: string; credits: number; is_elective: boolean }[];
}

export interface FacultyRow {
  student_id: string;
  subject_code: string | null;
  subject_name: string | null;
  component: Component | null;
  staff_name: string;
  designation: string;
  role: 'primary' | 'co' | 'substitute' | 'class_teacher';
}

export interface SummaryRow {
  student_id: string;
  offering_id: string;
  term_id: string;
  term_label: string;
  term_status: 'planned' | 'active' | 'archived';
  subject_code: string;
  subject_name: string;
  component: Component;
  held: number;
  attended: number;
  excused: number;
  percent: number | null;
  updated_at: string;
  absent: number;
  remaining: number;
  min_percent: number;
  warn_percent: number;
}

export interface TimetableRow {
  student_id: string;
  session_id: string;
  session_date: string;
  starts_at: string;
  ends_at: string;
  start_time: string;
  end_time: string;
  component: Component;
  session_type: string;
  room_label: string | null;
  status: SessionStatus;
  cancel_reason: string | null;
  rescheduled_to_id: string | null;
  rescheduled_from_id: string | null;
  subject_code: string;
  subject_name: string;
  offering_id: string;
  staff_name: string | null;
  has_substitute: boolean;
  my_status: string | null;
}

export interface ExamRow {
  student_id: string;
  exam_session_id: string;
  exam_id: string;
  exam_title: string;
  exam_type: string;
  exam_type_name: string;
  subject_code: string;
  subject_name: string;
  starts_at: string;
  ends_at: string;
  room_label: string | null;
  my_status: 'present' | 'absent' | 'exempted' | null;
}

export interface LeaveRow {
  id: string;
  student_id: string;
  leave_type: LeaveType;
  from_date: string;
  to_date: string;
  starts_at: string;
  ends_at: string;
  reason: string;
  status: LeaveStatus;
  decision_note: string | null;
  decided_at: string | null;
  has_document: boolean;
  created_at: string;
  session_count: number;
}

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  priority: 'normal' | 'important' | 'urgent';
  audience: string;
  publish_at: string;
  expires_at: string | null;
  author_name: string;
  read_at: string | null;
}

export interface CalendarRow {
  id: string;
  title: string;
  kind: 'holiday' | 'exam' | 'event' | 'working_override';
  starts_on: string;
  ends_on: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  data: Record<string, any>;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreferenceRow {
  user_id: string;
  event: string;
  channel: string;
  enabled: boolean;
  mode: 'instant' | 'digest';
}

export interface StatusCodeRow {
  code: string;
  label: string;
  color: string;
  counts_as_attended: boolean;
  counts_in_held: boolean;
  professor_can_set: boolean;
  requires_reason: boolean;
  sort_order: number;
  is_active: boolean;
}

export interface Capabilities {
  user_id: string;
  display_name: string;
  is_active: boolean;
  roles: string[];
  staff_id: string | null;
  student_id: string | null;
  guardian_id: string | null;
  class_teacher_of: { division_id: string; label: string }[];
  hod_of: { department_id: string; code: string; name: string }[];
  teaching_groups: number;
  exam_duties: number;
  config: {
    min_mobile_version: string;
    maintenance_banner: string | null;
    marking_opens_minutes: number;
    roster_photos: boolean;
  };
}

export interface SubmitResult {
  result: 'ok' | 'duplicate' | 'conflict' | 'locked' | 'cancelled';
  register?: { version: number; state: RegisterState; submitted_at: string | null; [k: string]: any };
  defaulted_students?: { student_id: string; status: string }[];
  records?: { student_id: string; status: string }[];
}

export interface ClassStats {
  group_id: string;
  group_label: string;
  subject_code: string;
  subject_name: string;
  component: Component;
  min_percent: number;
  warn_percent: number;
  sessions: { scheduled: number; held: number; due: number; missing: number; cancelled: number };
  students: { student_id: string; full_name: string; roll_no: number | null; held: number; attended: number; percent: number | null }[];
}

export interface SubjectAttendance {
  student_id: string;
  offering_id: string;
  subject_code: string;
  subject_name: string;
  min_percent: number;
  warn_percent: number;
  sessions: {
    record_id: string;
    session_id: string;
    session_date: string;
    start_time: string;
    end_time: string;
    component: Component;
    session_type: string;
    status: string;
    submitted_at: string | null;
    marked_at: string;
    open_dispute: boolean;
  }[];
}

export interface RegisterCounts {
  total: number;
  held: number;
  pending: number;
  upcoming: number;
  missing: number;
  cancelled: number;
  reopened: number;
  late: number;
  present: number;
  roster: number;
}

export interface FacultySubmissionRow {
  staff_id: string;
  full_name: string;
  designation: string;
  department_code: string;
  on_time: number;
  late: number;
  missing: number;
  pending: number;
  total: number;
  on_time_percent: number | null;
}

export interface DivisionStatsRow {
  division_id: string;
  label: string;
  department_code: string;
  program_year: string;
  students: number;
  percent: number | null;
  shortage: number;
}

export type Database = {
  public: {
    Tables: {
      notifications: Table<NotificationRow>;
      notification_preferences: Table<NotificationPreferenceRow>;
      attendance_status_codes: Table<StatusCodeRow>;
      announcement_recipients: Table<{ announcement_id: string; user_id: string; delivered_at: string | null; read_at: string | null }>;
    };
    Views: {
      v_my_sessions: View<MySessionRow>;
      v_my_teaching_groups: View<TeachingGroupRow>;
      v_register_detail: View<RegisterDetailRow>;
      v_leave_pending_for_me: View<LeavePendingRow>;
      v_my_staff_leave: View<StaffLeaveRow>;
      v_disputes_for_me: View<DisputeForMeRow>;
      v_my_disputes: View<MyDisputeRow>;
      v_my_children: View<ChildRow>;
      v_my_profile: View<ProfileRow>;
      v_my_faculty: View<FacultyRow>;
      v_my_attendance_summary: View<SummaryRow>;
      v_my_timetable: View<TimetableRow>;
      v_my_exams: View<ExamRow>;
      v_my_leave: View<LeaveRow>;
      v_my_announcements: View<AnnouncementRow>;
      v_academic_calendar: View<CalendarRow>;
    };
    Functions: {
      my_capabilities: { Args: Record<string, never>; Returns: Json };
      link_guardian_account: { Args: Record<string, never>; Returns: number };
      register_device: {
        Args: { p_token: string; p_platform: string; p_app_version?: string; p_device_id?: string };
        Returns: undefined;
      };
      unregister_device: { Args: { p_token: string }; Returns: undefined };
      mark_notifications_read: { Args: { p_ids?: string[] }; Returns: number };
      session_roster_for_marking: { Args: { p_session: string }; Returns: RosterRow[] };
      my_rosters_for_window: { Args: { p_from: string; p_to: string }; Returns: RosterRow[] };
      submit_attendance: {
        Args: {
          p_session_id: string;
          p_client_submission_id: string;
          p_base_version: number;
          p_records: Json;
          p_client_marked_at?: string;
          p_device_id?: string;
        };
        Returns: Json;
      };
      class_attendance_stats: { Args: { p_group: string; p_term?: string }; Returns: Json };
      request_attendance_correction: { Args: { p_session: string; p_changes: Json; p_reason: string }; Returns: number };
      decide_leave: { Args: { p_request: string; p_decision: string; p_note?: string }; Returns: string };
      apply_staff_leave: { Args: { p_type: string; p_from: string; p_to: string; p_reason: string }; Returns: string };
      cancel_staff_leave: { Args: { p_id: string }; Returns: undefined };
      create_class_announcement: {
        Args: { p_division: string; p_title: string; p_body: string; p_priority?: string; p_include_parents?: boolean };
        Returns: Json;
      };
      reply_dispute: { Args: { p_id: string; p_message: string; p_status?: string }; Returns: undefined };
      my_subject_attendance: { Args: { p_offering: string; p_student?: string }; Returns: Json };
      apply_leave: { Args: { p: Json }; Returns: string };
      cancel_leave: { Args: { p_id: string }; Returns: undefined };
      raise_attendance_dispute: { Args: { p_record: string; p_message: string }; Returns: string };
      raise_guardian_query: { Args: { p_student: string; p_record: string; p_message: string }; Returns: string };
      register_counts: { Args: { p_date: string; p_department?: string }; Returns: Json };
      faculty_submission: { Args: { p_days: number; p_department?: string }; Returns: FacultySubmissionRow[] };
      division_stats: { Args: { p_department?: string; p_program_year?: string }; Returns: DivisionStatsRow[] };
      touch_last_seen: { Args: Record<string, never>; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
