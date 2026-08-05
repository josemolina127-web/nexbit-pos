// Smoke test: initDatabase + query/run + WAL + integridad, bajo Electron (addon nativo).
const os = require('os');
const path = require('path');
const Module = require('module');

const tmpDir = path.join(os.tmpdir(), 'nexbit-db-smoke');
const orig = Module._load;
Module._load = function (req, ...rest) {
  if (req === 'electron') return { app: { getPath: () => tmpDir } };
  return orig.call(this, req, ...rest);
};

(async () => {
  const fs = require('fs');
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  const { initDatabase, query, run, getLastInsertId } = require('../src/database/database');
  await initDatabase();

  const cats = query('SELECT COUNT(*) AS c FROM categorias');
  console.log('categorias default:', cats[0].c);
  if (cats[0].c !== 7) throw new Error('Categorias default incorrectas: ' + cats[0].c);

  const id = run('INSERT INTO clientes (nombre, telefono) VALUES (?, ?)', ['Cliente Smoke', '123']);
  const lid = Number(getLastInsertId());
  const row = query('SELECT * FROM clientes WHERE id = ?', [id]);
  console.log('insert cliente:', id, row[0].nombre, 'lastInsertId:', lid);
  if (id !== lid) throw new Error('lastInsertRowid mismatch');

  // WAL debe estar activo
  const getDb = require('../src/database/database').getDb;
  const journal = getDb().prepare('PRAGMA journal_mode').get().journal_mode;
  console.log('journal_mode:', journal);
  if (journal !== 'wal') throw new Error('WAL no activo');

  // Migraciones idempotentes: reabrir no debe fallar
  const { initDatabase: init2 } = require('../src/database/database');
  await init2();
  console.log('re-open OK');
  process.exit(0);
})().catch((e) => { console.error('FALLO:', e.message); process.exit(1); });