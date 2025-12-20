const fs = require('fs');
const path = require('path');

// Get the directory paths
const scriptsDir = __dirname;
const formplayerDir = path.join(scriptsDir, '..');
const formulusDir = path.join(formplayerDir, '..', 'formulus');

// Source and destination paths
const source = path.join(
  formulusDir,
  'src',
  'webview',
  'FormulusInterfaceDefinition.ts',
);
const dest = path.join(formplayerDir, 'src', 'FormulusInterfaceDefinition.ts');

try {
  // Check if source file exists
  if (!fs.existsSync(source)) {
    console.error(
      `Error: Source file not found at ${source}`,
    );
    process.exit(1);
  }

  // Ensure destination directory exists
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, {recursive: true});
  }

  // Copy the file
  fs.copyFileSync(source, dest);
  console.log(
    `✓ Successfully synced FormulusInterfaceDefinition.ts from formulus to formulus-formplayer`,
  );
} catch (error) {
  console.error(`Error syncing FormulusInterfaceDefinition.ts:`, error.message);
  process.exit(1);
}

