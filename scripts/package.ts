import 'dotenv/config';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const exec = promisify(execCb);

interface Manifest {
  id: string;
  version: string;
}

async function readJson<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Packages a Visual Studio Services (VSS) extension for the specified environment.
 *
 * This function reads the original extension manifest and applies environment-specific overrides,
 * updating the extension ID and version for development builds. It then invokes the TFX CLI to
 * create the extension package, using the appropriate manifest and overrides files.
 *
 * @param env - The target environment for packaging, either 'dev' for development or 'prod' for production.
 * @returns A promise that resolves when the packaging process is complete.
 */
async function packageExtension(env: 'dev' | 'prod'): Promise<void> {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const originalManifestPath = path.resolve(__dirname, '../vss-extension.json');
  const overridesPath = path.resolve(__dirname, `../configs/${env}.json`);

  const original = await readJson<Manifest>(originalManifestPath);
  const overrides = await readJson<Record<string, any>>(overridesPath);

  const isDev = env === 'dev';
  const id = isDev ? `${original.id}-dev` : original.id;
  let extVersion: string;
  if (isDev) {
    let devSuffix = 1;

    if (overrides.version && overrides.version.startsWith(original.version)) {
      const lastPart = overrides.version.split('.')[3];
      if (lastPart) devSuffix = parseInt(lastPart, 10) + 1;
    }

    extVersion = `${original.version}.${devSuffix}`;
    overrides.id = id;
    overrides.version = extVersion;
    await writeFile(overridesPath, JSON.stringify(overrides, null, 4), 'utf-8');
  } else {
    extVersion = original.version;
  }
  if (isDev) {
    const updatedOverrides = { ...overrides, id, version: extVersion };
    await writeFile(overridesPath, JSON.stringify(updatedOverrides, null, 4), 'utf-8');
  }
  console.log(chalk.cyan(`\n> Packaging ${env} extension ${id}@${extVersion}`));

  await exec(
    `npx tfx-cli extension create \
    --manifest-globs "vss-extension.json" \
    --overrides-file "${overridesPath}" \
    --no-prompt`,
    { stdio: 'inherit' } as any,
  );

  console.log(chalk.green(`✔ ${env.toUpperCase()} package created.`));
}

try {
  const runtimeEnvironment = (process.argv[2] ?? '').toLowerCase();

  if (!runtimeEnvironment || (runtimeEnvironment !== 'dev' && runtimeEnvironment !== 'prod')) {
    console.error(chalk.red('✖ Missing or invalid environment. Please pass dev|prod as CLI arg.'));
    process.exit(1);
  }

  await packageExtension(runtimeEnvironment as 'dev' | 'prod');
} catch (error) {
  console.error(
    chalk.red('✖ Failed to create package:'),
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
}
