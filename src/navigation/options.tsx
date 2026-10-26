// Navigator styling from the theme tokens (§14), shared by every navigator.
import { useMemo, type ReactNode } from 'react';
import { DarkTheme, DefaultTheme, type Theme as NavigationTheme } from '@react-navigation/native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../components/theme';

export function useNavigationTheme(): NavigationTheme {
  const { dark, colors } = useTheme();
  return useMemo(() => {
    const base = dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, primary: colors.primary, background: colors.canvas, card: colors.surface, text: colors.ink, border: colors.line, notification: colors.danger },
    };
  }, [dark, colors]);
}

export function useStackOptions(): NativeStackNavigationOptions {
  const { colors } = useTheme();
  return useMemo(
    () => ({
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.ink,
      headerShadowVisible: false,
      headerBackButtonDisplayMode: 'minimal',
      contentStyle: { backgroundColor: colors.canvas },
    }),
    [colors],
  );
}

/** Tab headers carry the persona's header actions (§6): bell, plus the sync badge for professors. */
export function useTabOptions(headerRight: () => ReactNode): BottomTabNavigationOptions {
  const { colors } = useTheme();
  return useMemo(
    () => ({
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.ink,
      headerShadowVisible: false,
      headerRight,
      headerRightContainerStyle: { paddingRight: 8 },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.muted,
      tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
      tabBarLabelStyle: { fontSize: 12 },
    }),
    [colors, headerRight],
  );
}

export function tabIcon(Icon: LucideIcon) {
  return function TabIcon({ color, size }: { color: string; size: number }) {
    return <Icon color={color} size={size} />;
  };
}
