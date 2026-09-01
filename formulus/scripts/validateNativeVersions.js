import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptsDir, '..');

const packageJson = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'),
);
const androidGradle = fs.readFileSync(
  path.join(rootDir, 'android', 'app', 'build.gradle'),
  'utf8',
);
const iosProject = fs.readFileSync(
  path.join(rootDir, 'ios', 'Formulus.xcodeproj', 'project.pbxproj'),
  'utf8',
);

function requireMatch(content, pattern, field) {
  const match = content.match(pattern);
  if (!match) {
    throw new Error(`Could not find ${field}`);
  }
  return match[1];
}

function uniqueMatches(content, pattern, field) {
  const values = [...content.matchAll(pattern)].map(match => match[1]);
  if (values.length === 0) {
    throw new Error(`Could not find ${field}`);
  }
  return [...new Set(values)];
}

const androidVersionName = requireMatch(
  androidGradle,
  /versionName\s*=\s*["']([^"']+)["']/,
  'Android versionName',
);
const androidVersionCode = Number.parseInt(
  requireMatch(androidGradle, /versionCode\s*=\s*(\d+)/, 'Android versionCode'),
  10,
);
const iosMarketingVersions = uniqueMatches(
  iosProject,
  /MARKETING_VERSION = ([^;]+);/g,
  'iOS MARKETING_VERSION',
);
const iosBuildNumbers = uniqueMatches(
  iosProject,
  /CURRENT_PROJECT_VERSION = (\d+);/g,
  'iOS CURRENT_PROJECT_VERSION',
).map(Number);

const errors = [];

if (androidVersionName !== packageJson.version) {
  errors.push(
    `Android versionName ${androidVersionName} does not match package.json ${packageJson.version}`,
  );
}
if (
  iosMarketingVersions.length !== 1 ||
  iosMarketingVersions[0] !== packageJson.version
) {
  errors.push(
    `iOS MARKETING_VERSION values (${iosMarketingVersions.join(', ')}) do not match package.json ${packageJson.version}`,
  );
}
if (androidVersionCode % 4 !== 0) {
  errors.push(
    `Android versionCode ${androidVersionCode} is not aligned to a four-code F-Droid block; use 40, 44, 48, ...`,
  );
}
if (iosBuildNumbers.length !== 1 || iosBuildNumbers[0] !== androidVersionCode) {
  errors.push(
    `iOS CURRENT_PROJECT_VERSION values (${iosBuildNumbers.join(', ')}) do not match Android versionCode ${androidVersionCode}`,
  );
}

if (errors.length > 0) {
  console.error(`Native version validation failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

console.log(
  `Native versions valid: ${packageJson.version} (${androidVersionCode}); F-Droid block ${androidVersionCode}-${androidVersionCode + 3}`,
);
