// Push notifications (§12), transport-agnostic part: device-token
// registration and payload handling. The FCM transport
// (@react-native-firebase/messaging + Notifee) plugs into
// `attachPushTransport` once the Firebase project files exist
// (google-services.json / GoogleService-Info.plist per flavour).
import { Linking, Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { invalidateFromPush, queryClient } from './query-client';
import { secureStore } from './storage';
import { supabase } from './supabase';

const TOKEN_KEY = 'push.token';

export interface PushTransport {
  /** Ask for permission (iOS prompt, Android 13+ POST_NOTIFICATIONS). */
  requestPermission(): Promise<boolean>;
  getToken(): Promise<string | null>;
  deleteToken(): Promise<void>;
  onTokenRefresh(cb: (token: string) => void): () => void;
}

let transport: PushTransport | null = null;

export function attachPushTransport(t: PushTransport) {
  transport = t;
}

export const pushAvailable = () => transport !== null;

async function register(token: string) {
  await supabase.rpc('register_device', {
    p_token: token,
    p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
    p_app_version: DeviceInfo.getVersion(),
    p_device_id: await DeviceInfo.getUniqueId(),
  });
  secureStore().set(TOKEN_KEY, token);
}

/** After sign-in, behind the explanation screen (§12). Re-registers on change and upgrade. */
export async function registerForPush(): Promise<boolean> {
  if (!transport) {
    return false;
  }
  const granted = await transport.requestPermission();
  if (!granted) {
    return false;
  }
  const token = await transport.getToken();
  if (token) {
    await register(token);
  }
  transport.onTokenRefresh(t => {
    register(t).catch(() => {});
  });
  return true;
}

export async function unregisterPush() {
  const token = secureStore().getString(TOKEN_KEY);
  if (token) {
    await supabase.rpc('unregister_device', { p_token: token });
    secureStore().remove(TOKEN_KEY);
  }
  await transport?.deleteToken();
}

/** FCM `data` payload (all values are strings, §12). */
export interface PushData {
  type?: string;
  url?: string;
  studentId?: string;
  invalidate?: string;
  notificationId?: string;
}

/** Foreground message: refresh affected queries and the notification badge. */
export function onForegroundPush(data: PushData) {
  invalidateFromPush(data.invalidate);
  queryClient.invalidateQueries({ queryKey: ['notifications'] });
}

/** Notification tap: every route goes through the deep-link handler. */
export function onPushOpened(data: PushData) {
  invalidateFromPush(data.invalidate);
  if (data.url) {
    Linking.openURL(data.url).catch(() => {});
  }
}
