// Parent sign-in (§5.1): mobile number + OTP. The number must match a guardian
// record whose link the college verified; there is no self-registration.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { sendOtp, verifyOtp } from '../../features/auth/api';
import { errorMessage } from '../../lib/errors';
import type { AuthStackParamList } from '../../navigation/types';

const PHONE = /^[6-9]\d{9}$/;

export function PhoneScreen({ navigation }: NativeStackScreenProps<AuthStackParamList, 'Phone'>) {
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const digits = phone.replace(/\D/g, '').slice(-10);

  const submit = async () => {
    if (!PHONE.test(digits)) {
      setError('Enter a 10-digit Indian mobile number');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendOtp(digits);
      navigation.navigate('VerifyOtp', { phone: digits });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text variant="muted" className="mb-6">
        We'll send a 6-digit code by SMS to the number the college has on record for you.
      </Text>
      <TextField
        label="Mobile number"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        placeholder="98XXXXXXXX"
        value={phone}
        onChangeText={setPhone}
        onSubmitEditing={submit}
        error={error ?? undefined}
        maxLength={14}
      />
      <Button title="Send code" onPress={submit} loading={busy} />
    </Screen>
  );
}

export function VerifyOtpScreen({ route }: NativeStackScreenProps<AuthStackParamList, 'VerifyOtp'>) {
  const { phone } = route.params;
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(30);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const id = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const verify = async (value = code) => {
    if (!/^\d{6}$/.test(value)) {
      setError('Enter the 6-digit code');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyOtp(phone, value);
      // The session listener routes to the parent experience.
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setCooldown(30);
    try {
      await sendOtp(phone);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Screen>
      <Text variant="muted" className="mb-6">
        Enter the code sent to +91 {phone.slice(0, 5)} {phone.slice(5)}.
      </Text>
      <TextField
        label="6-digit code"
        keyboardType="number-pad"
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        maxLength={6}
        value={code}
        onChangeText={v => {
          setCode(v);
          if (v.length === 6) {
            verify(v);
          }
        }}
        error={error ?? undefined}
      />
      <Button title="Verify" onPress={() => verify()} loading={busy} />
      <View className="mt-3">
        <Button variant="ghost" title={cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'} disabled={cooldown > 0} onPress={resend} />
      </View>
    </Screen>
  );
}
