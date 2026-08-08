// Smoke test: setDbPath/getDbPath (selector de ruta de BD compartida multi-caja).
// Uso: npx electron scripts/smoke-dbpath.js
const os = require('os');
const path = require('path');
const Module = require('module');
const tmpDir = path.join(os.tmpdir(), 'nexbit-dbpath-smoke');
const orig = Module._load;
Module._load = function (req, ...rest) {
  if (req === 'electron') return { app: { getPath: () => tmpDir } };
  return orig.call(this, req, ...rest);
};
(async () => {
  const fs = require('fs');
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });
  const { getDbPath, setDbPath, initDatabase, run, query, getDb } = require('../src/database/database');

  const defaultPath = getDbPath();
  if (!defaultPath.endsWith('nexbit.db')) throw new Error('ruta default incorrecta: ' + defaultPath);

  // override: ruta compartida
  const sharedDir = path.join(tmpDir, 'shared');
  fs.mkdirSync(sharedDir, { recursive: true });
  await initDatabase();
  const sharedPath = path.join(sharedDir, 'nexbit.db');
  const p = setDbPath(sharedPath);
  if (getDbPath() !== sharedPath) throw new Error('override no aplica: ' + getDbPath());
  console.log('override ok:', p);

  // "reinicio": init en la ruta compartida (simula conectar BD + restart)
  await initDatabase();
  run(`INSERT INTO clientes (nombre) VALUES (?)`, ['MultiSmoke']);
  const n = query(`SELECT COUNT(*) AS c FROM clientes WHERE nombre='MultiSmoke'`)[0].c;
  console.log('filas en BD compartida:', n);
  if (n !== 1) throw new Error('no escribió en la BD compartida');
  if (!fs.existsSync(sharedPath)) throw new Error('no se creó la BD compartida');

  // reset a local
  setDbPath('');
  if (getDbPath() !== defaultPath) throw new Error('reset no funcionó');
  console.log('reset ok');

  // validaciones
  let rej = '';
  try { setDbPath('relativa/x.db'); } catch (e) { rej = e.message; }
  if (!rej) throw new Error('debió rechazar ruta relativa');
  rej = '';
  try { setDbPath(path.join(tmpDir, 'no-existe', 'x.db')); } catch (e) { rej = e.message; }
  if (!rej) throw new Error('debió rechazar dir inexistente');
  console.log('ruta relativa y dir inexistente rechazados ok');

  try { getDb().close(); } catch {}
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { console.log('(cleanup parcial:', e.code + ')'); }
  console.log('PASS');
  process.exit(0);
})().catch(e => { console.error('FALLO:', e.message); process.exit(1); });