// Typed param lists for every navigator (§4).
import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  Professor: NavigatorScreenParams<ProfessorStackParamList> | undefined;
  Student: NavigatorScreenParams<StudentStackParamList> | undefined;
  Parent: NavigatorScreenParams<ParentStackParamList> | undefined;
  PersonaSelect: undefined;
  UseWebPortal: undefined;
  UpdateRequired: { minVersion: string };
  /** Invite / reset links sign the user in first, so this lives at the root. */
  SetPassword: undefined;
};

export type AuthStackParamList = {
  SignIn: undefined;
  ForgotPassword: undefined;
};

/** Screens every persona stack registers under the same name. */
export type SharedStackParamList = {
  Notifications: undefined;
  Settings: undefined;
  Calendar: undefined;
  Exams: undefined;
  SubjectDetail: { offeringId: string; title: string };
  Profile: undefined;
  Faculty: undefined;
  NotificationPreferences: undefined;
  /** Student: "Report a problem" (dispute). Parent: "Ask about this" (query to the class teacher). */
  AskAboutRecord: { recordId: string; label: string };
};

export type ProfessorTabParamList = {
  ProfToday: undefined;
  ProfTimetable: undefined;
  ProfClasses: undefined;
  ProfInbox: undefined;
  ProfMore: undefined;
};

export type ProfessorStackParamList = SharedStackParamList & {
  ProfTabs: NavigatorScreenParams<ProfessorTabParamList> | undefined;
  /** `edit`: start an edit of a submitted register inside the edit window. */
  MarkAttendance: { sessionId: string; edit?: boolean };
  Register: { sessionId: string };
  Conflict: { sessionId: string };
  CorrectionRequest: { sessionId: string };
  ClassDetail: { groupId: string; title: string };
  LeaveApproval: { leaveId: string };
  DisputeThread: { disputeId: string };
  StaffLeave: undefined;
  NewStaffLeave: undefined;
  NewAnnouncement: undefined;
  HodSummary: undefined;
};

export type StudentTabParamList = {
  StuHome: undefined;
  StuAttendance: undefined;
  StuTimetable: undefined;
  StuLeave: undefined;
  StuMore: undefined;
};

export type StudentStackParamList = SharedStackParamList & {
  StuTabs: NavigatorScreenParams<StudentTabParamList> | undefined;
  NewLeave: undefined;
  LeaveDetail: { leaveId: string };
  MyDisputes: undefined;
};

export type ParentTabParamList = {
  ParHome: undefined;
  ParAttendance: { sessionId?: string } | undefined;
  ParSchedule: undefined;
  ParNotices: undefined;
  ParMore: undefined;
};

export type ParentStackParamList = SharedStackParamList & {
  ParTabs: NavigatorScreenParams<ParentTabParamList> | undefined;
  ParentLeave: undefined;
  MyDisputes: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
