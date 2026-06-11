import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceDirectory = fileURLToPath(new URL('../src/app/agrid', import.meta.url));
const targetDirectory = fileURLToPath(new URL('../localdist/agrid', import.meta.url));
const runtimeExtensions = new Set(['.css', '.html', '.ts']);

const sourceFiles = await collectRuntimeFiles(sourceDirectory);

await rm(targetDirectory, { force: true, recursive: true });

for (const sourceFile of sourceFiles) {
  const targetFile = join(targetDirectory, relative(sourceDirectory, sourceFile));

  await mkdir(dirname(targetFile), { recursive: true });
  await cp(sourceFile, targetFile);
}

console.log(`Copied ${sourceFiles.length} runtime source files to localdist/agrid.`);

async function collectRuntimeFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectRuntimeFiles(path));
      continue;
    }

    if (
      entry.isFile()
      && runtimeExtensions.has(extname(entry.name))
      && !entry.name.endsWith('.spec.ts')
    ) {
      files.push(path);
    }
  }

  return files.sort();
}
