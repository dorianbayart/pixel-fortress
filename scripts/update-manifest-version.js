const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const manifestJsonPath = path.join(__dirname, '..', 'manifest.json');
const swJsPath = path.join(__dirname, '..', 'sw.js');

try {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const manifestJson = JSON.parse(fs.readFileSync(manifestJsonPath, 'utf8'));

  const version = packageJson.version;

  manifestJson.version = version;
  manifestJson.version_name = version;

  fs.writeFileSync(manifestJsonPath, JSON.stringify(manifestJson, null, 2), 'utf8');
  console.log(`Updated manifest.json to version: ${version}`);

  const swJs = fs.readFileSync(swJsPath, 'utf8');
  const updatedSwJs = swJs.replace(/const CACHE_NAME = 'PixelFortress_Cache_[^']+'/, `const CACHE_NAME = 'PixelFortress_Cache_${version}'`);
  fs.writeFileSync(swJsPath, updatedSwJs, 'utf8');
  console.log(`Updated sw.js CACHE_NAME to version: ${version}`);
} catch (error) {
  console.error('Error updating manifest/sw versions:', error);
  process.exit(1);
}
