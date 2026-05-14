/* Adds package.json shims so Node resolves CJS vs ESM correctly. */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
fs.writeFileSync(
  path.join(root, 'dist/cjs/package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2) + '\n',
);
fs.writeFileSync(
  path.join(root, 'dist/esm/package.json'),
  JSON.stringify({ type: 'module' }, null, 2) + '\n',
);
