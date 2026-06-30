import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const run = promisify(execFile);
const packagePath = new URL('../package.json', import.meta.url);
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));

if (typeof packageJson.version !== 'string' || !packageJson.version.trim()) {
  throw new Error('Cannot create tag: package.json has no version');
}

const tagName = `V${packageJson.version}`;

try {
  await run('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${tagName}`]);
  throw new Error(`Cannot create tag: ${tagName} already exists`);
} catch (error) {
  if (error.message?.includes('already exists')) {
    throw error;
  }
}

await run('git', ['tag', tagName]);
await run('git', ['push', 'main', tagName]);
console.log(`Created and pushed git tag ${tagName}`);
