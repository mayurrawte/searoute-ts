/* Copy the shared network asset(s) into a build output directory.
 *
 * The CJS build (dist/cjs/lib, dist/cjs/marnet), the ESM build (dist/esm/…)
 * and the test build (build/test/…) all import `../../data/marnet*.cjs`, which
 * resolves to `<outRoot>/data/marnet*.cjs`. Placing a single copy of each asset
 * at that path lets both published builds share one copy (see issue #10) and
 * lets the test build find them at runtime.
 *
 * Copies the default 100 km network plus any resolution variants
 * (data/marnet-<res>.cjs) that back the subpath exports (issue #11), together
 * with their .d.cts type declarations.
 *
 * Usage:
 *   node scripts/copy-marnet.cjs dist    # -> dist/data/marnet*.cjs (+ .d.cts)
 *   node scripts/copy-marnet.cjs build   # -> build/data/marnet*.cjs (+ .d.cts)
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

// Copy every marnet asset and its type declaration: marnet.cjs (default 100 km)
// and any marnet-<res>.cjs resolution variants.
const files = fs
  .readdirSync(srcDir)
  .filter((f) => /^marnet(-[0-9]+km)?\.(cjs|d\.cts)$/.test(f));

for (const file of files) {
  fs.copyFileSync(path.join(srcDir, file), path.join(outDir, file));
}

console.log('copied', files.length, 'network asset files to', path.relative(root, outDir));
