import { getDefaultConfig, mergeConfig } from '@react-native/metro-config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Monorepo root — used only to resolve @ode/* paths, not as a watch root. */
const monorepoRoot = path.resolve(__dirname, '..');

/** Workspace packages Formulus imports. Do not watch the rest of the repo. */
const workspaceWatchFolders = [
  path.resolve(monorepoRoot, 'packages/tokens'),
  path.resolve(monorepoRoot, 'packages/components'),
  path.resolve(monorepoRoot, 'packages/observation-query'),
];

/**
 * Force a single React/react-native instance so hooks work (avoids "Invalid hook call" / "useState of null").
 * Without this, @ode/components would use its own node_modules/react and we'd have two React copies.
 */
const projectRoot = __dirname;

/**
 * Real path of a package in the app's node_modules. pnpm's isolated layout
 * symlinks top-level packages into node_modules/.pnpm/…; returning the symlink
 * path from resolveRequest makes Metro resolve that package's own (unhoisted)
 * dependencies, e.g. react-native → invariant, from the wrong directory.
 */
const appModule = name =>
  fs.realpathSync(path.resolve(projectRoot, 'node_modules', name));

/**
 * Force react and react-native to always resolve from the app's node_modules
 * (avoids incomplete copy in packages/components). react-native-svg only uses
 * extraNodeModules so Metro resolves its real entry (lib/commonjs/index.js).
 */
const babelRuntimeRoot = appModule('@babel/runtime');

const forcedModules = {
  react: appModule('react'),
  'react-native': appModule('react-native'),
  '@babel/runtime': babelRuntimeRoot,
};
const extraModules = {
  ...forcedModules,
  'react-native-svg': appModule('react-native-svg'),
  '@ode/components/react-native': path.resolve(
    monorepoRoot,
    'packages/components/src/react-native/index.ts',
  ),
  '@ode/components/react-web': path.resolve(
    monorepoRoot,
    'packages/components/src/react-web/index.ts',
  ),
  '@ode/tokens/dist/react-native/tokens-resolved': path.resolve(
    monorepoRoot,
    'packages/tokens/dist/react-native/tokens-resolved.js',
  ),
};

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  // Default config already watches formulus/. Extra roots are only the
  // @ode packages we import — watching the monorepo root also walks
  // desktop/, synkronus/, and their node_modules (ENOSPC on typical Linux).
  watchFolders: workspaceWatchFolders,
  resolver: {
    unstable_enableSymlinks: true,
    unstable_enablePackageExports: true,
    extraNodeModules: extraModules,
    resolveRequest(context, moduleName, platform) {
      // @babel/runtime subpaths (workspace packages e.g. @ode/observation-query)
      if (
        moduleName === '@babel/runtime' ||
        moduleName.startsWith('@babel/runtime/')
      ) {
        const relative =
          moduleName === '@babel/runtime'
            ? 'index.js'
            : `${moduleName.slice('@babel/runtime/'.length)}.js`;
        return {
          type: 'sourceFile',
          filePath: path.join(babelRuntimeRoot, relative),
        };
      }
      // Handle forced modules (react, react-native)
      if (forcedModules[moduleName]) {
        return {
          type: 'sourceFile',
          filePath: path.join(forcedModules[moduleName], 'index.js'),
        };
      }
      // Handle react-native-svg - resolve to its actual entry point
      if (moduleName === 'react-native-svg') {
        const svgPath = path.join(
          extraModules['react-native-svg'],
          'lib/commonjs/index.js',
        );
        return {
          type: 'sourceFile',
          filePath: svgPath,
        };
      }
      // Handle @ode/components subpath exports
      if (extraModules[moduleName]) {
        return {
          type: 'sourceFile',
          filePath: extraModules[moduleName],
        };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

export default mergeConfig(getDefaultConfig(__dirname), config);
