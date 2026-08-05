// Genera un código de licencia firmado para Nexbit POS.
// Modalidades:
//   Básica anual:      --plan basic --dias 365
//   Básica de por vida: --plan basic        (sin --dias ni --expira)
//   Pro anual:         --plan pro --dias 365
//   Pro de por vida:   --plan pro           (sin --dias ni --expira)
//   Multi-Cajas anual: --plan multi --dias 365
//   Multi-Cajas de por vida: --plan multi   (sin --dias ni --expira)
// Uso: node scripts/generar-licencia.js --plan basic --cliente "Almacén Pérez"
//      node scripts/generar-licencia.js --plan pro --cliente "Mi Empresa" --lic NEX-001
//      node scripts/generar-licencia.js --plan pro --cliente "X" --dias 365   (expira en 1 año)
//      node scripts/generar-licencia.js --plan pro --cliente "X" --expira 2026-12-31   (fecha fija)
// Imprime el código en stdout. Requiere la llave privada (ver crear-llaves.js).
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function arg(name) {
  const i = args.indexOf('--' + name);
  return i > -1 ? args[i + 1] : undefined;
}

const plan = arg('plan') || 'basic';
const cliente = arg('cliente') || 'Cliente';
const lic = arg('lic') || ('NEX-' + Date.now());
const dias = parseInt(arg('dias'), 10);
if (!['basic', 'pro', 'multi'].includes(plan)) { console.error('--plan debe ser basic, pro o multi'); process.exit(1); }

const keysDir = process.env.NEXBIT_KEYS_DIR || path.join(require('os').homedir(), 'Documents', 'nexbit-keys');
const privPath = arg('key') || path.join(keysDir, 'private.pem');
if (!fs.existsSync(privPath)) { console.error('Llave privada no encontrada:', privPath); process.exit(1); }

const hoy = new Date();
const emitida = hoy.toISOString().slice(0, 10);
const payload = { plan, cliente, lic, emitida };
const expiraArg = arg('expira');
if (expiraArg && /^\d{4}-\d{2}-\d{2}$/.test(expiraArg)) {
  payload.expira = expiraArg;
} else if (!Number.isNaN(dias) && dias > 0) {
  const exp = new Date(hoy);
  exp.setDate(exp.getDate() + dias);
  payload.expira = exp.toISOString().slice(0, 10);
}
const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
const privateKey = crypto.createPrivateKey(fs.readFileSync(privPath));
const sig = crypto.sign(null, Buffer.from(payloadB64), privateKey).toString('base64url');
console.log(`${payloadB64}.${sig}`);
