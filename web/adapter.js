// Nexbit POS Web - Adaptador: reemplaza window.nexbit (IPC Electron) por fetch a la API PHP.
// Debe cargarse ANTES que la app React: import './adapter';
// La superficie replica src/main/preload.js 1:1; los metodos de escritorio son no-op o stubs.

const API = 'api/index.php';

function call(action, args = []) {
  return fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ action, args }),
  })
    .then(async (r) => {
      const text = await r.text();
      let j;
      try { j = JSON.parse(text); } catch {
        throw new Error('El servidor no respondió correctamente (HTTP ' + r.status + '). ¿El backend está montado en api/?');
      }
      if (!j.ok) throw new Error(j.error || 'Error de API');
      return j.data;
    });
}

const M = [
  // [nombre expuesto, action API, numero de args]
  ['getLicenseStatus', 'license.getStatus', 0],
  ['activateLicense', 'license.activate', 1],

  ['getInstallStatus', 'install.status', 0],
  ['installCheckLicense', 'install.checkLicense', 1],
  ['installTestDb', 'install.testDb', 1],
  ['installApplyDb', 'install.applyDb', 1],
  ['installSaveLicense', 'install.saveLicense', 1],
  ['installCreateAdmin', 'install.createAdmin', 1],
  ['installCreateUsers', 'install.createUsers', 1],
  ['installCreateCajas', 'install.createCajas', 1],

  ['login', 'auth.login', 2],
  ['logout', 'auth.logout', 0],
  ['getCurrentUser', 'auth.getCurrentUser', 0],
  ['createUser', 'auth.createUser', 1],
  ['updateUser', 'auth.updateUser', 2],
  ['deleteUser', 'auth.deleteUser', 1],
  ['getUsers', 'auth.getUsers', 0],
  ['getUserPermissions', 'auth.getUserPermissions', 0],
  ['getUserPermissionsByUser', 'auth.getUserPermissionsByUser', 1],

  ['getProducts', 'products.getAll', 1],
  ['getProduct', 'products.get', 1],
  ['createProduct', 'products.create', 1],
  ['updateProduct', 'products.update', 2],
  ['deleteProduct', 'products.delete', 1],
  ['importProducts', 'products.import', 1],
  ['importWooProducts', 'products.importWoo', 1],
  ['searchProducts', 'products.search', 1],
  ['getCategories', 'products.getCategories', 0],
  ['createCategory', 'products.createCategory', 1],
  ['updateCategory', 'products.updateCategory', 2],
  ['deleteCategory', 'products.deleteCategory', 1],
  ['getPromoted', 'products.getPromoted', 0],
  ['setPromotion', 'products.setPromotion', 1],

  ['getProviders', 'proveedores.getAll', 0],
  ['getProvider', 'proveedores.get', 1],
  ['createProvider', 'proveedores.create', 1],
  ['updateProvider', 'proveedores.update', 2],
  ['deleteProvider', 'proveedores.delete', 1],

  ['getStockAlerts', 'inventory.getStockAlerts', 0],
  ['adjustStock', 'inventory.adjustStock', 1],
  ['receiveInventory', 'inventory.receive', 1],
  ['getReceiveDocuments', 'inventory.getReceiveDocuments', 0],
  ['updateReceiveDocument', 'inventory.updateReceiveDocument', 2],
  ['deleteReceiveDocument', 'inventory.deleteReceiveDocument', 1],
  ['updateReceiveDocumentItem', 'inventory.updateReceiveDocumentItem', 3],
  ['deleteReceiveDocumentItem', 'inventory.deleteReceiveDocumentItem', 2],
  ['getInventoryMovements', 'inventory.getMovements', 1],
  ['getInventoryDashboard', 'inventory.dashboard', 1],
  ['updateMovement', 'inventory.updateMovement', 1],
  ['deleteMovement', 'inventory.deleteMovement', 1],

  ['createSale', 'sales.create', 1],
  ['getSales', 'sales.getAll', 1],
  ['getSale', 'sales.get', 1],
  ['voidSale', 'sales.void', 2],
  ['getTodaySales', 'sales.getToday', 0],
  ['getSalesSummary', 'sales.getSummary', 1],

  ['getClients', 'clients.getAll', 1],
  ['getClient', 'clients.get', 1],
  ['createClient', 'clients.create', 1],
  ['updateClient', 'clients.update', 2],
  ['searchClients', 'clients.search', 1],
  ['getClientDebt', 'clients.getDebt', 1],
  ['registerPayment', 'clients.registerPayment', 1],

  ['openCashRegister', 'caja.open', 1],
  ['closeCashRegister', 'caja.close', 1],
  ['getCashRegisterStatus', 'caja.status', 1],
  ['getCashRegisterHistory', 'caja.history', 1],
  ['getCajaStatus', 'cajas.getStatus', 1],

  ['getCajas', 'cajas.list', 0],
  ['createCaja', 'cajas.create', 1],
  ['updateCaja', 'cajas.update', 1],
  ['deleteCaja', 'cajas.delete', 1],
  ['getCajaMetrics', 'cajas.metrics', 0],
  ['getAllCajasWithStatus', 'cajas.getAllWithStatus', 0],

  ['startSession', 'sesiones.start', 1],
  ['endSession', 'sesiones.end', 1],
  ['endSessionByUser', 'sesiones.endByUser', 1],
  ['getAvailableCajas', 'sesiones.getAvailable', 0],
  ['getActiveSession', 'sesiones.getActive', 1],
  ['getCurrentSession', 'sesiones.getCurrent', 0],
  ['getAllActiveSessions', 'sesiones.allActive', 0],
  ['joinCajaSession', 'sesiones.join', 1],

  ['getVersion', 'config.getVersion', 0],
  ['setVersion', 'config.setVersion', 1],
  ['getMaxCajas', 'config.getMaxCajas', 0],
  ['checkUpdate', 'updates.check', 0],
  ['applyUpdate', 'updates.apply', 0],

  ['getDailyReport', 'reports.daily', 1],
  ['getTopProducts', 'reports.topProducts', 1],
  ['getProfitReport', 'reports.profit', 1],
  ['getAuditLog', 'reports.auditLog', 1],

  ['createReturn', 'returns.create', 1],
  ['getReturns', 'returns.getAll', 1],
  ['getReturn', 'returns.get', 1],

  ['printTicket', 'printer.printTicket', 1],
  ['getPrinters', 'printer.getPrinters', 0],
  ['readScale', 'scale.read', 0],
  ['configureScale', 'scale.configure', 1],
  ['getScaleConfig', 'scale.getConfig', 0],
  ['getPrinterConfig', 'printer.getConfig', 0],
  ['setPrinterConfig', 'printer.setConfig', 1],
  ['getSiiConfig', 'sii.getConfig', 0],
  ['setSiiConfig', 'sii.setConfig', 1],
  ['backupDatabase', 'backup.create', 0],
  ['getDbPath', 'db.getPath', 0],
  ['setDbPath', 'db.setPath', 1],
  ['createServerFolder', 'db.createServer', 1],
  ['restartApp', 'app.restart', 0],
  ['copyText', 'app.copy', 1],
  ['getAppInfo', 'app.getInfo', 0],
  ['getBoletasEmitidas', 'boletas.getAll', 0],
  ['registerBoletaEmitida', 'boletas.register', 1],
  ['getCupones', 'cupones.getAll', 0],
  ['createCupon', 'cupones.create', 1],
  ['updateCupon', 'cupones.update', 1],
  ['deleteCupon', 'cupones.delete', 1],
  ['usarCupon', 'cupones.usar', 1],
  ['getDescuentosCantidad', 'descuentos.getAll', 0],
  ['createDescuentoCantidad', 'descuentos.create', 1],
  ['updateDescuentoCantidad', 'descuentos.update', 1],
  ['deleteDescuentoCantidad', 'descuentos.delete', 1],
  ['getDescuentoPorProducto', 'descuentos.getByProducto', 1],
  ['setPromotion', 'products.setPromotion', 1],
  ['getGrupos', 'grupos.getAll', 0],
  ['createGrupo', 'grupos.create', 1],
  ['updateGrupo', 'grupos.update', 1],
  ['deleteGrupo', 'grupos.delete', 1],
];

// Variantes que el backend espera con distinta aridad (pocas): se declaran arriba segun preload.
const api = { __isWeb: true, __isMock: undefined };
for (const [name, action, arity] of M) {
  api[name] = (...args) => call(action, args.slice(0, arity));
}

// Stubs de escritorio que la UI llama y la API no define (retornan valores razonables).
api.getUserPermissionsByUser = api.getUserPermissionsByUser || ((id) => api.getUserPermissions());
api.getActiveSession = api.getActiveSession || ((cajaId) => Promise.resolve(null));
api.closeCashRegister = api.closeCashRegister || ((data) => api.openCashRegister(data).then(() => ({ total_esperado: 0, diferencia: 0 })));

// ---- Fase 3: impresion termica via agente local (node web/agent/print-agent.js) ----
const AGENT = 'http://127.0.0.1:9777';
const agentFetch = (p, opts) => fetch(AGENT + p, opts).then((r) => r.json()).catch(() => null);

function buildTicketText(data) {
  const lines = [];
  if (data.lines) {
    lines.push(...data.lines);
  } else if (data.test) {
    lines.push('= TEST DE IMPRESIÓN =');
    lines.push('Impresora configurada correctamente');
    lines.push(`Nombre: ${data.printer || '(predeterminada)'}`);
    lines.push('======================');
  } else {
    lines.push(('Mi Tienda').padStart(32));
    lines.push('='.repeat(32));
    lines.push(`Folio: ${data.id}`);
    lines.push(`Fecha: ${data.fecha}`);
    lines.push(`Cajero: ${data.usuario}`);
    lines.push('-'.repeat(32));
    lines.push('PRODUCTO        CANT   PRECIO  TOTAL');
    if (data.items) {
      for (const item of data.items) {
        const nombre = String(item.nombre_producto || '').substring(0, 14).padEnd(14);
        const cant = String(item.cantidad).padStart(4);
        const precio = `$${Number(item.precio_unitario).toFixed(2)}`.padStart(6);
        const total = `$${Number(item.subtotal).toFixed(2)}`.padStart(6);
        lines.push(`${nombre}  ${cant}  ${precio}  ${total}`);
      }
    }
    lines.push('-'.repeat(32));
    lines.push(`SUBTOTAL:`.padEnd(24) + `$${Number(data.total).toFixed(2)}`.padStart(8));
    if (data.descuento > 0) lines.push(`DESCUENTO:`.padEnd(24) + `-$${Number(data.descuento).toFixed(2)}`.padStart(8));
    lines.push(`TOTAL:`.padEnd(24) + `$${Number(data.total).toFixed(2)}`.padStart(8));
    if (data.pagos && data.pagos.length > 1) {
      lines.push('FORMAS DE PAGO:');
      for (const p of data.pagos) lines.push(`  ${String(p.tipo).toUpperCase()}: $${Number(p.monto).toFixed(2)}`.padStart(24));
    } else {
      lines.push(`FORMA DE PAGO: ${data.forma_pago}`);
    }
    lines.push('='.repeat(32));
    lines.push('Gracias por su compra'.padStart(32));
    lines.push('');
    lines.push('');
  }
  return lines.join('\n');
}

api.getPrinters = async () => {
  const r = await agentFetch('/printers');
  return r && r.ok && r.printers && r.printers.length ? r.printers : ['Impresora Térmica (predeterminada)'];
};

api.printTicket = async (data) => {
  const text = buildTicketText(data);
  await agentFetch('/print', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ printer: data.printer, text }),
  });
  return text;
};

// ---- Bascula via agente local (mismo agente que imprime) ----
const SCALE_OFF = { weight: 0, unit: 'kg', connected: false, message: 'Báscula no disponible (agente local apagado?)' };

api.readScale = async () => {
  const r = await agentFetch('/scale');
  if (!r) return SCALE_OFF;
  return { weight: Number(r.weight) || 0, unit: r.unit || 'kg', connected: !!r.connected, message: r.message || '' };
};

api.getScaleConfig = async () => {
  const r = await agentFetch('/scale/config');
  if (r && r.ok && r.config) return { port: r.config.port, protocol: r.config.protocol };
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action: 'scale.getConfig', args: [] }),
    });
    const b = await res.json();
    return b.ok ? b.data : { port: 'COM1', protocol: 'rs232' };
  } catch (e) { return { port: 'COM1', protocol: 'rs232' }; }
};

api.configureScale = async (config) => {
  await agentFetch('/scale/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ port: config.port, protocol: config.protocol }),
  });
  return true;
};

window.nexbit = api;

export default api;