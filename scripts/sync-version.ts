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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, '../package.json');
const vssExtensionPath = path.join(__dirname, '../vss-extension.json');

try {
  const packageJson: PackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const vssExtension: VssExtension = JSON.parse(fs.readFileSync(vssExtensionPath, 'utf8'));

  vssExtension.version = packageJson.version;

  fs.writeFileSync(vssExtensionPath, JSON.stringify(vssExtension, null, 2) + '\n');
  console.log(`✅ Synced version to ${packageJson.version}`);
} catch (error) {
  console.error('❌ Failed to sync version:', error instanceof Error ? error.message : error);
  process.exit(1);
}
