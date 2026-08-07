// Genera HTML (web) y PDF para los docs de Nexbit.
// md -> HTML estilizado -> PDF via Chrome. Uso: node scripts/generate-docs.js
const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '..', 'docs');
const OUT_DIR = path.join(DOCS_DIR, 'web');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const DOCS = [
  { file: 'MANUAL_CLIENTE.md', title: 'Next Byte — Manual del Cliente' },
  { file: 'GUIA_TECNICA.md', title: 'Next Byte — Guía Técnica de Despliegue' },
];

function mdToHtml(md) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = md.split('\n');
  let html = '';
  let inTable = false;
  let inCode = false;
  let listOpen = false;
  let paraOpen = false;
  let tableRows = [];

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const header = tableRows[0];
    const body = tableRows.slice(2); // skip separator row
    html += '<table><thead><tr>' + header.map((c) => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' +
      body.map((r) => '<tr>' + r.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
    inTable = false;
    tableRows = [];
  };

  const inline = (s) => {
    let t = esc(s);
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    return t;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.startsWith('|')) {
      if (!inTable) { inTable = true; tableRows = []; flushTable(); }
      tableRows.push(line.split('|').slice(1, -1).map((c) => c.trim()).filter((c, i, a) => !(a.length === 1 && c === '')));
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^#+/)[0].length;
      html += `<h${level}>` + inline(line.replace(/^#+\s*/, '')) + `</h${level}>`;
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!listOpen) { html += '<ul>'; listOpen = true; }
      html += '<li>' + inline(line.slice(2)) + '</li>';
    } else if (line.startsWith('> ')) {
      html += '<blockquote>' + inline(line.slice(2)) + '</blockquote>';
    } else if (/^\s*$/.test(line)) {
      if (listOpen) { html += '</ul>'; listOpen = false; }
      if (paraOpen) { html += '</p>'; paraOpen = false; }
    } else if (line === '---') {
      if (listOpen) { html += '</ul>'; listOpen = false; }
      if (paraOpen) { html += '</p>'; paraOpen = false; }
      html += '<hr>';
    } else {
      if (listOpen) { html += '</ul>'; listOpen = false; }
      if (paraOpen) { html += '</p>'; paraOpen = false; }
      paraOpen = true;
      html += '<p>' + inline(line) + '</p>';
    }
  }
  if (inTable) flushTable();
  if (listOpen) html += '</ul>';
  if (paraOpen) html += '</p>';
  return '<div class="content">' + html + '</div>';
}

async function render(title, htmlBody, htmlPath, pdfPath) {
  const pageHtml = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${title}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; background: #fff; }
  .content { max-width: 760px; margin: 0 auto; padding: 48px 40px; color: #1a1a1a; }
  h1 { font-size: 26px; margin: 0 0 8px; }
  h2 { font-size: 19px; margin-top: 32px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
  h3 { font-size: 15px; margin-top: 22px; }
  p, li { font-size: 14px; line-height: 1.6; color: #333; }
  ul { padding-left: 22px; }
  li { margin: 4px 0; }
  code { background: #f5f5f5; padding: 1px 5px; border-radius: 4px; font-size: 13px; }
  strong code { background: transparent; }
  table { border-collapse: collapse; width: 100%; margin: 14px 0; font-size: 13px; }
  th, td { border: 1px solid #ddd; padding: 7px 10px; text-align: left; }
  th { background: #f7f7f7; }
  blockquote { border-left: 3px solid #FF4B00; margin: 12px 0; padding: 4px 14px; color: #555; background: #fff7f3; }
  hr { border: 0; border-top: 1px solid #ddd; margin: 24px 0; }
</style></head>
<body>${htmlBody}</body></html>`;
  fs.writeFileSync(htmlPath, pageHtml);
}

(async () => {
  const { default: puppeteer } = await import('puppeteer-core');
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const d of DOCS) {
    const md = fs.readFileSync(path.join(DOCS_DIR, d.file), 'utf8');
    const html = mdToHtml(md);
    const base = path.basename(d.file, '.md');
    const htmlPath = path.join(OUT_DIR, base + '.html');
    const pdfPath = path.join(OUT_DIR, base + '.pdf');
    await render(d.title, html, htmlPath);
    const page = await browser.newPage();
    await page.goto('file://' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
    await page.close();
    console.log('generado:', base + '.html', base + '.pdf');
  }
  await browser.close();
  console.log('OK');
})().catch((e) => { console.error('FALLO:', e.message); process.exit(1); });