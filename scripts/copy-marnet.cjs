/* Copy the shared network asset into a build output directory.
 *
 * The CJS build (dist/cjs/lib), the ESM build (dist/esm/lib) and the test
 * build (build/test/lib) all import `../../data/marnet.cjs`, which resolves to
 * `<outRoot>/data/marnet.cjs`. Placing a single copy at that path lets both
 * published builds share one asset (see issue #10) and lets the test build
 * find it at runtime.
 *
 * Usage:
 *   node scripts/copy-marnet.cjs dist    # -> dist/data/marnet.cjs (+ .d.cts)
 *   node scripts/copy-marnet.cjs build   # -> build/data/marnet.cjs (+ .d.cts)
 */
const fs = require('fs');
const path = require('path');

const target = process.argv[2];
if (!target) {
  console.error('usage: node scripts/copy-marnet.cjs <output-root>');
  process.exit(1);
}

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'data');
const outDir = path.resolve(root, target, 'data');

fs.mkdirSync(outDir, { recursive: true });
for (const file of ['marnet.cjs', 'marnet.d.cts']) {
  fs.copyFileSync(path.join(srcDir, file), path.join(outDir, file));
}

console.log('copied network asset to', path.relative(root, outDir));
