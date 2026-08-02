// Self-check de licencias: activar, estado, huella y código falsificado.
// Uso: node scripts/test-licencia.js --code "<codigo>"
const os = require('os');
const path = require('path');
const Module = require('module');

const tmpDir = path.join(os.tmpdir(), 'nexbit-license-test');
const orig = Module._load;
Module._load = function (req, ...rest) {
  if (req === 'electron') return { app: { getPath: () => tmpDir } };
  return orig.call(this, req, ...rest);
};

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 ? process.argv[i + 1] : undefined;
}

(async () => {
  const fs = require('fs');
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  const { initDatabase } = require('../src/database/database');
  const { activate, getStatus, parseCode } = require('../src/main/license');
  await initDatabase();

  const proCode = arg('code');
  if (!proCode) { console.error('Falta --code'); process.exit(1); }

  let status = getStatus();
  console.log('antes de activar:', JSON.stringify(status));
  if (status.activated) throw new Error('Debería estar inactiva al inicio');

  const activated = activate(proCode);
  console.log('activada:', JSON.stringify(activated));
  if (!activated.activated || activated.plan !== 'pro') throw new Error('Activación pro falló');

  status = getStatus();
  console.log('estado tras activar:', JSON.stringify(status));
  if (!status.activated || status.plan !== 'pro') throw new Error('Estado tras activar incorrecto');

  const parsed = parseCode(proCode);
  if (parsed.lic !== 'NEX-PRO-001') throw new Error('Payload de licencia incorrecto');

  let falsificada = false;
  try {
    const [p] = proCode.split('.');
    parseCode(p + '.' + 'x'.repeat(87)); // firma alterada
  } catch { falsificada = true; }
  if (!falsificada) throw new Error('Código falsificado NO fue rechazado');

  console.log('OK: activación, estado, huella y rechazo de falsificación correctos');
  process.exit(0);
})().catch(e => { console.error('FALLO:', e.message); process.exit(1); });
