const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.env.APPDATA, 'nexbit-pos', 'nexbit.db');
const code = 'eyJwbGFuIjoiYmFzaWMiLCJjbGllbnRlIjoiUHJ1ZWJhIiwibGljIjoiTkVYLUJBU0lDLUFOVUFMIiwiZW1pdGlkYSI6IjIwMjYtMDgtMDIiLCJleHBpcmEiOiIyMDI3LTA4LTAyIn0.ZWGGHVvAySYXlH7zmdBeQu5yJLbJ8y7_x0hKsqNsEvU3aL9O6eqo2Bw33CBI1Ju9KkfZqzrXlUoAOrjOu7cIBw';

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const get = () => db.prepare("SELECT valor FROM configuracion WHERE clave='licencia_codigo'").get();
const r = get();
console.log('antes:', r ? r.valor.slice(0, 40) + '...' : 'sin licencia');
db.prepare("INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('licencia_codigo', ?)").run(code);
const r2 = get();
console.log('despues:', r2.valor.slice(0, 40) + '...');
const [p] = r2.valor.split('.');
console.log('payload:', Buffer.from(p, 'base64url').toString());