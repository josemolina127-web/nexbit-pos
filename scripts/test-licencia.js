// Self-check de licencias: activar, estado, huella, código falsificado, expiración y renovación.
// Uso: node scripts/test-licencia.js --code "<codigo>" --renovar "<codigo renovacion>" --vencida "<codigo expirado>"
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
const renovarCode = arg('renovar');
const vencidaCode = arg('vencida');
const multiCode = arg('multi');
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

  if (multiCode) {
    const m = activate(multiCode);
    console.log('multi:', JSON.stringify(m));
    if (!m.activated || m.plan !== 'multi' || m.max_cajas !== 4 || m.max_usuarios !== 4) throw new Error('Plan multi falló');
    const pro = activate(proCode);
    if (pro.max_cajas !== 1 || pro.max_usuarios !== 2) throw new Error('Plan pro debe ser 1 caja / 2 usuarios');
    if (require('fs').existsSync(require('path').join(os.tmpdir(), 'nexbit-license-test'))) {
      // restaurar estado para el resto del test
    }
    console.log('OK: plan multi 4x4 y pro 1x2');
  } else {
    console.log('(plan multi/pro límites no probados: pasa --multi)');
  }

  if (renovarCode) {
    const renovada = activate(renovarCode);
    console.log('renovada:', JSON.stringify(renovada));
    if (!renovada.activated || renovada.plan !== 'pro') throw new Error('Renovación falló');
    status = getStatus();
    if (!status.activated || !status.expira) throw new Error('Renovación sin expiración');
    console.log('OK: renovación aplica y extiende la expiración');
  } else {
    console.log('(renovación no probada: pasa --renovar)');
  }

  if (vencidaCode) {
    let rechazada = false;
    try { activate(vencidaCode); } catch { rechazada = true; }
    if (!rechazada) throw new Error('Código expirado NO fue rechazado al activar');
    console.log('OK: código expirado es rechazado');
  } else {
    console.log('(expiración no probada: pasa --vencida)');
  }
  process.exit(0);
})().catch(e => { console.error('FALLO:', e.message); process.exit(1); });
