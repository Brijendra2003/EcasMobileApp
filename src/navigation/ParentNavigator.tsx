// Parent (§6, §11): Home · Attendance · Schedule · Notices · More, with the
// child switcher as the header title. Every query is scoped to a valid,
// verified child, so the tree only renders once one is selected.
import { useCallback, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ChartColumn, Ellipsis, House, Newspaper } from 'lucide-react-native';
import { ErrorState, LoadingState } from '../components/feedback';
import { HeaderActions } from '../components/HeaderActions';
import { Screen } from '../components/Screen';
import { useChildren } from '../features/attendance/api';
import {
  ChildSwitcher,
  NoChildrenScreen,
  NoticesScreen,
  ParentAttendanceScreen,
  ParentHomeScreen,
  ParentMoreScreen,
  ParentScheduleScreen,
} from '../screens/parent/ParentScreens';
import { CalendarScreen, ExamsScreen, NotificationPreferencesScreen } from '../screens/shared/InfoScreens';
import { NotificationsScreen } from '../screens/shared/NotificationsScreen';
import { SettingsScreen } from '../screens/shared/SettingsScreen';
import { AskAboutRecordScreen, FacultyScreen, MyDisputesScreen, ProfileScreen } from '../screens/shared/StudentInfoScreens';
import { SubjectDetailScreen } from '../screens/shared/SubjectDetailScreen';
import { useSession, useUserId } from '../stores/session';
import { tabIcon, useStackOptions, useTabOptions } from './options';
import type { ParentStackParamList, ParentTabParamList } from './types';

const Tab = createBottomTabNavigator<ParentTabParamList>();
const Stack = createNativeStackNavigator<ParentStackParamList>();

const childTitle = () => <ChildSwitcher />;

function ParentTabs() {
  const { t } = useTranslation();
  const headerRight = useCallback(() => <HeaderActions />, []);
  const base = useTabOptions(headerRight);
  const options = { ...base, headerTitle: childTitle, headerTitleAlign: 'left' as const };
  return (
    <Tab.Navigator screenOptions={options}>
      <Tab.Screen name="ParHome" component={ParentHomeScreen} options={{ tabBarLabel: t('tabs.home'), tabBarIcon: tabIcon(House) }} />
      <Tab.Screen name="ParAttendance" component={ParentAttendanceScreen} options={{ tabBarLabel: t('tabs.attendance'), tabBarIcon: tabIcon(ChartColumn) }} />
      <Tab.Screen name="ParSchedule" component={ParentScheduleScreen} options={{ tabBarLabel: t('tabs.schedule'), tabBarIcon: tabIcon(CalendarDays) }} />
      <Tab.Screen name="ParNotices" component={NoticesScreen} options={{ tabBarLabel: t('tabs.notices'), tabBarIcon: tabIcon(Newspaper) }} />
      <Tab.Screen name="ParMore" component={ParentMoreScreen} options={{ tabBarLabel: t('tabs.more'), tabBarIcon: tabIcon(Ellipsis) }} />
    </Tab.Navigator>
  );
}

export function ParentNavigator() {
  const { t } = useTranslation();
  const options = useStackOptions();
  const userId = useUserId();
  const children = useChildren(userId);
  const childId = useSession(s => s.childId);
  const list = children.data;
  const valid = !!childId && !!list?.some(c => c.student_id === childId);

  // Keep the remembered child only while it is still a verified link; otherwise pick the primary one.
  useEffect(() => {
    if (!list || valid) {
      return;
    }
    const next = list.find(c => c.is_primary) ?? list[0];
    useSession.getState().setChild(next?.student_id ?? null);
  }, [list, valid]);

  if (!list) {
    return <Screen topInset>{children.error ? <ErrorState error={children.error} onRetry={() => children.refetch()} /> : <LoadingState />}</Screen>;
  }
  if (list.length === 0) {
    return <NoChildrenScreen />;
  }
  if (!valid) {
    return (
      <Screen topInset>
        <LoadingState />
      </Screen>
    );
  }
  return (
    <Stack.Navigator screenOptions={options}>
      <Stack.Screen name="ParTabs" component={ParentTabs} options={{ headerShown: false }} />
      <Stack.Screen name="SubjectDetail" component={SubjectDetailScreen} options={({ route }) => ({ title: route.params.title ?? t('tabs.attendance') })} />
      <Stack.Screen name="AskAboutRecord" component={AskAboutRecordScreen} options={{ title: t('parent.askTitle') }} />
      <Stack.Screen name="MyDisputes" component={MyDisputesScreen} options={{ title: 'My questions' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: t('common.profile') }} />
      <Stack.Screen name="Faculty" component={FacultyScreen} options={{ title: 'Faculty' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: t('common.notifications') }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: t('common.settings') }} />
      <Stack.Screen name="Calendar" component={CalendarScreen} options={{ title: t('common.calendar') }} />
      <Stack.Screen name="Exams" component={ExamsScreen} options={{ title: t('common.exams') }} />
      <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} options={{ title: t('parent.preferences') }} />
    </Stack.Navigator>
  );
}
