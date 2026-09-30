// Bundles src/index.js into build/ together with public/index.html.
import { build } from 'esbuild';
import { cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';

rmSync('build', { recursive: true, force: true });
await build({
  entryPoints: ['src/index.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  outfile: 'build/index.js',
});
cpSync('public/index.html', 'build/index.html');
const html = readFileSync('build/index.html', 'utf8').replace('</body>', '  <script src="./index.js"></script>\n</body>');
writeFileSync('build/index.html', html);
console.log('Built static/behaviors/build');
