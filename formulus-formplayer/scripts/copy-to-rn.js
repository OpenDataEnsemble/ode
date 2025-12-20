const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '..', 'build');
const targetDir = path.join(__dirname, '..', '..', 'formulus', 'android', 'app', 'src', 'main', 'assets', 'formplayer_dist');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log('✓ Created formplayer_dist directory');
}

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
  console.error('❌ Build directory does not exist. Run "npm run build" first.');
  process.exit(1);
}

console.log('📦 Copying formplayer build to React Native assets...');
copyRecursive(buildDir, targetDir);
console.log('✓ Successfully copied to', targetDir);
