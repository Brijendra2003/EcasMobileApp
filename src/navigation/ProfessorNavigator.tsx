// Professor (§6): Today · Timetable · Classes · Inbox · More, plus the stack.
import { useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { CalendarCheck, CalendarDays, Ellipsis, Inbox, Users } from 'lucide-react-native';
import { HeaderActions } from '../components/HeaderActions';
import { useLeavePending } from '../features/professor/api';
import { ClassDetailScreen, ClassesScreen } from '../screens/professor/ClassesScreens';
import { DisputeThreadScreen, InboxScreen, LeaveApprovalScreen } from '../screens/professor/InboxScreens';
import { MarkAttendanceScreen } from '../screens/professor/MarkAttendanceScreen';
import {
  HodSummaryScreen,
  NewAnnouncementScreen,
  NewStaffLeaveScreen,
  ProfessorMoreScreen,
  StaffLeaveScreen,
} from '../screens/professor/MoreScreens';
import { ConflictScreen, CorrectionRequestScreen, RegisterScreen } from '../screens/professor/RegisterScreens';
import { ProfessorTimetableScreen, ProfessorTodayScreen } from '../screens/professor/ScheduleScreens';
import { CalendarScreen, ExamsScreen, NotificationPreferencesScreen } from '../screens/shared/InfoScreens';
import { NotificationsScreen } from '../screens/shared/NotificationsScreen';
import { SettingsScreen } from '../screens/shared/SettingsScreen';
import { useSyncStatus } from '../stores/sync';
import { tabIcon, useStackOptions, useTabOptions } from './options';
import type { ProfessorStackParamList, ProfessorTabParamList } from './types';

const Tab = createBottomTabNavigator<ProfessorTabParamList>();
const Stack = createNativeStackNavigator<ProfessorStackParamList>();

function ProfessorTabs() {
  const { t } = useTranslation();
  const pending = useSyncStatus(s => s.pending);
  const leave = useLeavePending();
  const toDecide = (leave.data ?? []).filter(l => l.status === 'pending').length;
  const headerRight = useCallback(() => <HeaderActions sync />, []);
  const options = useTabOptions(headerRight);
  return (
    <Tab.Navigator screenOptions={options}>
      <Tab.Screen
        name="ProfToday"
        component={ProfessorTodayScreen}
        options={{ title: t('tabs.today'), tabBarIcon: tabIcon(CalendarCheck), tabBarBadge: pending > 0 ? pending : undefined }}
      />
      <Tab.Screen name="ProfTimetable" component={ProfessorTimetableScreen} options={{ title: t('tabs.timetable'), tabBarIcon: tabIcon(CalendarDays) }} />
      <Tab.Screen name="ProfClasses" component={ClassesScreen} options={{ title: t('tabs.classes'), tabBarIcon: tabIcon(Users) }} />
      <Tab.Screen
        name="ProfInbox"
        component={InboxScreen}
        options={{ title: t('tabs.inbox'), tabBarIcon: tabIcon(Inbox), tabBarBadge: toDecide > 0 ? toDecide : undefined }}
      />
      <Tab.Screen name="ProfMore" component={ProfessorMoreScreen} options={{ title: t('tabs.more'), tabBarIcon: tabIcon(Ellipsis) }} />
    </Tab.Navigator>
  );
}

export function ProfessorNavigator() {
  const { t } = useTranslation();
  const options = useStackOptions();
  return (
    <Stack.Navigator screenOptions={options}>
      <Stack.Screen name="ProfTabs" component={ProfessorTabs} options={{ headerShown: false }} />
      <Stack.Screen name="MarkAttendance" component={MarkAttendanceScreen} options={{ title: 'Mark attendance' }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Register' }} />
      <Stack.Screen name="Conflict" component={ConflictScreen} options={{ title: 'Resolve conflict' }} />
      <Stack.Screen name="CorrectionRequest" component={CorrectionRequestScreen} options={{ title: 'Request correction' }} />
      <Stack.Screen name="ClassDetail" component={ClassDetailScreen} options={({ route }) => ({ title: route.params.title ?? 'Class' })} />
      <Stack.Screen name="LeaveApproval" component={LeaveApprovalScreen} options={{ title: 'Leave request' }} />
      <Stack.Screen name="DisputeThread" component={DisputeThreadScreen} options={{ title: 'Question' }} />
      <Stack.Screen name="StaffLeave" component={StaffLeaveScreen} options={{ title: 'Staff leave' }} />
      <Stack.Screen name="NewStaffLeave" component={NewStaffLeaveScreen} options={{ title: 'Apply for leave' }} />
      <Stack.Screen name="NewAnnouncement" component={NewAnnouncementScreen} options={{ title: 'Class announcement' }} />
      <Stack.Screen name="HodSummary" component={HodSummaryScreen} options={{ title: 'Department summary' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: t('common.notifications') }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: t('common.settings') }} />
      <Stack.Screen name="Calendar" component={CalendarScreen} options={{ title: t('common.calendar') }} />
      <Stack.Screen name="Exams" component={ExamsScreen} options={{ title: t('common.exams') }} />
      <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} options={{ title: 'Notification preferences' }} />
    </Stack.Navigator>
  );
}
