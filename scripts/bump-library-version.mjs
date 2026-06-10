import { readFile, writeFile } from 'node:fs/promises';

const packagePath = new URL('../src/app/agrid/package.json', import.meta.url);
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(packageJson.version);

if (!match) {
  throw new Error(`Cannot increment invalid library version: ${packageJson.version}`);
}

const [, major, minor, patch] = match;
packageJson.version = `${major}.${minor}.${Number(patch) + 1}`;

await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
console.log(`@thkl/agrid version: ${packageJson.version}`);
