// App bootstrap (§4, §5): encrypted storage → SQLite → i18n → persisted query
// cache → theme → safe area → navigation, then the launch and foreground
// checks (§5.4), connectivity, the sync worker and the optional app lock.
import '../global.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Pressable, StatusBar, StyleSheet, Text as RNText, useColorScheme, View } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { NavigationContainer } from '@react-navigation/native';
import { PersistQueryClientProvider, type PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import { SafeAreaInsetsContext, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lock, X } from 'lucide-react-native';
import { Button } from './components/Button';
import { Text } from './components/Text';
import { ThemeProvider, useTheme } from './components/theme';
import { signOut } from './features/auth/api';
import { useCapabilities } from './features/common/hooks';
import { appLockEnabled, startAppLockWatcher, unlock, useAppLock } from './lib/app-lock';
import { startConnectivity } from './lib/connectivity';
import { errorMessage } from './lib/errors';
import { initI18n } from './lib/i18n';
import { compareVersions, personasFor, rolesFromAccessToken } from './lib/personas';
import { createPersistOptions, queryClient } from './lib/query-client';
import { initStorage } from './lib/storage';
import { supabase } from './lib/supabase';
import { linking, navigationRef } from './navigation/linking';
import { useNavigationTheme } from './navigation/options';
import { RootNavigator } from './navigation/RootNavigator';
import { openDatabase } from './offline/db';
import { prefetchIfStale } from './offline/prefetch';
import { startSyncTriggers } from './offline/service';
import { brand } from './shared/tokens';
import { useSession, useUserId } from './stores/session';

type PersistOptions = Omit<PersistQueryClientOptions, 'queryClient'>;

async function bootstrap(): Promise<PersistOptions> {
  await initStorage();
  await openDatabase();
  initI18n();
  return createPersistOptions();
}

/** Before the theme exists: plain styles from the tokens. */
function Splash({ error, onRetry }: { error?: unknown; onRetry?: () => void }) {
  const palette = useColorScheme() === 'dark' ? brand.dark : brand.light;
  return (
    <View style={[styles.splash, { backgroundColor: palette.canvas }]}>
      <Image source={require('./assets/logo.png')} style={styles.logo} resizeMode="contain" />
      {error ? (
        <>
          <RNText style={[styles.splashText, { color: palette.ink }]}>The app could not start. {errorMessage(error)}</RNText>
          {onRetry ? (
            <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
              <RNText style={[styles.retryText, { color: palette.primary }]}>Try again</RNText>
            </Pressable>
          ) : null}
        </>
      ) : (
        <ActivityIndicator color={palette.muted} />
      )}
    </View>
  );
}

export default function App() {
  const [persist, setPersist] = useState<PersistOptions | null>(null);
  const [error, setError] = useState<unknown>(null);
  const start = useCallback(() => {
    setError(null);
    bootstrap().then(setPersist, setError);
  }, []);
  useEffect(start, [start]);

  if (!persist) {
    return <Splash error={error} onRetry={start} />;
  }
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persist}>
      <ThemeProvider>
        <SafeAreaProvider>
          <Shell />
        </SafeAreaProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}

/** Supabase auth state → session store (§5.2). */
function useAuthListener() {
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      useSession.getState().setSession(session);
    });
    supabase.auth
      .getSession()
      .then(({ data: d }) => {
        if (useSession.getState().status === 'loading') {
          useSession.getState().setSession(d.session);
        }
      })
      .catch(() => useSession.getState().setSession(null));
    return () => data.subscription.unsubscribe();
  }, []);
}

const INACTIVE_REASON = 'This account is no longer active. Contact the college office.';

/**
 * Launch and foreground checks (§5.4): capabilities (roles, class teacher,
 * HOD, config), deactivated accounts, the minimum app version and the
 * maintenance banner; last-seen for the operations dashboard.
 */
function useLaunchChecks() {
  const userId = useUserId();
  const caps = useCapabilities();
  const refetch = useRef(caps.refetch);
  refetch.current = caps.refetch;
  const [minVersion, setMinVersion] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      return;
    }
    const check = () => {
      refetch.current().catch(() => {});
      supabase.rpc('touch_last_seen').then(
        () => {},
        () => {},
      );
    };
    check();
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') {
        check();
      }
    });
    return () => sub.remove();
  }, [userId]);

  const c = caps.data;
  const fresh = caps.isFetchedAfterMount && !caps.isError;
  useEffect(() => {
    if (!c) {
      return;
    }
    // The persisted copy routes the user offline; only a live answer signs them out.
    useSession.getState().setCaps(c);
    if (!c.is_active) {
      if (fresh) {
        signOut({ force: true, reason: INACTIVE_REASON }).catch(() => {});
      }
      return;
    }
    setMinVersion(compareVersions(DeviceInfo.getVersion(), c.config.min_mobile_version) < 0 ? c.config.min_mobile_version : null);
    setBanner(c.config.maintenance_banner || null);
  }, [c, fresh]);

  useEffect(() => {
    if (!userId) {
      setMinVersion(null);
      setBanner(null);
    }
  }, [userId]);

  return { minVersion, banner };
}

/** Professors: sync worker triggers and the prefetch window (§9.3, §9.4). */
function useProfessorWork() {
  const isProfessor = useSession(
    s => s.status === 'signedIn' && personasFor(s.caps?.roles ?? rolesFromAccessToken(s.session?.access_token)).includes('professor'),
  );
  useEffect(() => {
    if (!isProfessor) {
      return;
    }
    const stop = startSyncTriggers();
    prefetchIfStale().catch(() => {});
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') {
        prefetchIfStale().catch(() => {});
      }
    });
    return () => {
      stop();
      sub.remove();
    };
  }, [isProfessor]);
}

function MaintenanceBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="alert" className="flex-row items-center bg-warn px-4 pb-2" style={{ paddingTop: insets.top + 8 }}>
      <Text className="flex-1 text-sm font-medium text-white">{message}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={onDismiss} hitSlop={10}>
        <X size={18} color="#fff" />
      </Pressable>
    </View>
  );
}

/** Optional biometric / passcode lock (§5.4 step 6). */
function LockOverlay() {
  const locked = useAppLock(s => s.locked);
  const signedIn = useSession(s => s.status === 'signedIn');
  const { colors } = useTheme();
  const active = locked && signedIn && appLockEnabled();
  useEffect(() => {
    if (locked && !active) {
      useAppLock.getState().set(false);
    } else if (active) {
      unlock();
    }
  }, [locked, active]);
  if (!active) {
    return null;
  }
  return (
    <View style={StyleSheet.absoluteFill} className="items-center justify-center bg-canvas px-8">
      <Lock size={40} color={colors.muted} />
      <Text variant="heading" className="mb-6 mt-4">
        Attendance is locked
      </Text>
      <Button title="Unlock" onPress={() => unlock()} />
    </View>
  );
}

function Shell() {
  const theme = useTheme();
  const navTheme = useNavigationTheme();
  const insets = useSafeAreaInsets();
  const status = useSession(s => s.status);
  const [navReady, setNavReady] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  useAuthListener();
  useProfessorWork();
  const { minVersion, banner } = useLaunchChecks();

  useEffect(() => {
    const stopNet = startConnectivity();
    const stopLock = startAppLockWatcher();
    return () => {
      stopNet();
      stopLock();
    };
  }, []);

  // Blocking update gate (§5.4 step 1, §17).
  useEffect(() => {
    if (minVersion && navReady) {
      navigationRef.reset({ index: 0, routes: [{ name: 'UpdateRequired', params: { minVersion } }] });
    }
  }, [minVersion, navReady, status]);

  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator color={theme.colors.muted} />
      </View>
    );
  }
  const showBanner = !!banner && banner !== dismissed;
  return (
    <View className="flex-1 bg-canvas">
      <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} />
      {showBanner ? <MaintenanceBanner message={banner} onDismiss={() => setDismissed(banner)} /> : null}
      {/* The banner already covers the status bar, so headers below it need no top inset. */}
      <SafeAreaInsetsContext.Provider value={showBanner ? { ...insets, top: 0 } : insets}>
        <NavigationContainer ref={navigationRef} theme={navTheme} linking={linking} onReady={() => setNavReady(true)}>
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaInsetsContext.Provider>
      <LockOverlay />
    </View>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  logo: { width: 88, height: 88, marginBottom: 24 },
  splashText: { textAlign: 'center', marginBottom: 12 },
  retry: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 },
  retryText: { fontWeight: '600' },
});
