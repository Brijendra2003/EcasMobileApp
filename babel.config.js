module.exports = {
  // nativewind/babel also adds the Reanimated (Worklets) plugin, which must run last.
  presets: ['module:@react-native/babel-preset', 'nativewind/babel'],
  // zod 4 ships `export * as core from …`, which the React Native preset does not transform.
  plugins: ['@babel/plugin-transform-export-namespace-from'],
};
