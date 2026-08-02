const fs = require('fs');
const path = require('path');

const src = path.join(require.resolve('sql.js'), '../../dist/sql-wasm.wasm');
const dest = path.join(__dirname, '../dist/renderer/sql-wasm.wasm');

if (fs.existsSync(src)) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log('WASM copied to dist/renderer/');
} else {
  console.warn('WASM not found at', src);
}
