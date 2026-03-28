/** Client version from package.json for x-ode-version header. */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const packageJson = require('../package.json') as { version?: string };
const v = packageJson.version?.trim();
if (!v) {
  throw new Error(
    'package.json must define "version" (semantic version, e.g. 1.0.0)',
  );
}
export const ODE_VERSION = v;
