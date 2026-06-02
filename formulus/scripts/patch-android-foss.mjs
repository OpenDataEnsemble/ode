/**
 * Patches Android dependencies in node_modules for F-Droid / FOSS builds:
 * - @react-native-community/geolocation: no Play Services (framework LocationManager only)
 * - react-native-device-info: no install referrer / Firebase / Play Services Gradle deps
 *
 * Re-run after npm/pnpm install. Bump version pins when upgrading those packages.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

/** Must match resolved versions in package-lock.json */
const GEOLOCATION_VERSION = '3.4.0';
const DEVICE_INFO_VERSION = '15.0.2';

const geolocationRoot = path.join(
  repoRoot,
  'node_modules',
  '@react-native-community',
  'geolocation',
);
const deviceInfoGradle = path.join(
  repoRoot,
  'node_modules',
  'react-native-device-info',
  'android',
  'build.gradle',
);

function read(relPath) {
  return fs.readFileSync(relPath, 'utf8');
}

function write(relPath, content) {
  fs.writeFileSync(relPath, content, 'utf8');
}

function assertPackageVersion(pkgDir, packageName, expectedVersion) {
  const pkgJsonPath = path.join(pkgDir, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) {
    throw new Error(
      `${packageName} not found at ${pkgDir}. Run npm/pnpm install first.`,
    );
  }
  const version = JSON.parse(read(pkgJsonPath)).version;
  if (version !== expectedVersion) {
    throw new Error(
      `Expected ${packageName}@${expectedVersion}, found ${version}. Update patch-android-foss.mjs version pin.`,
    );
  }
}

function patchGeolocation() {
  assertPackageVersion(
    geolocationRoot,
    '@react-native-community/geolocation',
    GEOLOCATION_VERSION,
  );

  const gradlePath = path.join(geolocationRoot, 'android', 'build.gradle');
  let gradle = read(gradlePath);
  const gradleMarker = '// FOSS: Play Services location removed';
  if (!gradle.includes(gradleMarker)) {
    gradle = gradle.replace(
      /^\s*implementation\s+'com\.google\.android\.gms:play-services-location:[^']+'\s*\n/m,
      `  ${gradleMarker}\n`,
    );
    if (gradle.includes('play-services-location')) {
      throw new Error('Failed to remove play-services-location from geolocation build.gradle');
    }
    write(gradlePath, gradle);
    console.log('patched geolocation android/build.gradle');
  }

  const playServicesJava = path.join(
    geolocationRoot,
    'android',
    'src',
    'main',
    'java',
    'com',
    'reactnativecommunity',
    'geolocation',
    'PlayServicesLocationManager.java',
  );
  if (fs.existsSync(playServicesJava)) {
    fs.unlinkSync(playServicesJava);
    console.log('removed PlayServicesLocationManager.java');
  }

  const modulePath = path.join(
    geolocationRoot,
    'android',
    'src',
    'main',
    'java',
    'com',
    'reactnativecommunity',
    'geolocation',
    'GeolocationModule.java',
  );
  let moduleSrc = read(modulePath);
  const moduleMarker = '// FOSS: Android LocationManager only';
  if (!moduleSrc.includes(moduleMarker)) {
    moduleSrc = moduleSrc.replace(
      `import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;

`,
      '',
    );
    moduleSrc = moduleSrc.replace(
      `  private void onConfigurationChange(Configuration config) {
    ReactApplicationContext reactContext = mLocationManager.mReactContext;
    if (Objects.equals(config.locationProvider, "android") && mLocationManager instanceof PlayServicesLocationManager) {
      mLocationManager = new AndroidLocationManager(reactContext);
    } else if (Objects.equals(config.locationProvider, "playServices") && mLocationManager instanceof AndroidLocationManager) {
      GoogleApiAvailability availability = new GoogleApiAvailability();
      if (availability.isGooglePlayServicesAvailable(reactContext.getApplicationContext()) == ConnectionResult.SUCCESS) {
        mLocationManager = new PlayServicesLocationManager(reactContext);
      }
    }
  }`,
      `  private void onConfigurationChange(Configuration config) {
    ${moduleMarker}
  }`,
    );
    if (moduleSrc.includes('com.google.android.gms')) {
      throw new Error('GeolocationModule.java still references Google Play Services');
    }
    if (moduleSrc.includes('PlayServicesLocationManager')) {
      throw new Error('GeolocationModule.java still references PlayServicesLocationManager');
    }
    write(modulePath, moduleSrc);
    console.log('patched GeolocationModule.java');
  }
}

function patchDeviceInfo() {
  const deviceInfoRoot = path.join(repoRoot, 'node_modules', 'react-native-device-info');
  assertPackageVersion(deviceInfoRoot, 'react-native-device-info', DEVICE_INFO_VERSION);

  let gradle = read(deviceInfoGradle);
  const marker = '// FOSS: proprietary Android deps removed';
  if (gradle.includes(marker)) {
    return;
  }

  gradle = gradle.replace(
    /^\s*implementation\s+"com\.android\.installreferrer:installreferrer:[^"]+"\s*\n/m,
    '',
  );
  gradle = gradle.replace(
    /\n  def firebaseBomVersion[\s\S]*?(?=\n  testImplementation)/,
    `\n  ${marker}\n`,
  );
  if (gradle.includes('installreferrer') || gradle.includes('firebase-iid')) {
    throw new Error('device-info build.gradle still lists proprietary dependencies');
  }
  write(deviceInfoGradle, gradle);
  console.log('patched react-native-device-info android/build.gradle');
}

function fixGradleCommentSyntax(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = read(filePath);
  if (content.includes('# FOSS:')) {
    write(filePath, content.replaceAll('# FOSS:', '// FOSS:'));
    console.log(`fixed Gradle comment syntax in ${path.relative(repoRoot, filePath)}`);
  }
}

function main() {
  if (!fs.existsSync(path.join(repoRoot, 'node_modules'))) {
    throw new Error('node_modules missing. Run pnpm install or npm install in formulus/ first.');
  }
  patchGeolocation();
  patchDeviceInfo();
  fixGradleCommentSyntax(path.join(geolocationRoot, 'android', 'build.gradle'));
  fixGradleCommentSyntax(deviceInfoGradle);
  console.log('android FOSS patches applied.');
}

main();
