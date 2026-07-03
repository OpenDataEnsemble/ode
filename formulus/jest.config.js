export default {
  preset: 'react-native',
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  moduleNameMapper: {
    '^@babel/runtime/(.*)$': '<rootDir>/node_modules/@babel/runtime/$1',
    '^react-native-localize$':
      '<rootDir>/src/testUtils/mocks/reactNativeLocalize.js',
  },
  // Vendored packages ship their own Jest suites; they are not part of this app.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/third_party/'],
  // Allow Babel to transform our internal @ode/* packages whose `main` points
  // at TypeScript source (not pre-built). Without this override pnpm's hoisted
  // node_modules layout lets jest's default ignore pattern skip them and Jest
  // chokes on `export`.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@ode)/)',
  ],
  // WatermelonDB / Loki can leave handles open in Jest; force exit avoids hung workers.
  forceExit: true,
  // React Native's jest preset still pulls jest-environment-node@29; jest-runtime@30.4+
  // calls clearMocksOnScope which that mocker lacks. Pin jest to 30.3.x (see package.json).
  testTimeout: 30000,
};
