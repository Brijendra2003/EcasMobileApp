import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { Banner } from '../../components/feedback';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { requestPasswordReset, updatePassword } from '../../features/auth/api';
import { errorMessage } from '../../lib/errors';
import type { RootStackParamList } from '../../navigation/types';

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter your college email');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      {sent ? (
        <Banner tone="safe">If an account exists for that email, a reset link is on its way. Open it on this phone.</Banner>
      ) : (
        <>
          <Text variant="muted" className="mb-6">
            We'll email you a link to set a new password.
          </Text>
          <TextField
            label="College email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={submit}
            error={error ?? undefined}
          />
          <Button title="Send reset link" onPress={submit} loading={busy} />
        </>
      )}
    </Screen>
  );
}

/** Reached from invite and reset links (collegeapp://set-password) after the link signed the user in. */
export function SetPasswordScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'SetPassword'>) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (password.length < 8) {
      setError('Use at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError("The passwords don't match");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      navigation.goBack();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text variant="muted" className="mb-6">
        Choose a password for your account.
      </Text>
      <TextField label="New password" secureTextEntry autoComplete="new-password" textContentType="newPassword" value={password} onChangeText={setPassword} />
      <TextField
        label="Confirm password"
        secureTextEntry
        autoComplete="new-password"
        value={confirm}
        onChangeText={setConfirm}
        onSubmitEditing={submit}
        error={error ?? undefined}
      />
      <Button title="Save password" onPress={submit} loading={busy} />
    </Screen>
  );
}
