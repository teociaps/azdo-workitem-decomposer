import 'dotenv/config';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { readFile, readdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const exec = promisify(execCb);

interface Manifest {
  id: string;
  version: string;
  publisher: string;
}

async function readJson<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Publishes the extension from the appropriate VSIX file.
 *
 * Note: Make sure to run the package script beforehand:
 *   _**npm run package:dev**_ for development
 *   OR
 *   _**npm run package**_ for production.
 *
 * @param env - The environment to publish to ('dev' or 'prod').
 * @param customVsix - Optional path to a custom VSIX file. If not specified, the function will find and publish the latest VSIX file matching the expected pattern based on the vss-extension version.
 * @returns Promise<void>
 */
async function publishExtension(env: 'dev' | 'prod', customVsix?: string): Promise<void> {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const manifestPath = path.resolve(__dirname, '../vss-extension.json');
  const manifest = await readJson<Manifest>(manifestPath);

  const isDev = env === 'dev';
  const extId = isDev ? `${manifest.id}-dev` : manifest.id;
  const extVersion = manifest.version.split('-')[0];

  let vsixFile: string;
  if (customVsix) {
    vsixFile = customVsix;
  } else {
    const distDir = path.resolve(__dirname, '../');
    const files = await readdir(distDir);
    const pattern = `${manifest.publisher}.${extId}-${extVersion}`;
    const candidates = files.filter((f) => f.endsWith('.vsix') && f.includes(pattern));
    if (candidates.length === 0) {
      throw new Error(
        `No VSIX found matching pattern: ${pattern}. Please run the package command first.`,
      );
    }
    // Pick the lexicographically latest file
    vsixFile = path.join(distDir, candidates.sort().pop()!);
  }

  console.log(chalk.cyan(`\n> Publishing ${extId}@${extVersion} from ${vsixFile}`));

  const token = process.env.AZURE_DEVOPS_EXT_PAT;
  if (!token) {
    console.error(chalk.red('✖ AZURE_DEVOPS_EXT_PAT not set'));
    process.exit(1);
  }

  await exec(
    `npx tfx-cli extension publish \
    --vsix "${vsixFile}" \
    --no-prompt \
    --token "${token}"`,
    { stdio: 'inherit' } as any,
  );
  console.log(chalk.green(`✔ ${env.toUpperCase()} extension published.`));
}

try {
  const [env, custom] = process.argv.slice(2);
  if (!['dev', 'prod'].includes(env)) {
    console.error(chalk.red('Specify "dev" or "prod" as the first argument.'));
    process.exit(1);
  }

  await publishExtension(env as 'dev' | 'prod', custom);
} catch (err: any) {
  console.error(chalk.red('✖ Failed to publish:'), err.message || err);
  process.exit(1);
}
