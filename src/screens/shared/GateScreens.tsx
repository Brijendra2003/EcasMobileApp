// Root-level screens outside the persona tabs (§1, §5.3, §5.4).
import { Alert, Linking, Platform, View } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { signOut } from '../../features/auth/api';
import { config } from '../../lib/config';
import { errorMessage } from '../../lib/errors';
import { personasFor, type Persona } from '../../lib/personas';
import type { RootStackParamList } from '../../navigation/types';
import { useSession } from '../../stores/session';

const PERSONA_COPY: Record<Persona, { title: string; body: string }> = {
  professor: { title: 'Professor', body: 'Mark attendance, timetable, classes and approvals' },
  student: { title: 'Student', body: 'Your attendance, timetable, exams and leave' },
  parent: { title: 'Parent', body: "Your child's attendance, alerts and notices" },
};

export function PersonaSelectScreen() {
  const caps = useSession(s => s.caps);
  const session = useSession(s => s.session);
  const roles = caps?.roles ?? [];
  const personas = personasFor(roles);
  return (
    <Screen topInset>
      <Text variant="title" className="mb-1 mt-6">
        Continue as
      </Text>
      <Text variant="muted" className="mb-6">
        {caps?.display_name ?? session?.user.email ?? ''} · you can switch later from More.
      </Text>
      {personas.map(p => (
        <Card key={p} className="mb-3" onPress={() => useSession.getState().choosePersona(p)} accessibilityLabel={`Continue as ${PERSONA_COPY[p].title}`}>
          <Text variant="subheading">{PERSONA_COPY[p].title}</Text>
          <Text variant="muted">{PERSONA_COPY[p].body}</Text>
        </Card>
      ))}
    </Screen>
  );
}

async function trySignOut() {
  try {
    await signOut();
  } catch (e) {
    Alert.alert('Cannot sign out yet', errorMessage(e));
  }
}

export function UseWebPortalScreen() {
  return (
    <Screen topInset>
      <View className="mt-16 items-center">
        <Text variant="title" className="mb-2 text-center">
          Use the web portal
        </Text>
        <Text variant="muted" className="mb-8 text-center">
          Your role (Principal, Admin, Operations or Exam Cell) is managed on the web. The app is for professors, students and parents.
        </Text>
        <Button variant="secondary" title="Sign out" onPress={trySignOut} />
      </View>
    </Screen>
  );
}

export function UpdateRequiredScreen({ route }: NativeStackScreenProps<RootStackParamList, 'UpdateRequired'>) {
  const store =
    Platform.OS === 'ios'
      ? config.iosAppStoreId
        ? `itms-apps://apps.apple.com/app/id${config.iosAppStoreId}`
        : 'https://apps.apple.com'
      : `market://details?id=${DeviceInfo.getBundleId()}`;
  return (
    <Screen topInset>
      <View className="mt-16 items-center">
        <Text variant="title" className="mb-2 text-center">
          Update required
        </Text>
        <Text variant="muted" className="mb-8 text-center">
          This version ({DeviceInfo.getVersion()}) is no longer supported. Install version {route.params.minVersion} or later to continue.
        </Text>
        <Button title="Open store" onPress={() => Linking.openURL(store).catch(() => {})} />
      </View>
    </Screen>
  );
}
