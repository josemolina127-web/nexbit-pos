// Genera un código de licencia firmado para Nexbit POS.
// Uso: node scripts/generar-licencia.js --plan basic --cliente "Almacén Pérez"
//      node scripts/generar-licencia.js --plan pro --cliente "Mi Empresa" --lic NEX-001
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
if (!['basic', 'pro'].includes(plan)) { console.error('--plan debe ser basic o pro'); process.exit(1); }

const keysDir = process.env.NEXBIT_KEYS_DIR || path.join(require('os').homedir(), 'Documents', 'nexbit-keys');
const privPath = arg('key') || path.join(keysDir, 'private.pem');
if (!fs.existsSync(privPath)) { console.error('Llave privada no encontrada:', privPath); process.exit(1); }

const payload = { plan, cliente, lic, emitida: new Date().toISOString().slice(0, 10) };
const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
const privateKey = crypto.createPrivateKey(fs.readFileSync(privPath));
const sig = crypto.sign(null, Buffer.from(payloadB64), privateKey).toString('base64url');
console.log(`${payloadB64}.${sig}`);
