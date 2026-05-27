import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const buildDir = path.join(__dirname, '..', 'build');

// Android target directory
const androidTargetDir = path.join(
  __dirname,
  '..',
  '..',
  'formulus',
  'android',
  'app',
  'src',
  'main',
  'assets',
  'formplayer_dist',
);

// iOS target directory - place in ios/Formulus/formplayer_dist so it can be added to Xcode as a folder reference
const iosTargetDir = path.join(
  __dirname,
  '..',
  '..',
  'formulus',
  'ios',
  'formplayer_dist',
);

function cleanDirectory(targetDir) {
  if (fs.existsSync(targetDir)) {
    const files = fs.readdirSync(targetDir);
    for (const file of files) {
      const filePath = path.join(targetDir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
      }
    }
  }
}

function ensureDirectory(targetDir, name) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`✓ Created ${name} directory`);
  }
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const files = fs.readdirSync(src);
    for (const file of files) {
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

if (!fs.existsSync(buildDir)) {
  console.error(
    '❌ Build directory does not exist. Run "pnpm run build" first.',
  );
  process.exit(1);
}

console.log('📦 Copying formplayer build to React Native assets...');

// Copy to Android
ensureDirectory(androidTargetDir, 'Android formplayer_dist');
cleanDirectory(androidTargetDir);
copyRecursive(buildDir, androidTargetDir);
console.log('✓ Successfully copied to Android:', androidTargetDir);

// Copy to iOS
ensureDirectory(iosTargetDir, 'iOS formplayer_dist');
cleanDirectory(iosTargetDir);
copyRecursive(buildDir, iosTargetDir);
console.log('✓ Successfully copied to iOS:', iosTargetDir);

console.log('✅ Formplayer assets copied to both Android and iOS');
