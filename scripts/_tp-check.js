const Database = require('better-sqlite3');
const p = 'C:\\NextByte\\nexbit.db';
try {
  const db = new Database(p);
  db.pragma('integrity_check');
  const n = db.prepare('SELECT COUNT(*) n FROM productos').get().n;
  const lic = db.prepare("SELECT clave, substr(valor,1,40) v FROM configuracion WHERE clave LIKE 'licencia%'").all();
  console.log('INTEGRIDAD OK, productos:', n);
  console.log(lic);
  db.close();
} catch (e) { console.log('ERROR BD:', e.message); }
process.exit(0);