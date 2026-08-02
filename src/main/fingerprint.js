// Huella de hardware: identifica de forma estable esta máquina (Windows).
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const os = require('os');

function readRegistry(valueName) {
  try {
    const out = execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', valueName], { encoding: 'utf8' });
    const m = out.match(/REG_SZ\s+(.+)/);
    return m ? m[1].trim() : '';
  } catch { return ''; }
}

function getBiosUuid() {
  try {
    const out = execFileSync('wmic', ['csproduct', 'get', 'uuid'], { encoding: 'utf8' });
    const lines = out.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    return lines.find(l => l && !/^UUID$/i.test(l)) || '';
  } catch { return ''; }
}

function getFingerprint() {
  const parts = [];
  const guid = readRegistry('MachineGuid');
  if (guid) parts.push('guid:' + guid);
  const uuid = getBiosUuid();
  if (uuid) parts.push('uuid:' + uuid);
  parts.push('host:' + os.hostname());
  parts.push('user:' + os.userInfo().username);
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

module.exports = { getFingerprint };
