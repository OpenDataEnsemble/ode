export default {
  preset: 'react-native',
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  // Vendored packages ship their own Jest suites; they are not part of this app.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/third_party/'],
  // Force Jest to exit after all tests complete
  // This helps with WatermelonDB's LokiJS adapter which can leave open handles
  forceExit: true,
  // Set a timeout for the entire test suite
  testTimeout: 30000,
};
