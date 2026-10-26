/* eslint-env jest */
// Native modules replaced for Jest: in-memory stores and no-op natives, so any
// module (sync engine, linking, screens) can be imported under test.

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => {
    const map = new Map();
    return {
      getString: k => (typeof map.get(k) === 'string' ? map.get(k) : undefined),
      getBoolean: k => (typeof map.get(k) === 'boolean' ? map.get(k) : undefined),
      getNumber: k => (typeof map.get(k) === 'number' ? map.get(k) : undefined),
      set: (k, v) => map.set(k, v),
      contains: k => map.has(k),
      remove: k => map.delete(k),
      getAllKeys: () => [...map.keys()],
      clearAll: () => map.clear(),
    };
  },
}));

jest.mock('@op-engineering/op-sqlite', () => {
  const db = {
    execute: jest.fn(async () => ({ rows: [], rowsAffected: 0 })),
    transaction: jest.fn(async fn => fn(db)),
    close: jest.fn(),
  };
  return { open: jest.fn(() => db) };
});

jest.mock('react-native-keychain', () => {
  const store = new Map();
  return {
    ACCESSIBLE: { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY', WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 'WHEN_PASSCODE_SET_THIS_DEVICE_ONLY' },
    ACCESS_CONTROL: { BIOMETRY_ANY_OR_DEVICE_PASSCODE: 'BIOMETRY_ANY_OR_DEVICE_PASSCODE' },
    getGenericPassword: jest.fn(async ({ service } = {}) => store.get(service) ?? false),
    setGenericPassword: jest.fn(async (username, password, { service } = {}) => {
      store.set(service, { username, password, service });
      return { service, storage: 'mock' };
    }),
    resetGenericPassword: jest.fn(async ({ service } = {}) => store.delete(service)),
  };
});

jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock.js'));

jest.mock('react-native-device-info', () => require('react-native-device-info/jest/react-native-device-info-mock'));

jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {
    APP_ENV: 'development',
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
    CLOUDINARY_CLOUD_NAME: 'test',
  },
}));

jest.mock('react-native-localize', () => ({
  getLocales: () => [{ languageCode: 'en', countryCode: 'IN', languageTag: 'en-IN', isRTL: false }],
  getTimeZone: () => 'Asia/Kolkata',
  uses24HourClock: () => false,
}));

// Every SVG element renders as a plain View (no createElement here: NativeWind's
// Babel preset would rewrite it to an out-of-scope helper).
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View, Svg: View, Circle: View, Line: View, Polyline: View, Rect: View, Path: View, G: View };
});

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
