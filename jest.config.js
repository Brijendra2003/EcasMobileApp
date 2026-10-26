module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  // React Native libraries ship untranspiled ESM / Flow, so Babel must see them.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native(-[^/]+)?|@react-native(-community)?|@react-navigation|@shopify/flash-list|@op-engineering|@supabase|@tanstack|lucide-react-native|nativewind|react-native-css-interop)/)',
  ],
  moduleNameMapper: {
    '\\.css$': '<rootDir>/jest/style-stub.js',
  },
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/backend/'],
};
