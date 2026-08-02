// Validación de licencias Nexbit POS.
// Formato del código: base64url(payload) + "." + base64url(firma Ed25519).
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { query, run } = require('../database/database');
const { getFingerprint } = require('./fingerprint');

const PUBLIC_KEY_PATH = path.join(__dirname, 'license-public.key');

function getPublicKey() {
  return crypto.createPublicKey(fs.readFileSync(PUBLIC_KEY_PATH));
}

// Verifica firma y devuelve el payload, o lanza Error.
function parseCode(code) {
  if (!code || typeof code !== 'string') throw new Error('Código de licencia vacío');
  const [payloadB64, sigB64] = code.trim().split('.');
  if (!payloadB64 || !sigB64) throw new Error('Formato de licencia inválido');
  const payloadBuf = Buffer.from(payloadB64);
  const sigBuf = Buffer.from(sigB64, 'base64url');
  const ok = crypto.verify(null, payloadBuf, getPublicKey(), sigBuf);
  if (!ok) throw new Error('Licencia inválida o falsificada');
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
  if (!['basic', 'pro'].includes(payload.plan)) throw new Error('Plan de licencia desconocido');
  return payload;
}

function limitsFor(plan) {
  return plan === 'pro'
    ? { max_cajas: 4, max_usuarios: 4 }
    : { max_cajas: 1, max_usuarios: 1 };
}

// Estado de la licencia activada en este equipo (sin lanzar errores).
function getStatus() {
  const stored = query(`SELECT valor FROM configuracion WHERE clave = 'licencia_codigo'`)[0];
  if (!stored) return { activated: false };
  let payload;
  try { payload = parseCode(stored.valor); }
  catch { return { activated: false, error: 'licencia_invalida' }; }
  const huella = query(`SELECT valor FROM configuracion WHERE clave = 'licencia_huella'`)[0]?.valor;
  if (huella !== getFingerprint()) return { activated: false, error: 'otro_equipo' };
  return { activated: true, plan: payload.plan, cliente: payload.cliente, lic: payload.lic, ...limitsFor(payload.plan) };
}

// Activa un código en este equipo. Atado a la huella de hardware.
function activate(code) {
  const payload = parseCode(code);
  const huella = getFingerprint();
  const existing = query(`SELECT valor FROM configuracion WHERE clave = 'licencia_codigo'`)[0];
  if (existing) {
    const prevHuella = query(`SELECT valor FROM configuracion WHERE clave = 'licencia_huella'`)[0]?.valor;
    if (prevHuella !== huella) throw new Error('Esta licencia ya está activada en otro equipo');
  }
  run(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('licencia_codigo', ?)`, [code.trim()]);
  run(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('licencia_huella', ?)`, [huella]);
  run(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('version', ?)`, [payload.plan]);
  return { activated: true, plan: payload.plan, cliente: payload.cliente, lic: payload.lic, ...limitsFor(payload.plan) };
}

module.exports = { parseCode, getStatus, activate, limitsFor };
