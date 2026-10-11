import { readFileSync } from 'node:fs';
import { LIB_VERSION } from '../src/version.js';

test('LIB_VERSION matches package.json version', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  expect(LIB_VERSION).toBe(pkg.version);
});
