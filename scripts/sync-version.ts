import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

interface PackageJson {
  version: string;
  [key: string]: any;
}

interface VssExtension {
  version: string;
  [key: string]: any;
}

interface PackageLockJson {
  version: string;
  packages: {
    "": {
      version: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  [key: string]: any;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, '../package.json');
const vssExtensionPath = path.join(__dirname, '../vss-extension.json');
const packageLockPath = path.join(__dirname, '../package-lock.json');

try {
  const packageJson: PackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const vssExtension: VssExtension = JSON.parse(fs.readFileSync(vssExtensionPath, 'utf8'));
  const packageLock: PackageLockJson = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));

  // Update vss-extension.json version
  vssExtension.version = packageJson.version;

  // Update package-lock.json versions
  packageLock.version = packageJson.version;
  packageLock.packages[""].version = packageJson.version;

  fs.writeFileSync(vssExtensionPath, JSON.stringify(vssExtension, null, 2) + '\n');
  fs.writeFileSync(packageLockPath, JSON.stringify(packageLock, null, 2) + '\n');
  console.log(`✅ Synced version to ${packageJson.version}`);
} catch (error) {
  console.error('❌ Failed to sync version:', error instanceof Error ? error.message : error);
  process.exit(1);
}
