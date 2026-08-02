const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.env.APPDATA, 'nexbit-pos', 'nexbit.db');
const code = 'eyJwbGFuIjoiYmFzaWMiLCJjbGllbnRlIjoiUHJ1ZWJhIiwibGljIjoiTkVYLUJBU0lDLUFOVUFMIiwiZW1pdGlkYSI6IjIwMjYtMDgtMDIiLCJleHBpcmEiOiIyMDI3LTA4LTAyIn0.ZWGGHVvAySYXlH7zmdBeQu5yJLbJ8y7_x0hKsqNsEvU3aL9O6eqo2Bw33CBI1Ju9KkfZqzrXlUoAOrjOu7cIBw';

initSqlJs().then((SQL) => {
  const db = new SQL.Database(fs.readFileSync(dbPath));
  const r = db.exec("SELECT valor FROM configuracion WHERE clave='licencia_codigo'");
  console.log('antes:', r[0] ? r[0].values[0][0].slice(0, 40) + '...' : 'sin licencia');
  db.run("INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('licencia_codigo', ?)", [code]);
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
  const r2 = db.exec("SELECT valor FROM configuracion WHERE clave='licencia_codigo'");
  console.log('despues:', r2[0].values[0][0].slice(0, 40) + '...');
  const [p] = r2[0].values[0][0].split('.');
  console.log('payload:', Buffer.from(p, 'base64url').toString());
});
