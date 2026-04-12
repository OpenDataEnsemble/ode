import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const formplayerRoot = path.join(__dirname, '..', '..', 'formulus-formplayer');
const buildDir = path.join(formplayerRoot, 'build');
const targetDir = path.join(__dirname, '..', 'public', 'formplayer_dist');

function cleanDirectory(dir) {
  if (!fs.existsSync(dir)) {
    return;
  }
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      fs.rmSync(p, { recursive: true, force: true });
    } else {
      fs.unlinkSync(p);
    }
  }
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    for (const file of fs.readdirSync(src)) {
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

if (!fs.existsSync(buildDir)) {
  console.error(
    '❌ formplayer build/ not found. From formulus-formplayer: npm run build',
  );
  process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });
cleanDirectory(targetDir);
copyRecursive(buildDir, targetDir);
console.log(`✓ Copied formplayer build → ${targetDir}`);
console.log('  Served by Vite as /formplayer_dist/ (base URL in dev).');
