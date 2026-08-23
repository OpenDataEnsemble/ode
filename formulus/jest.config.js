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
  // Allow Babel to transform react-native / @react-native* / @ode/* even when
  // they live under pnpm's nested layout:
  //   node_modules/.pnpm/<pkg>@…/node_modules/<pkg>/…
  // Without the `.pnpm/…/node_modules/` alternative, Jest matches the first
  // `node_modules/` (followed by `.pnpm`), skips transform, and chokes on the
  // ESM `import` in react-native/jest/setup.js.
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|@ode)/)',
  ],
  // WatermelonDB / Loki can leave handles open in Jest; force exit avoids hung workers.
  forceExit: true,
  // React Native's jest preset still pulls jest-environment-node@29; jest-runtime@30.4+
  // calls clearMocksOnScope which that mocker lacks. Pin jest to 30.3.x (see package.json).
  testTimeout: 30000,
};
