const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', '..', 'formulus', 'android', 'app', 'src', 'main', 'assets', 'formplayer_dist');

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
  console.log('✓ Cleaned formplayer_dist directory');
} else {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log('✓ Created formplayer_dist directory');
}
