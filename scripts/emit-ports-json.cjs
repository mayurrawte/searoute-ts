// Emit the UN/LOCODE port dataset as a raw dist/ports.json so it is served
// versioned by the npm CDNs (jsDelivr/unpkg) for use with loadPorts(url).
// Runs after the CJS build, reading the compiled dataset module.
const fs = require('node:fs');
const path = require('node:path');

const dataModule = path.join(__dirname, '..', 'dist', 'cjs', 'ports', 'data.js');
const mod = require(dataModule);
const records = mod.default ?? mod;

const out = path.join(__dirname, '..', 'dist', 'ports.json');
fs.writeFileSync(out, JSON.stringify(records));
console.log(`wrote ${out} (${Object.keys(records).length} port codes)`);
