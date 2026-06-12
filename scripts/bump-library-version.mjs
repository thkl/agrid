import { readFile, writeFile } from 'node:fs/promises';

const packagePath = new URL('../src/app/agrid/package.json', import.meta.url);
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(packageJson.version);

if (!match) {
  throw new Error(`Cannot increment invalid library version: ${packageJson.version}`);
}

const [, major, minor, patch] = match;
const version = `${major}.${minor}.${Number(patch) + 1}`;
packageJson.version = version;

await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
console.log(`@thkl/agrid version: ${packageJson.version}`);


const mainPackagePath = new URL('../package.json', import.meta.url);
const mainPackageJson = JSON.parse(await readFile(mainPackagePath, 'utf8'));
const mainMatch = /^(\d+)\.(\d+)\.(\d+)$/.exec(mainPackageJson.version);

if (!mainMatch) {
  throw new Error(`Cannot increment invalid library version: ${mainPackageJson.version}`);
}

mainPackageJson.version = version;
await writeFile(mainPackagePath, `${JSON.stringify(mainPackageJson, null, 2)}\n`);
console.log(`Main version: ${mainPackageJson.version}`);
