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
  if (!['basic', 'pro', 'multi'].includes(payload.plan)) throw new Error('Plan de licencia desconocido');
  return payload;
}

function limitsFor(plan) {
  if (plan === 'pro') return { max_cajas: 1, max_usuarios: 1 };
  if (plan === 'multi') return { max_cajas: 4, max_usuarios: 4 };
  return { max_cajas: 1, max_usuarios: 1 };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Verdadero si la licencia tiene expiración y ya pasó.
function isExpired(payload) {
  return !!payload.expira && payload.expira < today();
}

function toStatus(payload) {
  return {
    activated: true,
    plan: payload.plan,
    cliente: payload.cliente,
    lic: payload.lic,
    emitida: payload.emitida,
    expira: payload.expira || null,
    ...limitsFor(payload.plan),
  };
}

// Huellas de equipos autorizados (lista JSON). Multi-Cajas permite varias.
function getHuellas() {
  const stored = query(`SELECT valor FROM configuracion WHERE clave = 'licencia_huellas'`)[0]?.valor;
  if (stored) { try { return JSON.parse(stored); } catch { /* migrar */ } }
  const vieja = query(`SELECT valor FROM configuracion WHERE clave = 'licencia_huella'`)[0]?.valor;
  const arr = vieja ? [vieja] : [];
  run(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('licencia_huellas', ?)`, [JSON.stringify(arr)]);
  return arr;
}

// Estado de la licencia activada en este equipo (sin lanzar errores).
function getStatus() {
  const stored = query(`SELECT valor FROM configuracion WHERE clave = 'licencia_codigo'`)[0];
  if (!stored) return { activated: false };
  let payload;
  try { payload = parseCode(stored.valor); }
  catch { return { activated: false, error: 'licencia_invalida' }; }
  const huellaActual = getFingerprint();
  const huellas = getHuellas();
  if (!huellas.includes(huellaActual)) {
    const maxCajas = limitsFor(payload.plan).max_cajas;
    if (huellas.length >= maxCajas) return { activated: false, error: 'otro_equipo', plan: payload.plan, max_cajas: maxCajas };
    huellas.push(huellaActual);
    run(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('licencia_huellas', ?)`, [JSON.stringify(huellas)]);
  }
  if (isExpired(payload)) return { activated: false, error: 'expirada', expira: payload.expira, lic: payload.lic, plan: payload.plan };
  return toStatus(payload);
}

// Activa un código en este equipo. Acepta hasta max_cajas equipos (plan multi).
function activate(code) {
  const payload = parseCode(code);
  if (isExpired(payload)) throw new Error('Esta licencia expiró el ' + payload.expira);
  const huella = getFingerprint();
  let huellas = getHuellas();
  const existing = query(`SELECT valor FROM configuracion WHERE clave = 'licencia_codigo'`)[0];
  if (existing && !huellas.includes(huella)) {
    if (huellas.length >= limitsFor(payload.plan).max_cajas) throw new Error('Esta licencia ya está activada en otro equipo');
    huellas.push(huella);
  }
  if (!huellas.includes(huella)) huellas.push(huella);
  run(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('licencia_codigo', ?)`, [code.trim()]);
  run(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('licencia_huella', ?)`, [huella]);
  run(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('licencia_huellas', ?)`, [JSON.stringify(huellas)]);
  run(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('version', ?)`, [payload.plan]);
  return toStatus(payload);
}

// Los planes pro y multi comparten las funciones premium (SII, promociones, auditoría, usuarios).
function isPremium(plan) {
  return plan === 'pro' || plan === 'multi';
}

module.exports = { parseCode, getStatus, activate, limitsFor, isPremium };
