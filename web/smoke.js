const { execFileSync, spawn } = require('child_process');
const path = require('path');

const PHP = 'C:\\laragon\\bin\\php\\php-8.3.26-Win32-vs16-x64\\php.exe';
const ROOT = path.join(__dirname, '..');
const PORT = 8791; // puerto propio del smoke (no chocar con el server local 8787)

function request(action, args = [], cookie = null) {
  return new Promise((resolve, reject) => {
    const http = require('http');
    const body = JSON.stringify({ action, args });
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) };
    if (cookie) headers['Cookie'] = cookie;
    const req = http.request({ host: '127.0.0.1', port: PORT, path: '/api/index.php', method: 'POST', headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        const cookieOut = (res.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ');
        try { resolve({ status: res.statusCode, body: JSON.parse(data), cookie: cookieOut }); }
        catch (e) { reject(new Error('JSON invalido: ' + data)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  // lint de sintaxis PHP
  execFileSync(PHP, ['-l', path.join(ROOT, 'web', 'api', 'index.php')]);
  console.log('LINT PHP OK');

  // levantar servidor
  const server = spawn(PHP, ['-S', `127.0.0.1:${PORT}`, '-t', path.join(ROOT, 'web')], { stdio: 'pipe' });
  await new Promise((r) => setTimeout(r, 1500));

  let ok = true;
  const check = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + ' ' + name); if (!cond) ok = false; };

  try {
    // ===== INSTALADOR (BD pre-creada VACIA por el runner externo) =====
    let r = await request('install.status', []);
    check('install.status fase 0 (BD sin tablas)', r.body.ok && r.body.data.config === true && r.body.data.db === false);

    r = await request('install.checkLicense', ['codigo-inexistente']);
    check('licencia invalida rechazada', !r.body.ok);

    r = await request('install.checkLicense', ['multi:4:10:DEMO:23782e1f096e']);
    check('licencia valida (plan multi 4/10)', r.body.ok && r.body.data.plan === 'multi' && r.body.data.max_cajas === 4);

    r = await request('install.testDb', [{ host: 'localhost', name: 'nexbit_pos', user: 'root', pass: '' }]);
    check('install.testDb conexion ok', r.body.ok);
    r = await request('install.testDb', [{ host: 'localhost', name: 'bd_inexistente', user: 'root', pass: '' }]);
    check('install.testDb BD inexistente falla', !r.body.ok);

    r = await request('install.applyDb', [{ host: 'localhost', name: 'nexbit_pos', user: 'root', pass: '' }]);
    check('install.applyDb (estructura creada)', r.body.ok);
    r = await request('install.status', []);
    check('install.status fase 1 (tablas ok, licencia demo del seed)', r.body.ok && r.body.data.db === true && r.body.data.licencia === true);
    r = await request('install.saveLicense', ['multi:4:10:DEMO:23782e1f096e']);
    check('install.saveLicense', r.body.ok);
    r = await request('install.status', []);
    check('install.status fase 2 (licencia ok)', r.body.ok && r.body.data.licencia === true);

    r = await request('install.createAdmin', [{ usuario: 'admin', nombre: 'Administrador', password: 'admin123' }]);
    check('install.createAdmin', r.body.ok && r.body.data.id > 0);
    r = await request('install.status', []);
    check('install.status fase 3 (admin ok)', r.body.ok && r.body.data.admin === true);

    r = await request('install.createUsers', [[{ usuario: 'cajero1', password: 'cajero123', rol: 'cajero' }, { usuario: '', password: '', rol: 'cajero' }]]);
    check('install.createUsers (1 creado)', r.body.ok && r.body.data.creados === 1);

    r = await request('install.createCajas', [['Caja Principal', 'Caja 2']]);
    check('install.createCajas (Caja Principal ya existia del seed)', r.body.ok && r.body.data.ids.length === 1);
    r = await request('install.status', []);
    check('install.status instalado (todo ok)', r.body.ok && r.body.data.config && r.body.data.db && r.body.data.licencia && r.body.data.admin && r.body.data.cajas);

    // login con el admin recien creado
    r = await request('auth.login', ['admin', 'admin123']);
    check('login admin/admin123 (creado por instalador)', r.body.ok && r.body.data.nombre_usuario === 'admin');

    r = await request('auth.login', ['admin', 'mal']);
    check('login malo rechazado', !r.body.ok);

    // ---- limite de intentos: 5 fallos bloquean la IP por 5 minutos ----
    for (let i = 0; i < 4; i++) await request('auth.login', ['admin', 'pw-mala-' + i], null);
    r = await request('auth.login', ['admin', 'admin123'], null);
    check('login bloqueado tras 5 intentos fallidos', !r.body.ok && (r.body.error || '').includes('límite') && (r.body.error || '').match(/en \d+ segundos/));

    const mysql = execFileSync('C:\\laragon\\bin\\mysql\\mysql-8.4.3-winx64\\bin\\mysql.exe', ['-u', 'root', '-e', 'DELETE FROM nexbit_pos.login_intentos;']);

    // sesion (sin cookie no hay autenticacion persistente; la UI web usara cookie)
    r = await request('auth.login', ['admin', 'admin123'], null,);
    const ck = r.cookie;
    r = await request('auth.getCurrentUser', [], ck);
    check('sesion por cookie', r.body.ok && r.body.data && r.body.data.id > 0);

    // ---- borrado de usuarios (soft): no admins, no a uno mismo ----
    r = await request('auth.deleteUser', [1], ck);
    check('auth.deleteUser rechaza al admin', !r.body.ok);
    r = await request('auth.deleteUser', [9999], ck);
    check('auth.deleteUser rechaza inexistente', !r.body.ok);
    const tmpUser = 'borrable' + Date.now();
    r = await request('auth.createUser', [{ nombre_usuario: tmpUser, nombre_completo: 'Para borrar', password: 'x12345', rol: 'cajero', permisos: { realizar_ventas: true } }], ck);
    check('auth.createUser (para borrado)', r.body.ok);
    const tmpUserId = r.body.data.id;
    r = await request('auth.deleteUser', [tmpUserId], ck);
    check('auth.deleteUser ok', r.body.ok);
    r = await request('auth.getUsers', [], ck);
    check('usuario borrado ya no aparece en la lista', r.body.ok && !r.body.data.some(u => u.id === tmpUserId));
    r = await request('auth.login', [tmpUser, 'x12345'], null);
    check('usuario borrado no puede iniciar sesion', !r.body.ok);
    r = await request('auth.createUser', [{ nombre_usuario: tmpUser, nombre_completo: 'Para borrar', password: 'x12345', rol: 'cajero', permisos: { realizar_ventas: true } }], ck);
    check('recrear usuario borrado (mismo nombre) reactiva', r.body.ok && r.body.data.id === tmpUserId);
    r = await request('auth.createUser', [{ nombre_usuario: 'admin', nombre_completo: 'Dup', password: 'x', rol: 'cajero' }], ck);
    check('usuario activo duplicado rechazado', !r.body.ok);
    r = await request('auth.deleteUser', [tmpUserId], ck);
    check('limpiar usuario reactivado', r.body.ok);
    r = await request('products.create', [{ codigo_barras: '01', nombre: 'Pan', precio_venta: 1700, precio_costo: 1000, stock: 30, stock_minimo: 5, unidad_medida: 'pieza' }], ck);
    check('crear producto', r.body.ok && r.body.data.id > 0);
    const panId = r.body.data.id;

    r = await request('products.getAll', [{ activo: 1 }], ck);
    check('listar productos', r.body.ok && r.body.data.length >= 1);

    r = await request('products.create', [{ codigo_barras: '00-ZZ', nombre: 'ProductoSinStock', precio_venta: 100, precio_costo: 50, stock: 0, stock_minimo: 1, unidad_medida: 'pieza' }], ck);
    check('crear producto sin stock', r.body.ok && r.body.data.id > 0);
    const sinStockId = r.body.data.id;
    r = await request('products.search', ['ProductoSinStock'], ck);
    check('search excluye stock 0', r.body.ok && !r.body.data.some((p) => p.id === sinStockId));
    r = await request('products.search', ['Pan'], ck);
    check('search incluye productos con stock', r.body.ok && r.body.data.some((p) => p.id === panId));
    r = await request('products.delete', [sinStockId], ck);
    check('limpiar producto sin stock', r.body.ok);

    // ---- FASE: importacion WooCommerce (mock local) ----
    const http = require('http');
    const wcMock = http.createServer((q, s) => {
      const head = { 'Content-Type': 'application/json' };
      if (!q.url.includes('/wp-json/wc/v3/products')) { s.writeHead(404, head); return s.end('{"code":"rest_no_route"}'); }
      if (q.headers.authorization !== 'Basic ' + Buffer.from('ck_test:cs_test').toString('base64')) { s.writeHead(401, head); return s.end('{"code":"woocommerce_rest_invalid_consumer_key"}'); }
      const u = new URL(q.url, 'http://x');
      if (u.searchParams.get('page') === '2') { s.writeHead(200, head); return s.end('[]'); }
      s.writeHead(200, { ...head, 'X-WP-TotalPages': '2' });
      s.end(JSON.stringify([
        { id: 101, name: 'Harina Woo', sku: 'WOO-001', price: '2500', stock_quantity: 15, weight: 1, categories: [{ name: 'Abarrotes' }] },
        { id: 102, name: 'Mantequilla Woo', sku: 'WOO-002', price: '3200', stock_quantity: 8, categories: [{ name: 'Repostería' }] },
        { id: 103, name: 'Azúcar Woo', price: '1200', stock_quantity: 25, categories: [{ name: 'Repostería' }] },
      ]));
    });
    const wcPort = await new Promise((res) => wcMock.listen(0, () => res(wcMock.address().port)));

    r = await request('products.importWoo', [{ url: `http://127.0.0.1:${wcPort}`, consumer_key: 'ck_test', consumer_secret: 'cs_test' }], ck);
    check('products.importWoo (2 paginas/3 productos)', r.body.ok && r.body.data.imported === 3);
    r = await request('products.importWoo', [{ url: `http://127.0.0.1:${wcPort}`, consumer_key: 'ck_mal', consumer_secret: 'x' }], ck);
    check('products.importWoo credenciales malas rechazadas', !r.body.ok);
    r = await request('products.importWoo', [{ url: 'http://127.0.0.1:1', consumer_key: 'ck', consumer_secret: 'cs' }], ck);
    check('products.importWoo tienda inalcanzable falla claro', !r.body.ok);
    r = await request('products.getAll', [{ activo: 1 }], ck);
    check('productos Woo importados visibles + categoria creada', r.body.ok && r.body.data.some((p) => p.codigo_barras === 'WOO-001' && Number(p.stock) === 15));
    r = await request('products.getAll', [{ activo: 1 }], ck);
    check('producto Woo sin SKU recibe WC-103 + pieza', r.body.ok && r.body.data.some((p) => p.codigo_barras === 'WC-103' && p.unidad_medida === 'pieza'));
    r = await request('products.getCategories', [], ck);
    check('categoria Reposteria auto-creada', r.body.ok && r.body.data.some((c) => c.nombre === 'Repostería'));
    wcMock.close();

    // ---- FASE: actualizaciones por boton (mock de GitHub) ----
    const fs = require('fs');
    const fsPath = require('path');
    const staging = fsPath.join(ROOT, 'web', 'api', 'tmp_upd_staging');
    fs.mkdirSync(staging + '/api', { recursive: true });
    fs.copyFileSync(fsPath.join(ROOT, 'web', 'index.html'), staging + '/index.html');
    fs.copyFileSync(fsPath.join(ROOT, 'web', 'api', 'index.php'), staging + '/api/index.php');
    fs.writeFileSync(staging + '/version.json', '{"version": 99}');
    fs.writeFileSync(staging + '/upd_probe.txt', 'ok');
    const updZip = fsPath.join(ROOT, 'web', 'api', 'tmp_upd_test.zip');
    execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', fsPath.join(ROOT, 'web', 'tools', 'make-zip.ps1'), '-Src', staging, '-Out', updZip]);
    const zipEntries = execFileSync('powershell', ['-NoProfile', '-Command', `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::OpenRead('${updZip}').Entries.FullName`]).toString();
    check('zip de update usa rutas con / (extraccion Linux)', !zipEntries.includes('\\') && zipEntries.includes('api/index.php'));
    const updMock = http.createServer((q, s) => {
      if (q.url.includes('version.json')) { s.writeHead(200, { 'Content-Type': 'application/json' }); return s.end('{"version": 99}'); }
      if (q.url.includes('nexbit-pos-web.zip')) { s.writeHead(200, { 'Content-Type': 'application/zip' }); return s.end(fs.readFileSync(updZip)); }
      s.writeHead(404, {}); return s.end('nf');
    });
    const updPort = await new Promise((res) => updMock.listen(0, () => res(updMock.address().port)));
    fs.writeFileSync(fsPath.join(ROOT, 'web', 'api', 'config.generated.php'), "<?php return ['host'=>'localhost','name'=>'nexbit_pos','user'=>'root','pass'=>'','github_base'=>'http://127.0.0.1:" + updPort + "'];\n");
    fs.writeFileSync(fsPath.join(ROOT, 'web', 'api', 'router.local.php'), '<?php // dummy local, el update no debe borrarlo\n');

    r = await request('updates.check', [], ck);
    check('updates.check: hay version 99 pendiente', r.body.ok && r.body.data.pending === true && r.body.data.latest === 99);
    r = await request('updates.apply', [], ck);
    check('updates.apply: aplica y registra v99', r.body.ok && r.body.data.version === 99);
    r = await request('updates.check', [], ck);
    check('updates.check: ya al dia (pending false)', r.body.ok && r.body.data.pending === false && r.body.data.current === 99);
    check('update dejo archivos en su lugar', fs.existsSync(fsPath.join(ROOT, 'web', 'upd_probe.txt')));
    check('config.generated.php y router.local.php NO se tocaron', fs.existsSync(fsPath.join(ROOT, 'web', 'api', 'config.generated.php')) && fs.existsSync(fsPath.join(ROOT, 'web', 'api', 'router.local.php')));
    updMock.close();
    fs.unlinkSync(updZip);
    fs.rmSync(staging, { recursive: true, force: true });
    fs.unlinkSync(fsPath.join(ROOT, 'web', 'upd_probe.txt'));
    fs.unlinkSync(fsPath.join(ROOT, 'web', 'version.json'));
    fs.unlinkSync(fsPath.join(ROOT, 'web', 'api', 'config.generated.php'));
    fs.unlinkSync(fsPath.join(ROOT, 'web', 'api', 'router.local.php'));

    r = await request('caja.open', [{ monto_inicial: 10000, caja_id: 1 }], ck);
    check('abrir caja', r.body.ok);
    r = await request('caja.status', [{ caja_id: 1 }], ck);
    check('caja abierta', r.body.ok && r.body.data && Number(r.body.data.cerrado) === 0);

    r = await request('sesiones.start', [{ caja_id: 1, usuario_id: 1 }], ck);
    check('iniciar sesion caja', r.body.ok);
    r = await request('sesiones.getCurrent', [], ck);
    check('sesion actual', r.body.ok && r.body.data && r.body.data.caja_id === 1);

    r = await request('sales.create', [{ items: [{ producto_id: panId, nombre_producto: 'Pan', cantidad: 2, precio_unitario: 1700 }], forma_pago: 'efectivo' }], ck);
    check('crear venta', r.body.ok && r.body.data.id > 0 && r.body.data.total === 3400);
    const ventaId = r.body.data.id;

    r = await request('sales.get', [ventaId], ck);
    check('leer venta', r.body.ok && r.body.data.total === 3400 && r.body.data.items.length === 1);

    r = await request('products.get', [panId], ck);
    check('stock descontado (30-2=28)', r.body.ok && Number(r.body.data.stock) === 28);

    r = await request('sales.getSummary', [{ desde: '2026-01-01' }], ck);
    check('resumen ventas', r.body.ok && Number(r.body.data.monto_total) === 3400);

    r = await request('reports.profit', [{}], ck);
    check('reporte ganancia (3400-2000=1400)', r.body.ok && Math.round(Number(r.body.data.summary.ganancia) * 10) / 10 === 1400);

    r = await request('clients.create', [{ nombre: 'Juan Pérez' }], ck);
    check('crear cliente', r.body.ok && r.body.data.id > 0);

    r = await request('license.getStatus', [], ck);
    check('licencia web (plan multi 4/10)', r.body.ok && r.body.data.plan === 'multi' && r.body.data.max_cajas === 4 && r.body.data.activated === true && r.body.data.codigo === 'multi:4:10:DEMO:23782e1f096e');

    // ---- FASE 3: licenciamiento firmado ----
    r = await request('license.activate', ['CODIGO-INEXISTENTE'], ck);
    check('licencia inexistente rechazada', !r.body.ok);
    r = await request('license.create', [{ codigo: 'multi:2:5:CLIENTEA:f2204059e093', plan: 'multi', max_cajas: 2, max_usuarios: 5 }], ck);
    check('license.create', r.body.ok && r.body.data.id > 0);
    r = await request('license.activate', ['multi:2:5:CLIENTEA:f2204059e093'], ck);
    check('license.activate (cambio de plan)', r.body.ok && r.body.data.codigo === 'multi:2:5:CLIENTEA:f2204059e093' && r.body.data.max_cajas === 2);
    r = await request('license.list', [], ck);
    check('license.list (2 licencias)', r.body.ok && r.body.data.licencias.length === 2 && r.body.data.actual.codigo === 'multi:2:5:CLIENTEA:f2204059e093');
    r = await request('cajas.create', [{ nombre: 'Caja B' }], ck);
    check('caja nueva rechazada (ya 2 de 2)', !r.body.ok && (r.body.error || '').includes('Límite'));
    r = await request('cajas.create', [{ nombre: 'Caja C' }], ck);
    check('3ra caja rechazada (limite 2)', !r.body.ok && (r.body.error || '').includes('Límite'));
    r = await request('license.activate', ['multi:4:10:DEMO:23782e1f096e'], ck);
    check('reactivar demo', r.body.ok && r.body.data.codigo === 'multi:4:10:DEMO:23782e1f096e' && r.body.data.max_cajas === 4);
    r = await request('config.getMaxCajas', [], ck);
    check('config.getMaxCajas = 4', r.body.ok && r.body.data === 4);

    // ---- FASE 2: inventario recibos ----
    r = await request('inventory.receive', [{ referencia: 'REC-001', proveedor_nombre: 'Prov Test', items: [{ producto_id: panId, cantidad: 10, precio_costo: 1000, subtotal: 10000 }] }], ck);
    check('inventory.receive', r.body.ok === true);
    r = await request('inventory.getReceiveDocuments', [], ck);
    check('inventory.getReceiveDocuments', r.body.ok && r.body.data.length === 1 && r.body.data[0].referencia === 'REC-001');
    r = await request('products.get', [panId], ck);
    check('stock tras recepcion (28+10=38)', r.body.ok && Number(r.body.data.stock) === 38);
    r = await request('inventory.dashboard', [{}], ck);
    check('inventory.dashboard: keys topProducts + sinMovimiento', r.body.ok && Array.isArray(r.body.data.topProducts) && Array.isArray(r.body.data.sinMovimiento));
    check('inventory.dashboard: topProducts con ventas del mes', r.body.ok && r.body.data.topProducts.some((t) => t.nombre === 'Pan' && Number(t.total_vendido) >= 2));

    // ---- FASE 2: devoluciones ----
    r = await request('returns.create', [{ venta_id: ventaId, motivo: 'prueba', items: [{ producto_id: panId, nombre_producto: 'Pan', cantidad: 1, precio_unitario: 1700, subtotal: 1700 }] }], ck);
    check('returns.create', r.body.ok && Number(r.body.data.total) === 1700);
    const devId = r.body.data.id;
    r = await request('returns.get', [devId], ck);
    check('returns.get con items', r.body.ok && r.body.data.items.length === 1);
    r = await request('returns.getAll', [{}], ck);
    check('returns.getAll (1 devolucion)', r.body.ok && r.body.data.length === 1);
    r = await request('products.get', [panId], ck);
    check('stock tras devolucion (38+1=39)', r.body.ok && Number(r.body.data.stock) === 39);

    // ---- FASE 2: cupones CRUD + uso ----
    r = await request('cupones.create', [{ codigo: 'TEST10', tipo: 'porcentaje', valor: 10, usos_maximos: 3, tipo_aplicacion: 'todos' }], ck);
    check('cupones.create', r.body.ok && r.body.data.id > 0);
    const cupId = r.body.data.id;
    r = await request('cupones.update', [{ id: cupId, codigo: 'TEST10', tipo: 'porcentaje', valor: 15, usos_maximos: 2, tipo_aplicacion: 'todos' }], ck);
    check('cupones.update', r.body.ok);
    r = await request('cupones.usar', ['TEST10'], ck);
    check('cupones.usar (valor 15)', r.body.ok && Number(r.body.data.valor) === 15 && Number(r.body.data.usos_actuales) === 1);
    r = await request('cupones.getAll', [], ck);
    check('cupones.getAll', r.body.ok && r.body.data.length === 1);
    r = await request('cupones.delete', [cupId], ck);
    check('cupones.delete', r.body.ok);

    // ---- FASE 2: descuentos por cantidad ----
    r = await request('descuentos.create', [{ producto_id: panId, tipo: 'precio_fijo', reglas: [{ desde: 3, precio: 1500 }] }], ck);
    check('descuentos.create', r.body.ok && r.body.data.id > 0);
    const descId = r.body.data.id;
    r = await request('descuentos.getByProducto', [panId], ck);
    check('descuentos.getByProducto', r.body.ok && r.body.data && r.body.data.reglas.length === 1);
    r = await request('descuentos.getAll', [], ck);
    check('descuentos.getAll (con producto_nombre)', r.body.ok && r.body.data.length === 1 && r.body.data[0].producto_nombre === 'Pan');
    r = await request('descuentos.update', [{ id: descId, producto_id: panId, reglas: [{ desde: 5, precio: 1400 }] }], ck);
    check('descuentos.update', r.body.ok);
    r = await request('descuentos.delete', [descId], ck);
    check('descuentos.delete', r.body.ok);

    // ---- FASE 2: grupos (combos) ----
    r = await request('grupos.create', [{ nombre: 'Combo Pan', precio: 3200, items: [{ producto_id: panId, cantidad: 2 }] }], ck);
    check('grupos.create', r.body.ok && r.body.data.id > 0);
    const grupoId = r.body.data.id;
    r = await request('grupos.getAll', [], ck);
    check('grupos.getAll (1 grupo con items)', r.body.ok && r.body.data.length === 1 && r.body.data[0].items.length === 1 && r.body.data[0].items[0].nombre_producto === 'Pan');
    r = await request('grupos.update', [{ id: grupoId, nombre: 'Combo Pan XL', precio: 3500, items: [{ producto_id: panId, cantidad: 3 }] }], ck);
    check('grupos.update', r.body.ok);
    r = await request('grupos.delete', [grupoId], ck);
    check('grupos.delete', r.body.ok);

    // ---- FASE 2: metricas de caja ----
    r = await request('cajas.metrics', [], ck);
    check('cajas.metrics (ingresos 3400)', r.body.ok && r.body.data.perCaja.length >= 1 && Number(r.body.data.perCaja[0].ingresos) === 3400 && r.body.data.perCajero.length >= 1);

    // ---- FASE 2: boletas + SII + configs ----
    r = await request('boletas.register', [{ tipo_dte: '39', total: 3400, folio: null }], ck);
    check('boletas.register', r.body.ok && Number(r.body.data.folio) === 1);
    r = await request('boletas.getAll', [], ck);
    check('boletas.getAll (1 folio)', r.body.ok && r.body.data.length === 1 && Number(r.body.data[0].folio) === 1);
    r = await request('sii.setConfig', [{ enabled: true, rut_empresa: '76123456-7', razon_social: 'Next Byte' }], ck);
    check('sii.setConfig', r.body.ok);
    r = await request('sii.getConfig', [], ck);
    check('sii.getConfig roundtrip', r.body.ok && r.body.data.enabled === true && r.body.data.rut_empresa === '76123456-7');
    r = await request('scale.getConfig', [], ck);
    check('scale.getConfig (default COM1)', r.body.ok && r.body.data.port === 'COM1');
    r = await request('printer.setConfig', [{ auto_print: false }], ck);
    check('printer.setConfig', r.body.ok);
    r = await request('printer.getConfig', [], ck);
    check('printer.getConfig roundtrip', r.body.ok && r.body.data.auto_print === false);

    console.log('\n' + (ok ? 'SMOKE TOTAL: PASS' : 'SMOKE TOTAL: FAIL'));
  } finally {
    server.kill();
  }
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });