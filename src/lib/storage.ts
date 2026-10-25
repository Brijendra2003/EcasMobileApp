// Key management (§15): the MMKV and SQLCipher keys are generated on first
// launch and kept in the iOS Keychain / Android Keystore. MMKV (encrypted)
// holds the auth session, the persisted query cache and preferences.
import * as Keychain from 'react-native-keychain';
import { createMMKV, type MMKV } from 'react-native-mmkv';

const MMKV_KEY_SERVICE = 'ecas.mmkv.key';
const SQLITE_KEY_SERVICE = 'ecas.sqlite.key';

function randomKey(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  // Printable key: two base-36 chars per byte, trimmed to the byte length MMKV expects.
  return Array.from(buf, b => b.toString(36).padStart(2, '0')).join('').slice(0, bytes);
}

async function getOrCreateKey(service: string, bytes: number): Promise<string> {
  const existing = await Keychain.getGenericPassword({ service });
  if (existing) {
    return existing.password;
  }
  const key = randomKey(bytes);
  await Keychain.setGenericPassword('key', key, {
    service,
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  return key;
}

let secure: MMKV | null = null;
let sqliteKey: string | null = null;
let ready: Promise<void> | null = null;

/** Opens the encrypted stores. Safe to call repeatedly. */
export function initStorage(): Promise<void> {
  ready ??= (async () => {
    const [mmkvKey, dbKey] = await Promise.all([
      getOrCreateKey(MMKV_KEY_SERVICE, 32),
      getOrCreateKey(SQLITE_KEY_SERVICE, 32),
    ]);
    secure = createMMKV({ id: 'ecas.secure', encryptionKey: mmkvKey, encryptionType: 'AES-256' });
    sqliteKey = dbKey;
  })();
  return ready;
}

export function storageReady(): Promise<void> {
  return initStorage();
}

/** Encrypted MMKV. Only valid after initStorage() resolved. */
export function secureStore(): MMKV {
  if (!secure) {
    throw new Error('Storage used before initStorage()');
  }
  return secure;
}

export function sqlCipherKey(): string {
  if (!sqliteKey) {
    throw new Error('Storage used before initStorage()');
  }
  return sqliteKey;
}

/** Preference keys kept in MMKV (never personal data). */
export const PREF = {
  persona: 'pref.persona',
  language: 'pref.language',
  selectedChild: 'pref.selectedChild',
  appLock: 'pref.appLock',
  lastPrefetchAt: 'pref.lastPrefetchAt',
  pushAsked: 'pref.pushAsked',
  rosterLayout: 'pref.rosterLayout',
} as const;

/** Auth storage adapter for supabase-js: waits for the encrypted store. */
export const supabaseAuthStorage = {
  async getItem(key: string) {
    await storageReady();
    return secureStore().getString(key) ?? null;
  },
  async setItem(key: string, value: string) {
    await storageReady();
    secureStore().set(key, value);
  },
  async removeItem(key: string) {
    await storageReady();
    secureStore().remove(key);
  },
};

/** Wipes everything except preferences that are not personal (language). */
export function clearSecureStore() {
  const store = secureStore();
  const language = store.getString(PREF.language);
  store.clearAll();
  if (language) {
    store.set(PREF.language, language);
  }
}
