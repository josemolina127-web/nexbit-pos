#!/usr/bin/env node
// Generador de licencias Nexbit POS Web (uso del proveedor).
// Uso: node gen-license.js <plan> <max_cajas> <max_usuarios> <cliente>
//      node gen-license.js                 -> genera un codigo demo multi 4/10
// El codigo es firma HMAC del payload; la API valida con el mismo secreto.
const crypto = require('crypto');

const SECRET = 'nxb7Hq3mP9xL2vRs';

function makeLicense(plan, maxCajas, maxUsuarios, cliente) {
  const payload = [plan, maxCajas, maxUsuarios, cliente].join(':');
  const hmac = crypto.createHmac('sha256', SECRET).update(payload).digest('hex').substring(0, 12);
  return payload + ':' + hmac;
}

const [plan, cajas, usuarios, cliente] = process.argv.slice(2);
console.log(makeLicense(plan || 'multi', cajas || 4, usuarios || 10, cliente || 'DEMO'));