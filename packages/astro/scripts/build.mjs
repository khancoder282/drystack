import { rm } from 'node:fs/promises';
import { mkdist } from 'mkdist';

await rm('dist', { recursive: true, force: true });

const { errors, writtenFiles } = await mkdist({
  rootDir: '.',
  srcDir: 'src',
  distDir: 'dist',
  format: 'esm',
  ext: 'js',
  declaration: true,
  pattern: ['**', '!**/*.test.*'],
  esbuild: { jsx: 'automatic' },
});

if (errors.length) {
  for (const { filename, errors: fileErrors } of errors) {
    console.error(filename, fileErrors);
  }
  process.exit(1);
}

console.log(`built ${writtenFiles.length} files`);
