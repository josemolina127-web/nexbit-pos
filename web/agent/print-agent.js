#!/usr/bin/env node
// Nexbit POS Web - Agente local de impresion termica (sin dependencias).
// Uso: node print-agent.js [puerto]   (default 9777)
// Endpoints (CORS abierto para la web):
//   GET  /health    -> {ok:true}
//   GET  /printers  -> {ok:true, printers:[...]}
//   POST /print     -> {printer?, text}  imprime en la impresora elegida o la predeterminada
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const PORT = parseInt(process.argv[2] || '9777', 10);

function ps(cmd) {
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], { timeout: 15000 }, (err, stdout) => {
      resolve(err ? null : stdout.trim());
    });
  });
}

async function listPrinters() {
  const out = await ps('Get-CimInstance Win32_Printer | Select-Object -ExpandProperty Name');
  if (!out) return [];
  return out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

async function printText(printer, text) {
  const file = path.join(os.tmpdir(), 'nexbit-ticket-' + Date.now() + '.txt');
  fs.writeFileSync(file, text, 'utf8');
  const safe = printer ? ("'" + printer.replace(/'/g, "''") + "'") : null;
  const cmd = safe
    ? `Get-Content -Raw -Encoding UTF8 '${file}' | Out-Printer -Name ${safe}`
    : `Get-Content -Raw -Encoding UTF8 '${file}' | Out-Printer`;
  const err = await ps(cmd);
  fs.unlinkSync(file);
  return err;
}

// ---- Bascula (RS232 via .NET SerialPort desde PowerShell, sin dependencias) ----
const CONFIG_FILE = path.join(__dirname, 'scale.json');
const DEFAULT_SCALE = { port: 'COM1', protocol: 'rs232' };

function scaleConfig() {
  try { return Object.assign({}, DEFAULT_SCALE, JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))); }
  catch (e) { return Object.assign({}, DEFAULT_SCALE); }
}
function saveScaleConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

// Lee un peso: devuelve {ok:true, raw, weight, unit} o {ok:false, message}
function readScale() {
  const cfg = scaleConfig();
  const script = [
    "$ErrorActionPreference='Stop'",
    "$cfg = @{ port='" + cfg.port + "'; baud=9600 }",
    '$sp = New-Object System.IO.Ports.SerialPort ($cfg.port, $cfg.baud, [System.IO.Ports.Parity]::None, 8, [System.IO.Ports.StopBits]::One)',
    '$sp.ReadTimeout = 1500',
    'try {',
    '  $sp.Open()',
    '  Start-Sleep -Milliseconds 300',
    '  $data = $sp.ReadExisting()',
    '  $sp.Close()',
    '  if ($data) { $data } else { "NO_DATA" }',
    '} catch { "ERR: " + $_.Exception.Message }',
  ].join('\n');
  return ps(script).then((out) => {
    if (!out) return { ok: false, message: 'No se pudo acceder al puerto ' + cfg.port };
    if (out.startsWith('ERR:')) return { ok: false, message: 'No se pudo abrir ' + cfg.port + ' (verifica que la báscula esté conectada)' };
    if (out === 'NO_DATA') return { ok: false, message: 'Sin datos del puerto ' + cfg.port };
    const m = out.match(/(\d+[.,]?\d*)\s*(kg|g|gr|lb|l)?/);
    if (!m) return { ok: false, message: 'Datos sin peso legible: ' + out.trim() };
    return { ok: true, raw: out.trim(), weight: parseFloat(m[1].replace(',', '.')), unit: (m[2] || 'kg').toLowerCase() };
  });
}

const server = http.createServer((req, res) => {
  const send = (code, obj) => {
    res.writeHead(code, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    });
    res.end(JSON.stringify(obj));
  };
  if (req.method === 'OPTIONS') return send(200, {});
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/health') return send(200, { ok: true });
  if (url.pathname === '/printers' && req.method === 'GET') {
    return listPrinters().then((p) => send(200, { ok: true, printers: p }), () => send(200, { ok: true, printers: [] }));
  }
  if (url.pathname === '/print' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      let data;
      try { data = JSON.parse(body); } catch (e) { return send(400, { ok: false, error: 'JSON invalido' }); }
      if (typeof data.text !== 'string') return send(400, { ok: false, error: 'text requerido' });
      printText(data.printer, data.text).then(
        (err) => (err ? send(500, { ok: false, error: err }) : send(200, { ok: true })),
        () => send(500, { ok: false, error: 'No se pudo imprimir' })
      );
    });
    return;
  }
  if (url.pathname === '/scale/config' && req.method === 'GET') return send(200, { ok: true, config: scaleConfig() });
  if (url.pathname === '/scale/config' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const cfg = JSON.parse(body);
        saveScaleConfig({ port: String(cfg.port || 'COM1'), protocol: String(cfg.protocol || 'rs232') });
        send(200, { ok: true });
      } catch (e) { send(400, { ok: false, error: 'JSON invalido' }); }
    });
    return;
  }
  if (url.pathname === '/scale' && req.method === 'GET') {
    return readScale().then(
      (r) => (r.ok ? send(200, { ok: true, weight: r.weight, unit: r.unit, connected: true, message: 'Peso: ' + r.weight + ' ' + r.unit }) : send(200, { ok: false, weight: 0, unit: 'kg', connected: false, message: r.message })),
      () => send(200, { ok: false, weight: 0, unit: 'kg', connected: false, message: 'Error leyendo báscula' })
    );
  }
  send(404, { ok: false, error: 'No encontrado' });
});

server.listen(PORT, '127.0.0.1', () => console.log('Agente de impresion en http://127.0.0.1:' + PORT));