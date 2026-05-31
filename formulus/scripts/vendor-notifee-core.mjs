/**
 * Vendors invertase/notifee Android core sources into third_party/notifee
 * so Gradle can compile :notifee_core from source (F-Droid / no app.notifee:core Maven).
 *
 * Pinned to the same commit npm published for @notifee/react-native — bump both together.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const dest = path.join(repoRoot, 'third_party', 'notifee');

/** Must match https://registry.npmjs.org/@notifee/react-native/<version> → gitHead */
const NOTIFEE_COMMIT = 'f00a8e2702ea980455362ac18f84080093dcf32d';
const REMOTE = 'https://github.com/invertase/notifee.git';

function sh(cmd, opts = {}) {
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function headAt(destDir) {
  try {
    return execSync('git rev-parse HEAD', {
      cwd: destDir,
      encoding: 'utf8',
    }).trim();
  } catch {
    return '';
  }
}

/** Upstream enables minify on :notifee_core release; R8 then marks InitProvider.onCreate() final. NotifeeInitProvider subclasses it from another module → LinkageError on release APK only. */
function patchNotifeeAndroidReleaseMinify() {
  const gradle = path.join(dest, 'android', 'build.gradle');
  if (!fs.existsSync(gradle)) return;
  let s = fs.readFileSync(gradle, 'utf8');
  if (s.includes('[formulus] notifee_core release: keep minify off')) return;
  const re = /(\s+release\s*\{\s*\n\s*)minifyEnabled\s+true/;
  if (!re.test(s)) {
    if (!s.includes('minifyEnabled false')) {
      console.warn(
        'vendor-notifee-core: expected `release { minifyEnabled true }` in android/build.gradle — not patching',
      );
    }
    return;
  }
  s = s.replace(
    re,
    `$1// [formulus] notifee_core release: keep minify off (R8 made InitProvider.onCreate final → LinkageError in NotifeeInitProvider)\n      minifyEnabled false`,
  );
  fs.writeFileSync(gradle, s);
  console.log(
    'Patched notifee android/build.gradle (release minifyEnabled false).',
  );
}

/** Prebuilt app.notifee:core AAR in npm; F-Droid requires :notifee_core from source only. */
function removeProprietaryNotifeeLibs() {
  const libsDir = path.join(
    repoRoot,
    'node_modules',
    '@notifee',
    'react-native',
    'android',
    'libs',
  );
  if (!fs.existsSync(libsDir)) {
    return;
  }
  fs.rmSync(libsDir, { recursive: true, force: true });
  console.log('Removed @notifee/react-native/android/libs (proprietary AAR).');
}

if (!fs.existsSync(path.join(dest, 'android', 'build.gradle'))) {
  fs.mkdirSync(dest, { recursive: true });
  if (!fs.existsSync(path.join(dest, '.git'))) {
    sh('git init', { cwd: dest });
    sh(`git remote add origin ${REMOTE}`, { cwd: dest });
  }
  console.log(`Fetching notifee@${NOTIFEE_COMMIT} ...`);
  sh(`git fetch --depth 1 origin ${NOTIFEE_COMMIT}`, { cwd: dest });
  sh('git checkout FETCH_HEAD', { cwd: dest });
  patchNotifeeAndroidReleaseMinify();
  removeProprietaryNotifeeLibs();
  console.log('notifee core ready.');
  process.exit(0);
}

const head = headAt(dest);
if (head === NOTIFEE_COMMIT) {
  patchNotifeeAndroidReleaseMinify();
  removeProprietaryNotifeeLibs();
  console.log(`notifee core already at ${NOTIFEE_COMMIT}`);
  process.exit(0);
}

console.log(`Updating notifee ${head || '(unknown)'} → ${NOTIFEE_COMMIT} ...`);
sh(`git fetch --depth 1 origin ${NOTIFEE_COMMIT}`, { cwd: dest });
sh('git checkout FETCH_HEAD', { cwd: dest });
patchNotifeeAndroidReleaseMinify();
removeProprietaryNotifeeLibs();
console.log('notifee core ready.');
