import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptsDir, '..');
const androidBuildGradlePath = path.join(
  rootDir,
  'android',
  'app',
  'build.gradle',
);
const iosProjectPath = path.join(
  rootDir,
  'ios',
  'Formulus.xcodeproj',
  'project.pbxproj',
);

function parseIncrement(args) {
  if (args.length === 0) {
    return 4;
  }

  if (args.length !== 2 || args[0] !== '--increment') {
    throw new Error(
      'Usage: node scripts/bumpNativeBuildCode.js [--increment <multiple of 4>]',
    );
  }

  const increment = Number.parseInt(args[1], 10);
  if (
    !Number.isSafeInteger(increment) ||
    increment <= 0 ||
    increment % 4 !== 0
  ) {
    throw new Error('Build-code increment must be a positive multiple of four');
  }

  return increment;
}

function uniqueMatches(content, pattern, field) {
  const values = [...content.matchAll(pattern)].map(match => Number(match[1]));
  if (values.length === 0) {
    throw new Error(`Could not find ${field}`);
  }

  return [...new Set(values)];
}

const increment = parseIncrement(process.argv.slice(2));
const androidGradle = fs.readFileSync(androidBuildGradlePath, 'utf8');
const iosProject = fs.readFileSync(iosProjectPath, 'utf8');

const androidBuildNumbers = uniqueMatches(
  androidGradle,
  /versionCode\s*=\s*(\d+)/g,
  'Android versionCode',
);
const iosBuildNumbers = uniqueMatches(
  iosProject,
  /CURRENT_PROJECT_VERSION = (\d+);/g,
  'iOS CURRENT_PROJECT_VERSION',
);

if (androidBuildNumbers.length !== 1) {
  throw new Error(
    `Expected one Android versionCode, found ${androidBuildNumbers.join(', ')}`,
  );
}
if (
  iosBuildNumbers.length !== 1 ||
  iosBuildNumbers[0] !== androidBuildNumbers[0]
) {
  throw new Error(
    `iOS build numbers (${iosBuildNumbers.join(', ')}) do not match Android versionCode ${androidBuildNumbers[0]}`,
  );
}

const currentBuildCode = androidBuildNumbers[0];
if (currentBuildCode % 4 !== 0) {
  throw new Error(
    `Android versionCode ${currentBuildCode} is not aligned to a four-code F-Droid block`,
  );
}

const nextBuildCode = currentBuildCode + increment;

fs.writeFileSync(
  androidBuildGradlePath,
  androidGradle.replace(
    /versionCode\s*=\s*\d+/,
    `versionCode = ${nextBuildCode}`,
  ),
  'utf8',
);
fs.writeFileSync(
  iosProjectPath,
  iosProject.replace(
    /CURRENT_PROJECT_VERSION = \d+;/g,
    `CURRENT_PROJECT_VERSION = ${nextBuildCode};`,
  ),
  'utf8',
);

console.log(
  `Prepared next native build-code block: ${currentBuildCode} → ${nextBuildCode} (F-Droid ${nextBuildCode}-${nextBuildCode + 3})`,
);
