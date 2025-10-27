const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const manifestJsonPath = path.join(__dirname, '..', 'manifest.json');

try {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const manifestJson = JSON.parse(fs.readFileSync(manifestJsonPath, 'utf8'));

  const version = packageJson.version;

  manifestJson.version = version;
  manifestJson.version_name = version;

  fs.writeFileSync(manifestJsonPath, JSON.stringify(manifestJson, null, 2), 'utf8');
  console.log(`Updated manifest.json to version: ${version}`);
} catch (error) {
  console.error('Error updating manifest.json:', error);
  process.exit(1);
}
