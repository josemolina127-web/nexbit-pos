// Genera el par de llaves Ed25519 para licencias.
// - Privada: se guarda FUERA del repo (Documents\nexbit-keys\private.pem). ¡Nunca subir a GitHub!
// - Pública: se copia a src/main/license-public.key (se empaqueta en la app).
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const keysDir = process.env.NEXBIT_KEYS_DIR || path.join(require('os').homedir(), 'Documents', 'nexbit-keys');
const privPath = path.join(keysDir, 'private.pem');
const pubOut = path.join(__dirname, '../src/main/license-public.key');

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
fs.mkdirSync(keysDir, { recursive: true });
fs.writeFileSync(privPath, privateKey.export({ type: 'pkcs8', format: 'pem' }));
fs.writeFileSync(pubOut, publicKey.export({ type: 'spki', format: 'pem' }));
console.log('Llave privada:', privPath);
console.log('Llave pública: ', pubOut);
