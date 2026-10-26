import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ForgotPasswordScreen } from '../screens/auth/PasswordScreens';
import { SignInScreen } from '../screens/auth/SignInScreen';
import { useStackOptions } from './options';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

/** SignIn and ForgotPassword. SetPassword lives at the root (invite links sign the user in first). */
export function AuthNavigator() {
  const options = useStackOptions();
  return (
    <Stack.Navigator screenOptions={options}>
      <Stack.Screen name="SignIn" component={SignInScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Reset password' }} />
    </Stack.Navigator>
  );
}
