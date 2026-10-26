// Light / dark theme from the synced design tokens (§14). Colours reach
// NativeWind classes (bg-canvas, text-ink …) through CSS variables, and
// non-class consumers (icons, navigation, status bar) through useTheme().
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { vars } from 'nativewind';
import { brand, statusColors } from '../shared/tokens';

type Palette = { [K in keyof typeof brand.light]: string };

function rgbTriplet(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  // eslint-disable-next-line no-bitwise -- unpacking a hex colour
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

function cssVars(p: Palette) {
  return vars(Object.fromEntries(Object.entries(p).map(([k, v]) => [`--color-${k}`, rgbTriplet(v)])));
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
const LIGHT_VARS = cssVars(brand.light);
const DARK_VARS = cssVars(brand.dark);

export interface Theme {
  dark: boolean;
  colors: Palette & { status: typeof statusColors; warn: string; danger: string; safe: string };
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const dark = useColorScheme() === 'dark';
  const theme = useMemo<Theme>(
    () => ({
      dark,
      colors: { ...(dark ? brand.dark : brand.light), status: statusColors, warn: '#d97706', danger: '#dc2626', safe: '#16a34a' },
    }),
    [dark],
  );
  return (
    <ThemeContext.Provider value={theme}>
      <View style={[styles.fill, dark ? DARK_VARS : LIGHT_VARS]} className="bg-canvas">
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) {
    throw new Error('useTheme outside ThemeProvider');
  }
  return t;
}
