import packageJson from '../package.json';

/** Client version from package.json for x-ode-version header. */
const v = packageJson.version?.trim();
if (!v) {
  throw new Error(
    'package.json must define "version" (semantic version, e.g. 1.0.0)',
  );
}

export const ODE_VERSION = v;
