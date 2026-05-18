export default {
  preset: 'react-native',
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  moduleNameMapper: {
    '^@babel/runtime/(.*)$': '<rootDir>/node_modules/@babel/runtime/$1',
  },
  // Vendored packages ship their own Jest suites; they are not part of this app.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/third_party/'],
  // WatermelonDB / Loki can leave handles open in Jest; force exit avoids hung workers.
  forceExit: true,
  // Set a timeout for the entire test suite
  testTimeout: 30000,
};
