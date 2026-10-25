import { useState } from 'react';
import { Alert, Linking, Switch, View } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react-native';
import { Button } from '../../components/Button';
import { SectionTitle } from '../../components/feedback';
import { ListGroup, ListRow } from '../../components/ListRow';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../components/theme';
import { Text } from '../../components/Text';
import { signOut, UnsyncedWorkError } from '../../features/auth/api';
import { appLockEnabled, disableAppLock, enableAppLock } from '../../lib/app-lock';
import { errorMessage } from '../../lib/errors';
import { LANGUAGES, setLanguage, type Language } from '../../lib/i18n';
import { personasFor, type Persona } from '../../lib/personas';
import { syncNow } from '../../offline/service';
import type { SharedStackParamList } from '../../navigation/types';
import { useSession } from '../../stores/session';

const PERSONA_LABEL: Record<Persona, string> = { professor: 'Professor', student: 'Student', parent: 'Parent' };

export async function confirmSignOut() {
  try {
    await signOut();
  } catch (e) {
    if (e instanceof UnsyncedWorkError) {
      Alert.alert('Registers not synced', e.message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sync now', onPress: () => syncNow(true).catch(() => {}) },
      ]);
    } else {
      Alert.alert('Sign out failed', errorMessage(e));
    }
  }
}

export function SettingsScreen({ navigation }: NativeStackScreenProps<SharedStackParamList, 'Settings'>) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const route = useSession(s => s.route);
  const caps = useSession(s => s.caps);
  const [lock, setLock] = useState(appLockEnabled());
  const personas = personasFor(caps?.roles ?? []);
  // Marathi and Hindi first for parents (§14).
  const languages = route === 'parent' ? [...LANGUAGES.slice(1), LANGUAGES[0]] : LANGUAGES;

  const toggleLock = async (on: boolean) => {
    if (on) {
      const ok = await enableAppLock();
      if (!ok) {
        Alert.alert('App lock', 'Set up a screen lock or fingerprint on this phone first.');
      }
      setLock(ok);
    } else {
      await disableAppLock();
      setLock(false);
    }
  };

  const requestDeletion = () => {
    Alert.alert(
      'Delete account',
      'Your request goes to the college office. Academic and attendance records are kept for as long as the law requires; your app login and contact details are removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Email the office',
          onPress: () =>
            Linking.openURL(`mailto:?subject=${encodeURIComponent('Account deletion request')}&body=${encodeURIComponent(`Please delete my app account (${caps?.display_name ?? ''}).`)}`).catch(() => {}),
        },
      ],
    );
  };

  return (
    <Screen>
      <SectionTitle>{t('common.language')}</SectionTitle>
      <ListGroup>
        {languages.map((l, i) => (
          <ListRow
            key={l.code}
            title={l.label}
            last={i === languages.length - 1}
            right={i18n.language === l.code ? <Check size={18} color={colors.primary} /> : undefined}
            onPress={() => setLanguage(l.code as Language)}
          />
        ))}
      </ListGroup>

      <SectionTitle>{t('common.notifications')}</SectionTitle>
      <ListGroup>
        <ListRow title="Notification preferences" last onPress={() => navigation.navigate('NotificationPreferences')} />
      </ListGroup>

      <SectionTitle>Security</SectionTitle>
      <ListGroup>
        <ListRow
          title="App lock"
          subtitle="Fingerprint, face or phone PIN after 5 minutes away"
          last
          right={<Switch value={lock} onValueChange={toggleLock} accessibilityLabel="App lock" />}
        />
      </ListGroup>

      {personas.length > 1 ? (
        <>
          <SectionTitle>Switch role</SectionTitle>
          <ListGroup>
            {personas.map((p, i) => (
              <ListRow
                key={p}
                title={PERSONA_LABEL[p]}
                last={i === personas.length - 1}
                right={route === p ? <Check size={18} color={colors.primary} /> : undefined}
                onPress={route === p ? undefined : () => useSession.getState().choosePersona(p)}
              />
            ))}
          </ListGroup>
        </>
      ) : null}

      <View className="mt-8 gap-3">
        <Button variant="secondary" title={t('common.signOut')} onPress={confirmSignOut} />
        <Button variant="ghost" title="Request account deletion" onPress={requestDeletion} />
      </View>
      <Text variant="caption" className="mt-6 text-center">
        Version {DeviceInfo.getVersion()} ({DeviceInfo.getBuildNumber()})
      </Text>
    </Screen>
  );
}
