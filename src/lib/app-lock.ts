// Optional app lock (§5.4 step 6, §15): biometrics or the device passcode via
// Keychain access control, with an inactivity timeout. No extra library.
import { AppState } from 'react-native';
import * as Keychain from 'react-native-keychain';
import { create } from 'zustand';
import { PREF, secureStore } from './storage';

const SERVICE = 'ecas.applock';
const TIMEOUT_MS = 5 * 60_000;

interface LockState {
  locked: boolean;
  set: (locked: boolean) => void;
}

export const useAppLock = create<LockState>(set => ({ locked: false, set: locked => set({ locked }) }));

export function appLockEnabled(): boolean {
  return secureStore().getBoolean(PREF.appLock) === true;
}

export async function enableAppLock(): Promise<boolean> {
  const ok = await Keychain.setGenericPassword('lock', 'unlock', {
    service: SERVICE,
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
    accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  });
  if (!ok) {
    return false;
  }
  // Prove it works before turning it on, so nobody locks themselves out.
  if (!(await unlock())) {
    await Keychain.resetGenericPassword({ service: SERVICE });
    return false;
  }
  secureStore().set(PREF.appLock, true);
  return true;
}

export async function disableAppLock() {
  secureStore().set(PREF.appLock, false);
  await Keychain.resetGenericPassword({ service: SERVICE });
}

export async function unlock(): Promise<boolean> {
  try {
    const res = await Keychain.getGenericPassword({
      service: SERVICE,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
      authenticationPrompt: { title: 'Unlock attendance', cancel: 'Cancel' },
    });
    const ok = !!res;
    if (ok) {
      useAppLock.getState().set(false);
    }
    return ok;
  } catch {
    return false;
  }
}

/** Locks at launch and after TIMEOUT_MS in the background. Returns a stop function. */
export function startAppLockWatcher(): () => void {
  if (appLockEnabled()) {
    useAppLock.getState().set(true);
  }
  let backgroundAt: number | null = null;
  const sub = AppState.addEventListener('change', state => {
    if (state === 'background') {
      backgroundAt = Date.now();
    } else if (state === 'active' && backgroundAt !== null) {
      if (appLockEnabled() && Date.now() - backgroundAt > TIMEOUT_MS) {
        useAppLock.getState().set(true);
      }
      backgroundAt = null;
    }
  });
  return () => sub.remove();
}
