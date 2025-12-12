module.exports = {
  preset: 'react-native',
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  // Force Jest to exit after all tests complete
  // This helps with WatermelonDB's LokiJS adapter which can leave open handles
  forceExit: true,
  // Set a timeout for the entire test suite
  testTimeout: 30000,
};
