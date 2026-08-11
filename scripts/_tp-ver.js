const path = require('path');
const os = require('os');
const fs = require('fs');
const Database = require('better-sqlite3');
const dbPaths = [
  path.join(process.env.APPDATA, 'nexbit-pos', 'nexbit.db'),
  'C:\\NextByte\\nexbit.db',
];
for (const p of dbPaths) {
  if (!fs.existsSync(p)) { console.log('NO EXISTE:', p); continue; }
  try {
    const db = new Database(p, { readonly: true });
    const count = db.prepare('SELECT COUNT(*) n FROM productos').get().n;
    const pan = db.prepare("SELECT * FROM productos WHERE nombre LIKE '%pan%' OR codigo_barras = '01'").all().slice(0, 5);
    console.log('---', p);
    console.log('productos totales:', count);
    console.log('pan/01:', JSON.stringify(pan));
    db.close();
  } catch (e) { console.log('ERROR', p, e.message); }
}
process.exit(0);