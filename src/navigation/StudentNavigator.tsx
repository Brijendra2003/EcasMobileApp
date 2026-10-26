// Student (§6): Home · Attendance · Timetable · Leave · More, plus the stack.
import { useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ChartColumn, ClipboardCheck, Ellipsis, House } from 'lucide-react-native';
import { HeaderActions } from '../components/HeaderActions';
import { CalendarScreen, ExamsScreen, NotificationPreferencesScreen } from '../screens/shared/InfoScreens';
import { NotificationsScreen } from '../screens/shared/NotificationsScreen';
import { SettingsScreen } from '../screens/shared/SettingsScreen';
import { AskAboutRecordScreen, FacultyScreen, MyDisputesScreen, ProfileScreen } from '../screens/shared/StudentInfoScreens';
import { SubjectDetailScreen } from '../screens/shared/SubjectDetailScreen';
import { LeaveDetailScreen, NewLeaveScreen, StudentLeaveScreen } from '../screens/student/LeaveScreens';
import {
  StudentAttendanceScreen,
  StudentHomeScreen,
  StudentMoreScreen,
  StudentTimetableScreen,
} from '../screens/student/StudentScreens';
import { tabIcon, useStackOptions, useTabOptions } from './options';
import type { StudentStackParamList, StudentTabParamList } from './types';

const Tab = createBottomTabNavigator<StudentTabParamList>();
const Stack = createNativeStackNavigator<StudentStackParamList>();

function StudentTabs() {
  const { t } = useTranslation();
  const headerRight = useCallback(() => <HeaderActions />, []);
  const options = useTabOptions(headerRight);
  return (
    <Tab.Navigator screenOptions={options}>
      <Tab.Screen name="StuHome" component={StudentHomeScreen} options={{ title: t('tabs.home'), tabBarIcon: tabIcon(House) }} />
      <Tab.Screen name="StuAttendance" component={StudentAttendanceScreen} options={{ title: t('tabs.attendance'), tabBarIcon: tabIcon(ChartColumn) }} />
      <Tab.Screen name="StuTimetable" component={StudentTimetableScreen} options={{ title: t('tabs.timetable'), tabBarIcon: tabIcon(CalendarDays) }} />
      <Tab.Screen name="StuLeave" component={StudentLeaveScreen} options={{ title: t('tabs.leave'), tabBarIcon: tabIcon(ClipboardCheck) }} />
      <Tab.Screen name="StuMore" component={StudentMoreScreen} options={{ title: t('tabs.more'), tabBarIcon: tabIcon(Ellipsis) }} />
    </Tab.Navigator>
  );
}

export function StudentNavigator() {
  const { t } = useTranslation();
  const options = useStackOptions();
  return (
    <Stack.Navigator screenOptions={options}>
      <Stack.Screen name="StuTabs" component={StudentTabs} options={{ headerShown: false }} />
      <Stack.Screen name="SubjectDetail" component={SubjectDetailScreen} options={({ route }) => ({ title: route.params.title ?? t('tabs.attendance') })} />
      <Stack.Screen name="AskAboutRecord" component={AskAboutRecordScreen} options={{ title: 'Report a problem' }} />
      <Stack.Screen name="NewLeave" component={NewLeaveScreen} options={{ title: 'Apply for leave' }} />
      <Stack.Screen name="LeaveDetail" component={LeaveDetailScreen} options={{ title: 'Leave request' }} />
      <Stack.Screen name="MyDisputes" component={MyDisputesScreen} options={{ title: 'Reported problems' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: t('common.profile') }} />
      <Stack.Screen name="Faculty" component={FacultyScreen} options={{ title: 'My faculty' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: t('common.notifications') }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: t('common.settings') }} />
      <Stack.Screen name="Calendar" component={CalendarScreen} options={{ title: t('common.calendar') }} />
      <Stack.Screen name="Exams" component={ExamsScreen} options={{ title: t('common.exams') }} />
      <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} options={{ title: 'Notification preferences' }} />
    </Stack.Navigator>
  );
}
