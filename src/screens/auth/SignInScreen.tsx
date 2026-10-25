import { useState } from 'react';
import { Image, View } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/Button';
import { Banner } from '../../components/feedback';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { signInWithPassword } from '../../features/auth/api';
import { errorMessage } from '../../lib/errors';
import type { AuthStackParamList } from '../../navigation/types';
import { useSession } from '../../stores/session';

const schema = z.object({
  email: z.email('Enter your college email'),
  password: z.string().min(6, 'Enter your password'),
});
type Form = z.infer<typeof schema>;

export function SignInScreen({ navigation }: NativeStackScreenProps<AuthStackParamList, 'SignIn'>) {
  const reason = useSession(s => s.signOutReason);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const onSubmit = handleSubmit(async values => {
    setError(null);
    useSession.getState().setSignOutReason(null);
    try {
      await signInWithPassword(values.email, values.password);
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <Screen topInset>
      <View className="mb-8 mt-10 items-center">
        <Image source={require('../../assets/logo.png')} className="mb-4 h-20 w-20" resizeMode="contain" accessibilityIgnoresInvertColors />
        <Text variant="title">Attendance</Text>
        <Text variant="muted">Professors and students</Text>
      </View>
      {reason ? (
        <View className="mb-4">
          <Banner tone="warn">{reason}</Banner>
        </View>
      ) : null}
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <TextField
            label="College email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <TextField
            label="Password"
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            onSubmitEditing={onSubmit}
            error={fieldState.error?.message}
          />
        )}
      />
      {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}
      <Button title="Sign in" onPress={onSubmit} loading={formState.isSubmitting} />
      <Button variant="ghost" title="Forgot password?" className="mt-2" onPress={() => navigation.navigate('ForgotPassword')} />

      <View className="my-8 h-px bg-line" />
      <Text variant="subheading" className="mb-1 text-center">
        Parent or guardian?
      </Text>
      <Text variant="muted" className="mb-3 text-center">
        Sign in with the mobile number the college has on record.
      </Text>
      <Button variant="secondary" title="Sign in with mobile number" onPress={() => navigation.navigate('Phone')} />
    </Screen>
  );
}
