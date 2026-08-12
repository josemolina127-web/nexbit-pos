const http = require('http');
const crypto = require('crypto');
const SECRET = 'clave-local-de-prueba';
function post(payload) {
  return new Promise((resolve) => {
    const body = Buffer.from(payload);
    const firma = crypto.createHmac('sha256', SECRET).update(payload).digest('base64');
    const r = http.request({ host: '127.0.0.1', port: 8796, path: '/store/woo-webhook.php', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': body.length, 'X-WC-Webhook-Signature': firma } }, (x) => {
      let d = '';
      x.on('data', (c) => (d += c));
      x.on('end', () => resolve(x.statusCode + ' ' + d));
    });
    r.write(body); r.end();
  });
}
(async () => {
  const base = { id: 1001, status: 'completed', total: '89990', billing: { first_name: 'Juan', last_name: 'Rojas', email: 'juan@test.cl' }, line_items: [{ product_id: 77 }] };
  console.log('1 pagado:', await post(JSON.stringify(base)));
  console.log('2 repetido:', await post(JSON.stringify(base)));
  const base2 = { ...base, id: 1002, status: 'processing', billing: { first_name: 'Ana', email: 'ana2@test.cl' }, line_items: [{ product_id: 78 }] };
  console.log('3 processing:', await post(JSON.stringify(base2)));
  const mal = { ...base, id: 1003, status: 'on-hold' };
  console.log('4 on-hold:', await post(JSON.stringify(mal)));
  const sinPlan = { ...base, id: 1004, status: 'completed', line_items: [{ product_id: 999 }] };
  console.log('5 sin plan:', await post(JSON.stringify(sinPlan)));
  const firmadaMal = await post(JSON.stringify({ ...base, id: 1005 }) + ' ').catch(() => {});
  console.log('6 firma mala (401):', firmadaMal || 'no esperado');
  const srv = null;
})().catch((e) => console.log('ERR', e.message));