// Auth / persona switch (§4). Screens are defined conditionally, so when the
// session or persona changes the whole tree is replaced and Back can never
// return to another persona's screens.
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SetPasswordScreen } from '../screens/auth/PasswordScreens';
import { PersonaSelectScreen, UpdateRequiredScreen, UseWebPortalScreen } from '../screens/shared/GateScreens';
import { useSession } from '../stores/session';
import { AuthNavigator } from './AuthNavigator';
import { useStackOptions } from './options';
import { ParentNavigator } from './ParentNavigator';
import { ProfessorNavigator } from './ProfessorNavigator';
import { StudentNavigator } from './StudentNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const signedIn = useSession(s => s.status === 'signedIn');
  const route = useSession(s => s.route);
  const options = useStackOptions();
  return (
    <Stack.Navigator screenOptions={{ ...options, headerShown: false }}>
      {!signedIn ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : route === 'professor' ? (
        <Stack.Screen name="Professor" component={ProfessorNavigator} />
      ) : route === 'student' ? (
        <Stack.Screen name="Student" component={StudentNavigator} />
      ) : route === 'parent' ? (
        <Stack.Screen name="Parent" component={ParentNavigator} />
      ) : route === 'choose' ? (
        <Stack.Screen name="PersonaSelect" component={PersonaSelectScreen} />
      ) : (
        <Stack.Screen name="UseWebPortal" component={UseWebPortalScreen} />
      )}
      <Stack.Screen name="UpdateRequired" component={UpdateRequiredScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="SetPassword" component={SetPasswordScreen} options={{ headerShown: true, title: 'Set password' }} />
    </Stack.Navigator>
  );
}
