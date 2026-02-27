/**
 * Syncs version from package.json to native app manifests.
 * 
 * This script ensures that:
 * - Android build.gradle versionName matches package.json.version
 * - iOS version fields are kept in sync (if applicable)
 * 
 * Run this before building native apps to prevent version drift.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');
const ANDROID_BUILD_GRADLE_PATH = path.join(
  ROOT_DIR,
  'android',
  'app',
  'build.gradle',
);

/**
 * Reads version from package.json
 */
function getPackageVersion() {
  const packageJsonContent = fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8');
  const packageJson = JSON.parse(packageJsonContent);
  if (!packageJson.version) {
    throw new Error('package.json must have a "version" field');
  }
  return packageJson.version.trim();
}

/**
 * Updates versionName in Android build.gradle
 */
function updateAndroidVersion(version) {
  if (!fs.existsSync(ANDROID_BUILD_GRADLE_PATH)) {
    console.warn(
      `Android build.gradle not found at ${ANDROID_BUILD_GRADLE_PATH}, skipping Android version update`,
    );
    return;
  }

  let gradleContent = fs.readFileSync(ANDROID_BUILD_GRADLE_PATH, 'utf-8');

  // Match versionName = "..." or versionName = '...'
  // This regex handles both single and double quotes, and optional whitespace
  const versionNameRegex = /versionName\s*=\s*["']([^"']+)["']/;

  if (!versionNameRegex.test(gradleContent)) {
    throw new Error(
      `Could not find versionName in ${ANDROID_BUILD_GRADLE_PATH}. Expected format: versionName = "1.0.0"`,
    );
  }

  const oldVersionMatch = gradleContent.match(versionNameRegex);
  const oldVersion = oldVersionMatch ? oldVersionMatch[1] : 'unknown';

  // Replace versionName with the version from package.json
  gradleContent = gradleContent.replace(
    versionNameRegex,
    `versionName = "${version}"`,
  );

  fs.writeFileSync(ANDROID_BUILD_GRADLE_PATH, gradleContent, 'utf-8');
  console.log(
    `✓ Updated Android versionName: ${oldVersion} → ${version} in ${path.relative(ROOT_DIR, ANDROID_BUILD_GRADLE_PATH)}`,
  );
}

/**
 * Main sync function
 */
function syncNativeVersions() {
  try {
    const version = getPackageVersion();
    console.log(`Syncing native app versions from package.json (version: ${version})...`);

    updateAndroidVersion(version);

    // Note: iOS version is typically managed via Xcode project settings
    // (MARKETING_VERSION and CURRENT_PROJECT_VERSION in project.pbxproj)
    // For now, we only sync Android. iOS can be added later if needed.

    console.log('✓ Native version sync complete');
  } catch (error) {
    console.error('✗ Failed to sync native versions:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  syncNativeVersions();
}

export { syncNativeVersions };
