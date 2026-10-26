// NativeWind's stylesheet, imported once for its side effect (src/App.tsx).
declare module '*.css';

declare module '*.png' {
  const source: import('react-native').ImageSourcePropType;
  export default source;
}
