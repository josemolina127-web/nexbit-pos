const { ipcMain } = require('electron');
const crypto = require('crypto');
const { query, run, getLastInsertId } = require('../database/database');
const { getStatus, activate } = require('./license');

// Límites según la licencia activada (básica: 1 caja, 1 usuario, solo admin).
function planInfo() {
  const st = getStatus();
  if (st.activated) return st;
  return { activated: false, plan: 'basic', max_cajas: 1, max_usuarios: 1 };
}

function requirePro() {
  if (planInfo().plan !== 'pro') throw new Error('Disponible solo en versión Pro');
}

let currentUser = null;
let currentSessionId = null;

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function normalizeStock(v, unit) {
  const n = parseFloat(v) || 0;
  return unit === 'pieza' ? Math.round(n) : Math.round(n * 1000) / 1000;
}

function logAudit(usuarioId, accion, detalle, valoresAnteriores = null, valoresNuevos = null) {
  run(`INSERT INTO auditoria (usuario_id, accion, detalle, valores_anteriores, valores_nuevos) VALUES (?, ?, ?, ?, ?)`,
    [usuarioId, accion, detalle, valoresAnteriores ? JSON.stringify(valoresAnteriores) : null, valoresNuevos ? JSON.stringify(valoresNuevos) : null]);
}

function hasPermission(permiso) {
  if (!currentUser) return false;
  if (currentUser.rol === 'admin') return true;
  const perms = query(`SELECT valor FROM permisos_usuario WHERE usuario_id = ? AND permiso = ?`, [currentUser.id, permiso]);
  return perms.length > 0 && perms[0].valor === 1;
}

function requirePermission(permiso) {
  if (!hasPermission(permiso)) {
    throw new Error('Permiso denegado');
  }
}

function registerIpcHandlers() {

  // ==================== AUTH ====================
  ipcMain.handle('auth:login', (_, username, password) => {
    const hash = hashPassword(password);
    const users = query(`SELECT id, nombre_usuario, nombre_completo, rol FROM usuarios WHERE nombre_usuario = ? AND password_hash = ? AND activo = 1`, [username, hash]);
    if (users.length === 0) throw new Error('Usuario o contraseña incorrectos');
    currentUser = users[0];
    logAudit(currentUser.id, 'login', `Usuario ${currentUser.nombre_usuario} inició sesión`);
    return currentUser;
  });

  ipcMain.handle('auth:logout', () => {
    if (currentUser) {
      // End any active session for this user (safety net)
      run(`UPDATE sesiones_caja SET activa = 0, fin = datetime('now','localtime') WHERE usuario_id = ? AND activa = 1`, [currentUser.id]);
      logAudit(currentUser.id, 'logout', `Usuario ${currentUser.nombre_usuario} cerró sesión`);
    }
    currentUser = null;
    currentSessionId = null;
    return true;
  });

  ipcMain.handle('auth:getCurrentUser', () => currentUser);

  ipcMain.handle('auth:createUser', (_, data) => {
    requirePermission('gestionar_usuarios');
    const { max_usuarios } = planInfo();
    const count = query(`SELECT COUNT(*) as cnt FROM usuarios WHERE activo = 1`)[0].cnt;
    if (count >= max_usuarios) throw new Error(`Límite de usuarios alcanzado (${max_usuarios}). Su plan ${planInfo().plan === 'pro' ? 'Pro' : 'Básica'} permite hasta ${max_usuarios}.`);
    const hash = hashPassword(data.password);
    run(`INSERT INTO usuarios (nombre_usuario, nombre_completo, password_hash, rol) VALUES (?, ?, ?, ?)`,
      [data.nombre_usuario, data.nombre_completo, hash, data.rol || 'cajero']);
    const id = getLastInsertId();
    // Use provided permissions, fallback to role defaults
    const perms = (data.permisos && Object.keys(data.permisos).length) ? data.permisos : getDefaultPermissions(data.rol || 'cajero');
    for (const [permiso, valor] of Object.entries(perms)) {
      run(`INSERT INTO permisos_usuario (usuario_id, permiso, valor) VALUES (?, ?, ?)`, [id, permiso, valor ? 1 : 0]);
    }
    logAudit(currentUser.id, 'crear_usuario', `Usuario creado: ${data.nombre_usuario}`);
    return { id, ...data };
  });

  ipcMain.handle('auth:updateUser', (_, id, data) => {
    requirePermission('gestionar_usuarios');
    if (data.password) {
      const hash = hashPassword(data.password);
      run(`UPDATE usuarios SET nombre_completo = ?, rol = ?, password_hash = ? WHERE id = ?`, [data.nombre_completo, data.rol, hash, id]);
    } else {
      run(`UPDATE usuarios SET nombre_completo = ?, rol = ? WHERE id = ?`, [data.nombre_completo, data.rol, id]);
    }
    if (data.permisos) {
      for (const [permiso, valor] of Object.entries(data.permisos)) {
        run(`INSERT OR REPLACE INTO permisos_usuario (usuario_id, permiso, valor) VALUES (?, ?, ?)`, [id, permiso, valor ? 1 : 0]);
      }
    }
    logAudit(currentUser.id, 'actualizar_usuario', `Usuario actualizado ID: ${id}`);
    return true;
  });

  ipcMain.handle('auth:getUsers', () => {
    requirePermission('gestionar_usuarios');
    return query(`SELECT id, nombre_usuario, nombre_completo, rol, activo FROM usuarios ORDER BY nombre_completo`);
  });

  ipcMain.handle('auth:getUserPermissions', () => {
    if (!currentUser) return {};
    if (currentUser.rol === 'admin') {
      return Object.fromEntries(ALL_PERMISSIONS.map(p => [p, true]));
    }
    const perms = query(`SELECT permiso, valor FROM permisos_usuario WHERE usuario_id = ?`, [currentUser.id]);
    const result = {};
    for (const p of perms) result[p.permiso] = p.valor === 1;
    return result;
  });

  ipcMain.handle('auth:getUserPermissionsByUser', (_, id) => {
    requirePermission('gestionar_usuarios');
    const user = query(`SELECT rol FROM usuarios WHERE id = ?`, [id])[0];
    if (user && user.rol === 'admin') {
      return Object.fromEntries(ALL_PERMISSIONS.map(p => [p, true]));
    }
    const perms = query(`SELECT permiso, valor FROM permisos_usuario WHERE usuario_id = ?`, [id]);
    const result = {};
    for (const p of perms) result[p.permiso] = p.valor === 1;
    return result;
  });

  // ==================== LICENSE ====================
  ipcMain.handle('license:getStatus', () => getStatus());
  ipcMain.handle('license:activate', (_, code) => {
    if (!code || typeof code !== 'string') throw new Error('Código de licencia vacío');
    return activate(code);
  });

  // ==================== PRODUCTS ====================
  ipcMain.handle('products:getAll', (_, filters = {}) => {
    let sql = `SELECT p.*, c.nombre as categoria_nombre, prov.nombre as proveedor_nombre FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id LEFT JOIN proveedores prov ON p.proveedor_id = prov.id WHERE 1=1`;
    const params = [];
    if (filters.activo !== undefined) { sql += ` AND p.activo = ?`; params.push(filters.activo); }
    if (filters.categoria_id) { sql += ` AND p.categoria_id = ?`; params.push(filters.categoria_id); }
    if (filters.proveedor_id) { sql += ` AND p.proveedor_id = ?`; params.push(filters.proveedor_id); }
    if (filters.stock_bajo) { sql += ` AND p.stock <= p.stock_minimo`; }
    sql += ` ORDER BY p.nombre`;
    return query(sql, params);
  });

  ipcMain.handle('products:get', (_, id) => {
    const results = query(`SELECT p.*, c.nombre as categoria_nombre, prov.nombre as proveedor_nombre FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id LEFT JOIN proveedores prov ON p.proveedor_id = prov.id WHERE p.id = ?`, [id]);
    return results[0] || null;
  });

  ipcMain.handle('products:create', (_, data) => {
    requirePermission('gestionar_productos');
    const isUnit = (data.unidad_medida || 'pieza') === 'pieza';
    const stock = isUnit ? Math.round(Number(data.stock) || 0) : Math.round((Number(data.stock) || 0) * 1000) / 1000;
    const stockMinimo = isUnit ? Math.round(Number(data.stock_minimo) || 0) : Math.round((Number(data.stock_minimo) || 0) * 1000) / 1000;
    run(`INSERT INTO productos (codigo_barras, nombre, precio_venta, precio_costo, stock, stock_minimo, categoria_id, unidad_medida, proveedor_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.codigo_barras || null, data.nombre, data.precio_venta, data.precio_costo, stock, stockMinimo, data.categoria_id || null, data.unidad_medida || 'pieza', data.proveedor_id ? parseInt(data.proveedor_id) : null]);
    const id = getLastInsertId();
    logAudit(currentUser.id, 'crear_producto', `Producto creado: ${data.nombre}`);
    return { id, ...data };
  });

  ipcMain.handle('products:update', (_, id, data) => {
    requirePermission('gestionar_productos');
    const old = query(`SELECT * FROM productos WHERE id = ?`, [id])[0];
    const isUnit = (data.unidad_medida || old.unidad_medida) === 'pieza';
    const stock = isUnit ? Math.round(Number(data.stock) || 0) : Math.round((Number(data.stock) || 0) * 1000) / 1000;
    run(`UPDATE productos SET codigo_barras=?, nombre=?, precio_venta=?, precio_costo=?, stock=?, stock_minimo=?, categoria_id=?, unidad_medida=?, proveedor_id=?, updated_at=datetime('now','localtime') WHERE id=?`,
      [data.codigo_barras, data.nombre, data.precio_venta, data.precio_costo, stock, data.stock_minimo, data.categoria_id, data.unidad_medida, data.proveedor_id ? parseInt(data.proveedor_id) : null, id]);
    logAudit(currentUser.id, 'actualizar_producto', `Producto actualizado: ${data.nombre}`, old, data);
    return true;
  });

  ipcMain.handle('products:delete', (_, id) => {
    requirePermission('gestionar_productos');
    const old = query(`SELECT * FROM productos WHERE id = ?`, [id])[0];
    run(`DELETE FROM movimientos_inventario WHERE producto_id = ?`, [id]);
    run(`UPDATE ventas_detalle SET producto_id = NULL WHERE producto_id = ?`, [id]);
    run(`DELETE FROM productos WHERE id = ?`, [id]);
    logAudit(currentUser.id, 'eliminar_producto', `Producto eliminado: ${old?.nombre} (ID: ${id})`, old);
    return true;
  });

  ipcMain.handle('products:search', (_, q) => {
    const search = `%${q}%`;
    return query(`SELECT p.*, c.nombre as categoria_nombre, prov.nombre as proveedor_nombre FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id LEFT JOIN proveedores prov ON p.proveedor_id = prov.id WHERE p.activo = 1 AND (p.nombre LIKE ? OR p.codigo_barras LIKE ?) ORDER BY p.nombre LIMIT 20`, [search, search]);
  });

  ipcMain.handle('products:import', (_, products) => {
    requirePermission('gestionar_productos');
    let count = 0;
    for (const p of products) {
      try {
        run(`INSERT INTO productos (codigo_barras, nombre, precio_venta, precio_costo, stock, stock_minimo, categoria_id, unidad_medida, proveedor_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [p.codigo_barras || null, p.nombre, p.precio_venta, p.precio_costo, p.stock || 0, p.stock_minimo || 0, p.categoria_id || null, p.unidad_medida || 'pieza', p.proveedor_id ? parseInt(p.proveedor_id) : null]);
        count++;
      } catch (e) { /* skip duplicates */ }
    }
    logAudit(currentUser.id, 'importar_productos', `${count} productos importados`);
    return { imported: count };
  });

  ipcMain.handle('products:getCategories', () => {
    return query(`SELECT * FROM categorias ORDER BY nombre`);
  });

  ipcMain.handle('products:createCategory', (_, name) => {
    run(`INSERT INTO categorias (nombre) VALUES (?)`, [name]);
    return { id: getLastInsertId(), nombre: name };
  });

  ipcMain.handle('products:updateCategory', (_, id, name) => {
    run(`UPDATE categorias SET nombre = ? WHERE id = ?`, [name, id]);
    return true;
  });

  ipcMain.handle('products:deleteCategory', (_, id) => {
    run(`UPDATE productos SET categoria_id = NULL WHERE categoria_id = ?`, [id]);
    run(`DELETE FROM categorias WHERE id = ?`, [id]);
    return true;
  });

  // ==================== PROVEEDORES ====================
  ipcMain.handle('proveedores:getAll', () => {
    return query(`SELECT * FROM proveedores ORDER BY nombre`);
  });

  ipcMain.handle('proveedores:get', (_, id) => {
    const r = query(`SELECT * FROM proveedores WHERE id = ?`, [id]);
    return r[0] || null;
  });

  ipcMain.handle('proveedores:create', (_, data) => {
    requirePermission('gestionar_productos');
    run(`INSERT INTO proveedores (nombre, telefono, email, direccion) VALUES (?, ?, ?, ?)`,
      [data.nombre, data.telefono || null, data.email || null, data.direccion || null]);
    const id = getLastInsertId();
    logAudit(currentUser.id, 'crear_proveedor', `Proveedor creado: ${data.nombre}`);
    return { id, ...data };
  });

  ipcMain.handle('proveedores:update', (_, id, data) => {
    requirePermission('gestionar_productos');
    run(`UPDATE proveedores SET nombre=?, telefono=?, email=?, direccion=? WHERE id=?`,
      [data.nombre, data.telefono || null, data.email || null, data.direccion || null, id]);
    logAudit(currentUser.id, 'actualizar_proveedor', `Proveedor actualizado: ${data.nombre}`);
    return true;
  });

  ipcMain.handle('proveedores:delete', (_, id) => {
    requirePermission('gestionar_productos');
    run(`UPDATE productos SET proveedor_id = NULL WHERE proveedor_id = ?`, [id]);
    run(`DELETE FROM proveedores WHERE id = ?`, [id]);
    logAudit(currentUser.id, 'eliminar_proveedor', `Proveedor eliminado ID: ${id}`);
    return true;
  });

  // ==================== INVENTORY ====================
  ipcMain.handle('inventory:getStockAlerts', () => {
    return query(`SELECT p.*, c.nombre as categoria_nombre, prov.nombre as proveedor_nombre FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id LEFT JOIN proveedores prov ON p.proveedor_id = prov.id WHERE p.activo = 1 AND p.stock <= p.stock_minimo ORDER BY (p.stock_minimo - p.stock) DESC`);
  });

  ipcMain.handle('inventory:adjustStock', (_, data) => {
    requirePermission('ajustar_stock');
    const product = query(`SELECT * FROM productos WHERE id = ?`, [data.producto_id])[0];
    if (!product) throw new Error('Producto no encontrado');
    const stockAnt = product.stock;
    const nuevoStock = product.unidad_medida === 'pieza' ? Math.round(Number(data.nuevo_stock) || 0) : Math.round((Number(data.nuevo_stock) || 0) * 1000) / 1000;
    run(`UPDATE productos SET stock = ?, updated_at = datetime('now','localtime') WHERE id = ?`, [nuevoStock, data.producto_id]);
    run(`INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, precio_costo, referencia, usuario_id) VALUES (?, 'ajuste', ?, ?, ?, ?, ?, ?)`,
      [data.producto_id, nuevoStock - stockAnt, stockAnt, nuevoStock, data.precio_costo || product.precio_costo, data.motivo || 'Ajuste manual', currentUser.id]);
    logAudit(currentUser.id, 'ajustar_stock', `Stock ajustado: ${product.nombre} (${stockAnt} → ${data.nuevo_stock})`);
    return true;
  });

  ipcMain.handle('inventory:receive', (_, data) => {
    requirePermission('realizar_entradas');
    const refBase = data.referencia || `REC-${Date.now()}`;
    const proveedorNombre = data.proveedor_id ? (query(`SELECT nombre FROM proveedores WHERE id = ?`, [data.proveedor_id])[0]?.nombre || '') : '';
    const ref = proveedorNombre ? `${refBase} (${proveedorNombre})` : refBase;
    const items = [];
    for (const item of data.items) {
      const product = query(`SELECT * FROM productos WHERE id = ?`, [item.producto_id])[0];
      if (!product) throw new Error(`Producto ID ${item.producto_id} no encontrado`);
      const stockAnt = product.stock;
      const stockNuevo = product.unidad_medida === 'pieza' ? Math.round(stockAnt + (Number(item.cantidad) || 0)) : Math.round((stockAnt + (Number(item.cantidad) || 0)) * 1000) / 1000;
      run(`UPDATE productos SET stock = ?, precio_costo = ?, updated_at = datetime('now','localtime') WHERE id = ?`,
        [stockNuevo, item.precio_costo || product.precio_costo, item.producto_id]);
      run(`INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, precio_costo, referencia, usuario_id) VALUES (?, 'entrada', ?, ?, ?, ?, ?, ?)`,
        [item.producto_id, item.cantidad, stockAnt, stockNuevo, item.precio_costo || product.precio_costo, ref, currentUser.id]);
      items.push({ producto_id: item.producto_id, producto_nombre: product.nombre, cantidad: item.cantidad, precio_costo: item.precio_costo || product.precio_costo });
    }
    run(`INSERT INTO documentos_entrada (referencia, proveedor_id, proveedor_nombre, total_items, usuario_id, items_json, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'))`,
      [refBase, data.proveedor_id || null, proveedorNombre, items.length, currentUser.id, JSON.stringify(items)]);
    logAudit(currentUser.id, 'recibir_mercancia', `Entrada (${data.items.length} productos): ${ref}`);
    return true;
  });

  ipcMain.handle('inventory:getReceiveDocuments', () => {
    const docs = query(`SELECT d.*, u.nombre_usuario as usuario FROM documentos_entrada d LEFT JOIN usuarios u ON d.usuario_id = u.id ORDER BY d.created_at DESC`);
    return docs.map(d => ({ ...d, items: d.items_json ? JSON.parse(d.items_json) : [] }));
  });

  ipcMain.handle('inventory:updateReceiveDocument', (_, id, data) => {
    requirePermission('realizar_entradas');
    if (data.referencia) {
      const oldRef = query(`SELECT referencia FROM documentos_entrada WHERE id = ?`, [id])[0]?.referencia;
      if (oldRef) {
        run(`UPDATE movimientos_inventario SET referencia = ? WHERE referencia = ? AND tipo = 'entrada'`, [data.referencia, oldRef]);
      }
      run(`UPDATE documentos_entrada SET referencia = ? WHERE id = ?`, [data.referencia, id]);
    }
    logAudit(currentUser.id, 'editar_documento_entrada', `Documento #${id} actualizado`);
    return true;
  });

  ipcMain.handle('inventory:updateReceiveDocumentItem', (_, docId, productId, data) => {
    requirePermission('realizar_entradas');
    const doc = query(`SELECT * FROM documentos_entrada WHERE id = ?`, [docId])[0];
    if (!doc) throw new Error('Documento no encontrado');
    const items = doc.items_json ? JSON.parse(doc.items_json) : [];
    const item = items.find(i => i.producto_id === productId);
    if (!item) throw new Error('Producto no encontrado en el documento');
    const oldCantidad = item.cantidad;
    if (data.cantidad !== undefined) item.cantidad = data.cantidad;
    if (data.precio_costo !== undefined) item.precio_costo = data.precio_costo;
    run(`UPDATE productos SET stock = MAX(0, stock + ?), updated_at = datetime('now','localtime') WHERE id = ?`, [(data.cantidad || oldCantidad) - oldCantidad, productId]);
    run(`UPDATE documentos_entrada SET items_json = ?, total_items = ? WHERE id = ?`, [JSON.stringify(items), items.length, docId]);
    if (data.cantidad !== undefined) {
      const movId = query(`SELECT id FROM movimientos_inventario WHERE referencia = ? AND producto_id = ? AND tipo = 'entrada'`, [doc.referencia, productId])[0]?.id;
      if (movId) run(`UPDATE movimientos_inventario SET cantidad = ? WHERE id = ?`, [data.cantidad, movId]);
    }
    logAudit(currentUser.id, 'editar_item_documento', `Documento #${doc.referencia}, producto #${productId}`);
    return true;
  });

  ipcMain.handle('inventory:deleteReceiveDocumentItem', (_, docId, productId) => {
    requirePermission('realizar_entradas');
    const doc = query(`SELECT * FROM documentos_entrada WHERE id = ?`, [docId])[0];
    if (!doc) throw new Error('Documento no encontrado');
    const items = doc.items_json ? JSON.parse(doc.items_json) : [];
    const item = items.find(i => i.producto_id === productId);
    if (!item) throw new Error('Producto no encontrado en el documento');
    run(`UPDATE productos SET stock = MAX(0, stock - ?), updated_at = datetime('now','localtime') WHERE id = ?`, [item.cantidad, productId]);
    const newItems = items.filter(i => i.producto_id !== productId);
    run(`UPDATE documentos_entrada SET items_json = ?, total_items = ? WHERE id = ?`, [JSON.stringify(newItems), newItems.length, docId]);
    run(`DELETE FROM movimientos_inventario WHERE referencia = ? AND producto_id = ? AND tipo = 'entrada'`, [doc.referencia, productId]);
    logAudit(currentUser.id, 'eliminar_item_documento', `Documento #${doc.referencia}, producto #${productId}`);
    return true;
  });

  ipcMain.handle('inventory:deleteReceiveDocument', (_, id) => {
    requirePermission('realizar_entradas');
    const doc = query(`SELECT * FROM documentos_entrada WHERE id = ?`, [id])[0];
    if (!doc) throw new Error('Documento no encontrado');
    const items = doc.items_json ? JSON.parse(doc.items_json) : [];
    for (const item of items) {
      const prod = query(`SELECT stock FROM productos WHERE id = ?`, [item.producto_id])[0];
      if (prod) {
        const newStock = Math.max(0, prod.stock - item.cantidad);
        run(`UPDATE productos SET stock = ?, updated_at = datetime('now','localtime') WHERE id = ?`, [newStock, item.producto_id]);
      }
    }
    run(`DELETE FROM movimientos_inventario WHERE referencia = ? AND tipo = 'entrada'`, [doc.referencia]);
    run(`DELETE FROM documentos_entrada WHERE id = ?`, [id]);
    logAudit(currentUser.id, 'eliminar_documento_entrada', `Documento #${doc.referencia} eliminado (${items.length} productos)`);
    return true;
  });

  ipcMain.handle('inventory:getMovements', (_, filters = {}) => {
    let sql = `SELECT m.*, p.nombre as producto_nombre, u.nombre_usuario FROM movimientos_inventario m LEFT JOIN productos p ON m.producto_id = p.id LEFT JOIN usuarios u ON m.usuario_id = u.id WHERE 1=1`;
    const params = [];
    if (filters.producto_id) { sql += ` AND m.producto_id = ?`; params.push(filters.producto_id); }
    if (filters.tipo) { sql += ` AND m.tipo = ?`; params.push(filters.tipo); }
    if (filters.desde) { sql += ` AND m.created_at >= ?`; params.push(filters.desde); }
    if (filters.hasta) { sql += ` AND m.created_at <= ?`; params.push(filters.hasta); }
    sql += ` ORDER BY m.created_at DESC LIMIT 200`;
    return query(sql, params);
  });

  ipcMain.handle('inventory:dashboard', (_, filters = {}) => {
    const totalProductos = query(`SELECT COUNT(*) as cnt, SUM(stock) as total_items, SUM(stock * precio_costo) as valor_total FROM productos WHERE activo = 1`)[0];
    const alertasCount = query(`SELECT COUNT(*) as cnt FROM productos WHERE activo = 1 AND stock <= stock_minimo`)[0].cnt;
    const categorias = query(`SELECT c.nombre, SUM(p.stock * p.precio_costo) as valor, COUNT(p.id) as productos FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id WHERE p.activo = 1 GROUP BY c.nombre ORDER BY valor DESC`);

    const desde = filters.desde || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01 00:00:00`;
    const topProducts = query(`SELECT p.nombre, SUM(vd.cantidad) as total_vendido, SUM(vd.subtotal) as total_ingresos FROM ventas_detalle vd JOIN ventas v ON vd.venta_id = v.id JOIN productos p ON vd.producto_id = p.id WHERE v.anulada = 0 AND v.fecha >= ? GROUP BY vd.producto_id ORDER BY total_vendido DESC LIMIT 10`, [desde]);

    const sinMovimiento = query(`SELECT p.id, p.nombre, p.stock, p.precio_costo, (SELECT MAX(m2.created_at) FROM movimientos_inventario m2 WHERE m2.producto_id = p.id) as ultimo_movimiento FROM productos p WHERE p.activo = 1 HAVING ultimo_movimiento IS NULL OR ultimo_movimiento < datetime('now', '-30 days') ORDER BY ultimo_movimiento ASC`);

    return { totalProductos, alertasCount, categorias, topProducts, sinMovimiento };
  });

  ipcMain.handle('inventory:updateMovement', (_, { id, cantidad, referencia }) => {
    requirePermission('realizar_entradas');
    const old = query(`SELECT * FROM movimientos_inventario WHERE id = ?`, [id])[0];
    if (!old) throw new Error('Movimiento no encontrado');
    if (cantidad !== undefined && cantidad !== old.cantidad) {
      const delta = cantidad - old.cantidad;
      run(`UPDATE productos SET stock = stock + ? WHERE id = ?`, [delta, old.producto_id]);
      run(`UPDATE movimientos_inventario SET cantidad = ?, stock_anterior = stock_anterior + ?, stock_nuevo = stock_nuevo + ? WHERE id = ?`, [cantidad, delta, delta, id]);
    }
    if (referencia !== undefined) {
      run(`UPDATE movimientos_inventario SET referencia = ? WHERE id = ?`, [referencia, id]);
    }
    logAudit(currentUser.id, 'editar_movimiento', `Movimiento #${id} editado`);
    return true;
  });

  ipcMain.handle('inventory:deleteMovement', (_, id) => {
    requirePermission('realizar_entradas');
    const m = query(`SELECT * FROM movimientos_inventario WHERE id = ?`, [id])[0];
    if (!m) throw new Error('Movimiento no encontrado');
    run(`UPDATE productos SET stock = stock - ? WHERE id = ?`, [m.cantidad, m.producto_id]);
    run(`DELETE FROM movimientos_inventario WHERE id = ?`, [id]);
    logAudit(currentUser.id, 'eliminar_movimiento', `Movimiento #${id} eliminado (stock revertido)`);
    return true;
  });

  // ==================== SALES ====================
  ipcMain.handle('sales:create', (_, data) => {
    requirePermission('realizar_ventas');
    let total = 0;
    let descuentoTotal = 0;

    for (const item of data.items) {
      const itemTotal = item.cantidad * item.precio_unitario;
      total += itemTotal - (item.descuento || 0);
      descuentoTotal += (item.descuento || 0);
    }
    const descuentoGlobal = (data.descuento || 0) + (data.cupon_descuento || 0) + (data.combo_descuento || 0);
    total = Math.max(0, total - descuentoGlobal);
    descuentoTotal += descuentoGlobal;

    const userCaja = query(`SELECT caja_id FROM usuarios WHERE id = ?`, [currentUser.id])[0]?.caja_id || null;

    // Determine forma_pago and detalle_pago
    const pagos = data.pagos || [{ tipo: data.forma_pago, monto: total }];
    const formaPago = pagos.length > 1 ? 'mixto' : pagos[0].tipo;
    const detallePago = JSON.stringify(pagos);

    run(`INSERT INTO ventas (total, descuento, forma_pago, detalle_pago, cliente_id, usuario_id, caja_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [total, descuentoTotal, formaPago, detallePago, data.cliente_id || null, currentUser.id, userCaja]);
    const ventaId = getLastInsertId();

    for (const item of data.items) {
      const sub = (item.cantidad * item.precio_unitario) - (item.descuento || 0);
      run(`INSERT INTO ventas_detalle (venta_id, producto_id, nombre_producto, cantidad, precio_unitario, descuento, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [ventaId, item.producto_id || null, item.nombre_producto, item.cantidad, item.precio_unitario, item.descuento || 0, sub]);

      if (item.producto_id) {
        const product = query(`SELECT * FROM productos WHERE id = ?`, [item.producto_id])[0];
        if (product) {
          const stockAnt = product.stock;
          const stockNuevo = normalizeStock(stockAnt - item.cantidad, product.unidad_medida);
          run(`UPDATE productos SET stock = ? WHERE id = ?`, [stockNuevo, item.producto_id]);
          run(`INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, usuario_id, referencia) VALUES (?, 'venta', ?, ?, ?, ?, ?)`,
            [item.producto_id, -item.cantidad, stockAnt, stockNuevo, currentUser.id, `Venta #${ventaId}`]);
        }
      }
    }

    // Update credit if any pagos include credito
    let creditoTotal = 0;
    for (const p of pagos) { if (p.tipo === 'credito') creditoTotal += p.monto; }
    if (creditoTotal > 0 && data.cliente_id) {
      run(`UPDATE clientes SET saldo_pendiente = saldo_pendiente + ? WHERE id = ?`, [creditoTotal, data.cliente_id]);
    }

    // Update cash register if open (by user's caja)
    const userCajaId = userCaja || 1;
    const corte = query(`SELECT id FROM cortes_caja WHERE cerrado = 0 AND caja_id = ? ORDER BY id DESC LIMIT 1`, [userCajaId]);
    if (corte.length > 0) {
      run(`UPDATE cortes_caja SET monto_ventas = monto_ventas + ? WHERE id = ?`, [total, corte[0].id]);
    }

    logAudit(currentUser.id, 'realizar_venta', `Venta #${ventaId} - $${total.toFixed(2)}`);
    return { id: ventaId, total, folio: ventaId, pagos, forma_pago: formaPago };
  });

  ipcMain.handle('sales:getAll', (_, filters = {}) => {
    let sql = `SELECT v.*, c.nombre as cliente_nombre, u.nombre_usuario, u.nombre_completo FROM ventas v LEFT JOIN clientes c ON v.cliente_id = c.id LEFT JOIN usuarios u ON v.usuario_id = u.id WHERE 1=1`;
    const params = [];
    if (filters.desde) { sql += ` AND v.fecha >= ?`; params.push(filters.desde); }
    if (filters.hasta) { sql += ` AND v.fecha <= ?`; params.push(filters.hasta); }
    if (filters.anulada !== undefined) { sql += ` AND v.anulada = ?`; params.push(filters.anulada); }
    if (filters.mis_ventas) { sql += ` AND v.usuario_id = ?`; params.push(currentUser.id); }
    else if (filters.usuario_id) { sql += ` AND v.usuario_id = ?`; params.push(filters.usuario_id); }
    if (filters.caja_id) { sql += ` AND v.caja_id = ?`; params.push(filters.caja_id); }
    sql += ` ORDER BY v.id DESC LIMIT 200`;
    return query(sql, params);
  });

  ipcMain.handle('sales:get', (_, id) => {
    const venta = query(`SELECT v.*, c.nombre as cliente_nombre, u.nombre_usuario FROM ventas v LEFT JOIN clientes c ON v.cliente_id = c.id LEFT JOIN usuarios u ON v.usuario_id = u.id WHERE v.id = ?`, [id]);
    if (venta.length === 0) return null;
    const items = query(`SELECT * FROM ventas_detalle WHERE venta_id = ?`, [id]);
    return { ...venta[0], items };
  });

  ipcMain.handle('sales:void', (_, id, reason) => {
    requirePermission('anular_ventas');
    const venta = query(`SELECT * FROM ventas WHERE id = ?`, [id])[0];
    if (!venta) throw new Error('Venta no encontrada');
    if (venta.anulada) throw new Error('La venta ya está anulada');

    run(`UPDATE ventas SET anulada = 1, motivo_anulacion = ? WHERE id = ?`, [reason, id]);

    // Restore stock
    const items = query(`SELECT * FROM ventas_detalle WHERE venta_id = ?`, [id]);
    for (const item of items) {
      if (item.producto_id) {
        const product = query(`SELECT * FROM productos WHERE id = ?`, [item.producto_id])[0];
        if (product) {
          const stockAnt = product.stock;
          const stockNuevo = normalizeStock(stockAnt + item.cantidad, product.unidad_medida);
          run(`UPDATE productos SET stock = ? WHERE id = ?`, [stockNuevo, item.producto_id]);
          run(`INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, usuario_id, referencia) VALUES (?, 'entrada', ?, ?, ?, ?, ?)`,
            [item.producto_id, item.cantidad, stockAnt, stockNuevo, currentUser.id, `Anulación venta #${id}`]);
        }
      }
    }

    if (venta.cliente_id && (venta.forma_pago === 'credito' || venta.forma_pago === 'mixto')) {
      let creditoTotal = venta.total;
      if (venta.detalle_pago) {
        try {
          const pagos = JSON.parse(venta.detalle_pago);
          creditoTotal = pagos.filter(p => p.tipo === 'credito').reduce((s, p) => s + p.monto, 0);
        } catch (e) { /* keep full total */ }
      }
      run(`UPDATE clientes SET saldo_pendiente = MAX(0, saldo_pendiente - ?) WHERE id = ?`, [creditoTotal, venta.cliente_id]);
    }

    logAudit(currentUser.id, 'anular_venta', `Venta #${id} anulada: ${reason}`, venta);
    return true;
  });

  ipcMain.handle('sales:getToday', () => {
    return query(`SELECT v.*, c.nombre as cliente_nombre, u.nombre_usuario FROM ventas v LEFT JOIN clientes c ON v.cliente_id = c.id LEFT JOIN usuarios u ON v.usuario_id = u.id WHERE date(v.fecha) = date('now','localtime') AND v.anulada = 0 ORDER BY v.id`);
  });

  ipcMain.handle('sales:getSummary', (_, filters = {}) => {
    let sql = `SELECT COUNT(*) as total_ventas, SUM(total) as monto_total, SUM(descuento) as total_descuentos, AVG(total) as ticket_promedio FROM ventas WHERE anulada = 0`;
    const params = [];
    if (filters.desde) { sql += ` AND fecha >= ?`; params.push(filters.desde); }
    if (filters.hasta) { sql += ` AND fecha <= ?`; params.push(filters.hasta); }
    const result = query(sql, params);
    let paySql = `SELECT forma_pago, COUNT(*) as cantidad, SUM(total) as monto FROM ventas WHERE anulada = 0`;
    const payParams = [];
    if (filters.desde) { paySql += ` AND fecha >= ?`; payParams.push(filters.desde); }
    if (filters.hasta) { paySql += ` AND fecha <= ?`; payParams.push(filters.hasta); }
    paySql += ` GROUP BY forma_pago`;
    const byPayment = query(paySql, payParams);
    return { ...result[0], formas_pago: byPayment };
  });

  // ==================== RETURNS ====================
  ipcMain.handle('returns:create', (_, data) => {
    requirePermission('realizar_devoluciones');
    const venta = data.venta_id ? query(`SELECT * FROM ventas WHERE id = ?`, [data.venta_id])[0] : null;
    if (data.venta_id && !venta) throw new Error('Venta no encontrada');

    let total = 0;
    for (const item of data.items) {
      total += item.subtotal;
    }

    run(`INSERT INTO devoluciones (venta_id, total, motivo, usuario_id) VALUES (?, ?, ?, ?)`,
      [data.venta_id || null, total, data.motivo || null, currentUser.id]);
    const devId = getLastInsertId();

    for (const item of data.items) {
      run(`INSERT INTO devoluciones_detalle (devolucion_id, producto_id, nombre_producto, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?)`,
        [devId, item.producto_id || null, item.nombre_producto, item.cantidad, item.precio_unitario, item.subtotal]);

      if (item.producto_id) {
        const product = query(`SELECT * FROM productos WHERE id = ?`, [item.producto_id])[0];
        if (product) {
          const stockAnt = product.stock;
          const stockNuevo = normalizeStock(stockAnt + item.cantidad, product.unidad_medida);
          run(`UPDATE productos SET stock = ? WHERE id = ?`, [stockNuevo, item.producto_id]);
          run(`INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, usuario_id, referencia) VALUES (?, 'entrada', ?, ?, ?, ?, ?)`,
            [item.producto_id, item.cantidad, stockAnt, stockNuevo, currentUser.id, `Devolución #${devId}`]);
        }
      }
    }

    if (venta && venta.forma_pago === 'credito' && venta.cliente_id) {
      run(`UPDATE clientes SET saldo_pendiente = MAX(0, saldo_pendiente - ?) WHERE id = ?`, [total, venta.cliente_id]);
    }

    logAudit(currentUser.id, 'realizar_devolucion', `Devolución #${devId} - $${total.toFixed(2)}`, venta);
    return { id: devId, total };
  });

  ipcMain.handle('returns:getAll', (_, filters = {}) => {
    let sql = `SELECT d.*, v.total as venta_total, u.nombre_usuario FROM devoluciones d LEFT JOIN ventas v ON d.venta_id = v.id LEFT JOIN usuarios u ON d.usuario_id = u.id WHERE 1=1`;
    const params = [];
    if (filters.desde) { sql += ` AND d.fecha >= ?`; params.push(filters.desde); }
    if (filters.hasta) { sql += ` AND d.fecha <= ?`; params.push(filters.hasta); }
    if (filters.mis_devoluciones) { sql += ` AND d.usuario_id = ?`; params.push(currentUser.id); }
    sql += ` ORDER BY d.id DESC LIMIT 200`;
    return query(sql, params);
  });

  ipcMain.handle('returns:get', (_, id) => {
    const dev = query(`SELECT d.*, v.total as venta_total, u.nombre_usuario FROM devoluciones d LEFT JOIN ventas v ON d.venta_id = v.id LEFT JOIN usuarios u ON d.usuario_id = u.id WHERE d.id = ?`, [id]);
    if (dev.length === 0) return null;
    const items = query(`SELECT * FROM devoluciones_detalle WHERE devolucion_id = ?`, [id]);
    return { ...dev[0], items };
  });

  // ==================== CLIENTS ====================
  ipcMain.handle('clients:getAll', (_, filters = {}) => {
    let sql = `SELECT * FROM clientes WHERE 1=1`;
    const params = [];
    if (filters.con_deuda) { sql += ` AND saldo_pendiente > 0`; }
    sql += ` ORDER BY nombre`;
    return query(sql, params);
  });

  ipcMain.handle('clients:get', (_, id) => {
    return query(`SELECT * FROM clientes WHERE id = ?`, [id])[0] || null;
  });

  ipcMain.handle('clients:create', (_, data) => {
    run(`INSERT INTO clientes (nombre, telefono, correo, direccion) VALUES (?, ?, ?, ?)`, [data.nombre, data.telefono || null, data.correo || null, data.direccion || null]);
    return { id: getLastInsertId(), ...data };
  });

  ipcMain.handle('clients:update', (_, id, data) => {
    run(`UPDATE clientes SET nombre=?, telefono=?, correo=?, direccion=? WHERE id=?`, [data.nombre, data.telefono, data.correo, data.direccion, id]);
    return true;
  });

  ipcMain.handle('clients:search', (_, q) => {
    const search = `%${q}%`;
    return query(`SELECT * FROM clientes WHERE nombre LIKE ? OR telefono LIKE ? ORDER BY nombre LIMIT 20`, [search, search]);
  });

  ipcMain.handle('clients:getDebt', (_, id) => {
    const client = query(`SELECT * FROM clientes WHERE id = ?`, [id])[0];
    if (!client) throw new Error('Cliente no encontrado');
    const ventas = query(`SELECT v.id, v.fecha, v.total, v.created_at FROM ventas v WHERE v.cliente_id = ? AND v.anulada = 0 AND v.forma_pago = 'credito' ORDER BY v.fecha`, [id]);
    const abonos = query(`SELECT * FROM abonos WHERE cliente_id = ? ORDER BY created_at`, [id]);
    return { client, ventas, abonos };
  });

  ipcMain.handle('clients:registerPayment', (_, data) => {
    requirePermission('cobrar_deudas');
    run(`INSERT INTO abonos (cliente_id, venta_id, monto, usuario_id) VALUES (?, ?, ?, ?)`, [data.cliente_id, data.venta_id || null, data.monto, currentUser.id]);
    run(`UPDATE clientes SET saldo_pendiente = MAX(0, saldo_pendiente - ?) WHERE id = ?`, [data.monto, data.cliente_id]);
    logAudit(currentUser.id, 'registrar_abono', `Abono de $${data.monto} - Cliente ID: ${data.cliente_id}`);
    return true;
  });

  // ==================== CASH REGISTER ====================
  ipcMain.handle('caja:open', (_, data) => {
    requirePermission('corte_caja');
    const cajaId = data.caja_id || 1;
    run(`INSERT INTO cortes_caja (monto_inicial, usuario_id, caja_id) VALUES (?, ?, ?)`, [data.monto_inicial, currentUser.id, cajaId]);
    logAudit(currentUser.id, 'abrir_caja', `Caja ${cajaId} abierta con $${data.monto_inicial}`);
    return { id: getLastInsertId() };
  });

  ipcMain.handle('caja:close', (_, data) => {
    requirePermission('corte_caja');
    const corte = query(`SELECT * FROM cortes_caja WHERE id = ?`, [data.id])[0];
    if (!corte) throw new Error('Corte no encontrado');
    const ventasHoy = query(`SELECT COALESCE(SUM(total),0) as total FROM ventas WHERE date(fecha) = date('now','localtime') AND anulada = 0 AND caja_id = ?`, [corte.caja_id || 1])[0].total;
    const totalEsperado = corte.monto_inicial + ventasHoy;
    const reporteJson = data.reporte_json ? JSON.stringify(data.reporte_json) : null;
    run(`UPDATE cortes_caja SET fecha_cierre = datetime('now','localtime'), monto_ventas = ?, monto_final = ?, cerrado = 1, observaciones = ?, reporte_json = ? WHERE id = ?`,
      [ventasHoy, data.monto_final, data.observaciones || null, reporteJson, data.id]);
    logAudit(currentUser.id, 'cerrar_caja', `Caja cerrada. Esperado: $${totalEsperado.toFixed(2)}, Real: $${data.monto_final.toFixed(2)}`);
    return { total_esperado: totalEsperado, diferencia: data.monto_final - totalEsperado };
  });

  ipcMain.handle('caja:status', (_, filters = {}) => {
    const cajaId = filters.caja_id || null;
    let sql = `SELECT cc.*, u.nombre_usuario, u.nombre_completo FROM cortes_caja cc LEFT JOIN usuarios u ON cc.usuario_id = u.id WHERE cc.cerrado = 0`;
    const params = [];
    if (cajaId) { sql += ` AND cc.caja_id = ?`; params.push(cajaId); }
    sql += ` ORDER BY cc.id DESC LIMIT 1`;
    const result = query(sql, params);
    return result[0] || null;
  });

  ipcMain.handle('caja:history', (_, filters = {}) => {
    let sql = `SELECT cc.*, u.nombre_usuario, u.nombre_completo, c.nombre as caja_nombre FROM cortes_caja cc LEFT JOIN usuarios u ON cc.usuario_id = u.id LEFT JOIN cajas c ON cc.caja_id = c.id WHERE 1=1`;
    const params = [];
    if (filters.desde) { sql += ` AND cc.fecha_apertura >= ?`; params.push(filters.desde); }
    if (filters.hasta) { sql += ` AND cc.fecha_apertura <= ?`; params.push(filters.hasta); }
    if (filters.caja_id) { sql += ` AND cc.caja_id = ?`; params.push(filters.caja_id); }
    sql += ` ORDER BY cc.id DESC LIMIT 50`;
    const rows = query(sql, params);
    return rows.map(r => ({ ...r, reporte_json: r.reporte_json ? JSON.parse(r.reporte_json) : null }));
  });

  ipcMain.handle('cajas:getStatus', (_, cajaId) => {
    const result = query(`SELECT cc.*, u.nombre_usuario, u.nombre_completo FROM cortes_caja cc LEFT JOIN usuarios u ON cc.usuario_id = u.id WHERE cc.caja_id = ? AND cc.cerrado = 0 ORDER BY cc.id DESC LIMIT 1`, [cajaId]);
    return result[0] || null;
  });

  // ==================== REPORTS ====================
  ipcMain.handle('reports:daily', (_, date) => {
    const d = date || new Date().toISOString().split('T')[0];
    const summary = query(`SELECT COUNT(*) as total_ventas, SUM(total) as monto_total, SUM(descuento) as descuentos FROM ventas WHERE date(fecha) = ? AND anulada = 0`, [d])[0];
    const byPayment = query(`SELECT forma_pago, COUNT(*) as cantidad, SUM(total) as monto FROM ventas WHERE date(fecha) = ? AND anulada = 0 GROUP BY forma_pago`, [d]);
    const topProducts = query(`SELECT vd.nombre_producto, SUM(vd.cantidad) as cantidad, SUM(vd.subtotal) as total FROM ventas_detalle vd JOIN ventas v ON vd.venta_id = v.id WHERE date(v.fecha) = ? AND v.anulada = 0 GROUP BY vd.nombre_producto ORDER BY cantidad DESC LIMIT 10`, [d]);
    return { fecha: d, summary, formas_pago: byPayment, top_productos: topProducts };
  });

  ipcMain.handle('reports:topProducts', (_, filters = {}) => {
    let sql = `SELECT vd.nombre_producto, p.codigo_barras, SUM(vd.cantidad) as cantidad, SUM(vd.subtotal) as total, AVG(vd.precio_unitario) as precio_promedio FROM ventas_detalle vd JOIN ventas v ON vd.venta_id = v.id LEFT JOIN productos p ON vd.producto_id = p.id WHERE v.anulada = 0`;
    const params = [];
    if (filters.desde) { sql += ` AND v.fecha >= ?`; params.push(filters.desde); }
    if (filters.hasta) { sql += ` AND v.fecha <= ?`; params.push(filters.hasta); }
    sql += ` GROUP BY vd.nombre_producto ORDER BY cantidad DESC LIMIT 20`;
    return query(sql, params);
  });

  ipcMain.handle('reports:profit', (_, filters = {}) => {
    const ventaParams = [];
    let ventaWhere = `WHERE anulada = 0`;
    if (filters.desde) { ventaWhere += ` AND fecha >= ?`; ventaParams.push(filters.desde); }
    if (filters.hasta) { ventaWhere += ` AND fecha <= ?`; ventaParams.push(filters.hasta); }
    const ingresos = query(`SELECT COALESCE(SUM(total),0) as v FROM ventas ${ventaWhere}`, ventaParams)[0].v;
    let bySql = `SELECT vd.nombre_producto, SUM(vd.cantidad) as cantidad, SUM(vd.subtotal) as ventas, COALESCE(SUM(vd.cantidad * p.precio_costo),0) as costo, SUM(vd.subtotal) - COALESCE(SUM(vd.cantidad * p.precio_costo),0) as ganancia FROM ventas_detalle vd JOIN ventas v ON vd.venta_id = v.id LEFT JOIN productos p ON vd.producto_id = p.id WHERE v.anulada = 0`;
    const byParams = [];
    if (filters.desde) { bySql += ` AND v.fecha >= ?`; byParams.push(filters.desde); }
    if (filters.hasta) { bySql += ` AND v.fecha <= ?`; byParams.push(filters.hasta); }
    bySql += ` GROUP BY vd.nombre_producto ORDER BY ganancia DESC LIMIT 20`;
    const byProduct = query(bySql, byParams);
    const costo_total = byProduct.reduce((s, p) => s + (p.costo || 0), 0);
    return { summary: { ingresos, costo_total, ganancia: ingresos - costo_total }, productos: byProduct };
  });

  ipcMain.handle('reports:auditLog', (_, filters = {}) => {
    let sql = `SELECT a.*, u.nombre_usuario FROM auditoria a LEFT JOIN usuarios u ON a.usuario_id = u.id WHERE 1=1`;
    const params = [];
    if (filters.usuario_id) { sql += ` AND a.usuario_id = ?`; params.push(filters.usuario_id); }
    if (filters.accion) { sql += ` AND a.accion = ?`; params.push(filters.accion); }
    if (filters.desde) { sql += ` AND a.created_at >= ?`; params.push(filters.desde); }
    if (filters.hasta) { sql += ` AND a.created_at <= ?`; params.push(filters.hasta); }
    sql += ` ORDER BY a.id DESC LIMIT 200`;
    return query(sql, params);
  });

  // ==================== CAJAS (MULTI-CAJA) ====================
  ipcMain.handle('cajas:list', () => {
    return query(`SELECT * FROM cajas WHERE activa = 1 ORDER BY id`);
  });

  ipcMain.handle('cajas:create', (_, data) => {
    requirePermission('corte_caja');
    const { max_cajas } = planInfo();
    const existing = query(`SELECT COUNT(*) as cnt FROM cajas WHERE activa = 1`)[0].cnt;
    if (existing >= max_cajas) throw new Error(`Límite de cajas alcanzado (${max_cajas}). Su plan ${planInfo().plan === 'pro' ? 'Pro' : 'Básica'} permite hasta ${max_cajas}.`);
    run(`INSERT INTO cajas (nombre) VALUES (?)`, [data.nombre]);
    logAudit(currentUser.id, 'crear_caja', `Caja creada: ${data.nombre}`);
    return { id: getLastInsertId() };
  });

  ipcMain.handle('cajas:update', (_, data) => {
    requirePermission('corte_caja');
    run(`UPDATE cajas SET nombre = ? WHERE id = ?`, [data.nombre, data.id]);
    return true;
  });

  ipcMain.handle('cajas:delete', (_, id) => {
    requirePermission('corte_caja');
    run(`UPDATE cajas SET activa = 0 WHERE id = ?`, [id]);
    return true;
  });

  // ==================== SESIONES CAJA ====================
  ipcMain.handle('sesiones:start', (_, data) => {
    const active = query(`SELECT id FROM sesiones_caja WHERE caja_id = ? AND activa = 1`, [data.caja_id]);
    if (active.length > 0) throw new Error('Esta caja ya tiene un cajero asignado');
    run(`INSERT INTO sesiones_caja (caja_id, usuario_id) VALUES (?, ?)`, [data.caja_id, data.usuario_id]);
    const id = getLastInsertId();
    currentSessionId = id;
    logAudit(data.usuario_id, 'iniciar_sesion_caja', `Cajero inició sesión en caja ID ${data.caja_id}`);
    return { id };
  });

  ipcMain.handle('sesiones:end', (_, data) => {
    run(`UPDATE sesiones_caja SET activa = 0, fin = datetime('now','localtime') WHERE id = ?`, [data.sesion_id]);
    if (currentSessionId === data.sesion_id) currentSessionId = null;
    logAudit(currentUser?.id || 0, 'cerrar_sesion_caja', `Sesión de caja #${data.sesion_id} cerrada`);
    return true;
  });

  ipcMain.handle('sesiones:endByUser', (_, data) => {
    run(`UPDATE sesiones_caja SET activa = 0, fin = datetime('now','localtime') WHERE usuario_id = ? AND activa = 1`, [data.usuario_id]);
    logAudit(currentUser?.id || 0, 'cerrar_sesion_caja', `Sesiones cerradas para usuario ID ${data.usuario_id}`);
    return true;
  });

  ipcMain.handle('sesiones:getAvailable', () => {
    return query(`
      SELECT c.* FROM cajas c
      WHERE c.activa = 1
      AND c.id NOT IN (SELECT caja_id FROM sesiones_caja WHERE activa = 1)
      ORDER BY c.id
    `);
  });

  ipcMain.handle('sesiones:getActive', (_, cajaId) => {
    const result = query(`SELECT s.*, u.nombre_usuario, u.nombre_completo FROM sesiones_caja s JOIN usuarios u ON s.usuario_id = u.id WHERE s.caja_id = ? AND s.activa = 1 ORDER BY s.id DESC LIMIT 1`, [cajaId]);
    return result[0] || null;
  });

  ipcMain.handle('sesiones:allActive', () => {
    return query(`
      SELECT s.*, u.nombre_usuario, u.nombre_completo, c.nombre as caja_nombre
      FROM sesiones_caja s
      JOIN usuarios u ON s.usuario_id = u.id
      JOIN cajas c ON s.caja_id = c.id
      WHERE s.activa = 1
      ORDER BY s.id DESC
    `);
  });

  ipcMain.handle('cajas:metrics', () => {
    const perCaja = query(`
      SELECT c.id, c.nombre,
        CASE WHEN cc.id IS NOT NULL THEN 1 ELSE 0 END as abierta, cc.monto_inicial, cc.monto_ventas,
        (SELECT COUNT(*) FROM ventas v WHERE v.caja_id = c.id AND v.anulada = 0) as total_ventas,
        (SELECT COALESCE(SUM(v.total),0) FROM ventas v WHERE v.caja_id = c.id AND v.anulada = 0) as ingresos,
        (SELECT COUNT(*) FROM sesiones_caja s WHERE s.caja_id = c.id) as total_sesiones
      FROM cajas c
      LEFT JOIN cortes_caja cc ON cc.caja_id = c.id AND cc.cerrado = 0
      WHERE c.activa = 1
      ORDER BY c.id
    `);
    const perCajero = query(`
      SELECT u.id, u.nombre_completo, u.nombre_usuario, u.rol,
        COUNT(v.id) as total_ventas,
        COALESCE(SUM(v.total),0) as ingresos,
        CASE WHEN COUNT(v.id) > 0 THEN COALESCE(SUM(v.total),0) / COUNT(v.id) ELSE 0 END as ticket_promedio,
        u.caja_id,
        (SELECT c.nombre FROM cajas c WHERE c.id = u.caja_id) as caja_nombre,
        (SELECT COUNT(*) FROM sesiones_caja s WHERE s.usuario_id = u.id) as total_sesiones
      FROM usuarios u
      LEFT JOIN ventas v ON v.usuario_id = u.id AND v.anulada = 0
      WHERE u.activo = 1
      GROUP BY u.id ORDER BY ingresos DESC
    `);
    const sesionesActivas = query(`
      SELECT s.*, u.nombre_usuario, u.nombre_completo, c.nombre as caja_nombre
      FROM sesiones_caja s
      JOIN usuarios u ON s.usuario_id = u.id
      JOIN cajas c ON s.caja_id = c.id
      WHERE s.activa = 1
      ORDER BY s.inicio DESC
    `);
    return { perCaja, perCajero, sesionesActivas };
  });

  ipcMain.handle('cajas:getAllWithStatus', () => {
    const cajas = query(`SELECT * FROM cajas WHERE activa = 1 ORDER BY id`);
    return cajas.map(c => {
      const corte = query(`SELECT cc.*, u.nombre_completo as abierto_por FROM cortes_caja cc LEFT JOIN usuarios u ON u.id = cc.usuario_id WHERE cc.caja_id = ? AND cc.cerrado = 0 ORDER BY cc.id DESC LIMIT 1`, [c.id])[0] || null;
      const sesiones = query(`SELECT s.*, u.nombre_usuario, u.nombre_completo FROM sesiones_caja s JOIN usuarios u ON u.id = s.usuario_id WHERE s.caja_id = ? AND s.activa = 1`, [c.id]);
      return { ...c, abierta: !!corte, corte, sesiones, sesiones_count: sesiones.length };
    });
  });

  ipcMain.handle('sesiones:join', (_, data) => {
    const currentSesion = query(`SELECT id FROM sesiones_caja WHERE usuario_id = ? AND activa = 1`, [currentUser.id]);
    if (currentSesion.length > 0) throw new Error('Ya tiene una sesión activa en otra caja');
    run(`INSERT INTO sesiones_caja (caja_id, usuario_id) VALUES (?, ?)`, [data.caja_id, currentUser.id]);
    const id = getLastInsertId();
    currentSessionId = id;
    logAudit(currentUser.id, 'unirse_caja', `Usuario se unió a caja ID ${data.caja_id}`);
    return { id };
  });

  // ==================== VERSION CONFIG ====================
  ipcMain.handle('config:getVersion', () => {
    return planInfo().plan;
  });

  ipcMain.handle('config:setVersion', () => {
    throw new Error('La versión se define según la licencia activada');
  });

  ipcMain.handle('config:getMaxCajas', () => {
    return planInfo().max_cajas;
  });

  // ==================== PRINTER ====================
  ipcMain.handle('printer:getPrinters', () => {
    return ['Impresora Térmica (predeterminada)'];
  });

  ipcMain.handle('printer:printTicket', (_, data) => {
    const lines = [];

    if (data.lines) {
      lines.push(...data.lines);
    } else if (data.test) {
      lines.push('= TEST DE IMPRESIÓN =');
      lines.push('Impresora configurada correctamente');
      lines.push(`Nombre: ${data.printer || '(predeterminada)'}`);
      lines.push('======================');
    } else {
      const empresa = query(`SELECT valor FROM configuracion WHERE clave = 'empresa_nombre'`)[0]?.valor || 'Mi Tienda';
      const pie = query(`SELECT valor FROM configuracion WHERE clave = 'ticket_pie'`)[0]?.valor || 'Gracias por su compra';

      lines.push(empresa.padStart(32));
      lines.push('='.repeat(32));
      lines.push(`Folio: ${data.id}`);
      lines.push(`Fecha: ${data.fecha}`);
      lines.push(`Cajero: ${data.usuario}`);
      lines.push('-'.repeat(32));
      lines.push('PRODUCTO        CANT   PRECIO  TOTAL');

      if (data.items) {
        for (const item of data.items) {
          const nombre = item.nombre_producto.substring(0, 14).padEnd(14);
          const cant = String(item.cantidad).padStart(4);
          const precio = `$${item.precio_unitario.toFixed(2)}`.padStart(6);
          const total = `$${item.subtotal.toFixed(2)}`.padStart(6);
          lines.push(`${nombre}  ${cant}  ${precio}  ${total}`);
        }
      }

      lines.push('-'.repeat(32));
      lines.push(`SUBTOTAL:`.padEnd(24) + `$${data.total.toFixed(2)}`.padStart(8));
      if (data.descuento > 0) lines.push(`DESCUENTO:`.padEnd(24) + `-$${data.descuento.toFixed(2)}`.padStart(8));
      lines.push(`TOTAL:`.padEnd(24) + `$${data.total.toFixed(2)}`.padStart(8));
      if (data.pagos && data.pagos.length > 1) {
        lines.push('FORMAS DE PAGO:');
        for (const p of data.pagos) {
          lines.push(`  ${p.tipo.toUpperCase()}: $${p.monto.toFixed(2)}`.padStart(24));
        }
      } else {
        lines.push(`FORMA DE PAGO: ${data.forma_pago}`);
      }
      lines.push('='.repeat(32));
      lines.push(pie.padStart(32));
      lines.push('');
      lines.push('');
    }

    console.log('=== TICKET ===');
    console.log(lines.join('\n'));
    console.log('==============');

    return lines.join('\n');
  });

  // ==================== SII / DTE ====================
  ipcMain.handle('sii:getConfig', () => {
    const enabled = query(`SELECT valor FROM configuracion WHERE clave = 'sii_enabled'`)[0]?.valor === 'true';
    const proveedor = query(`SELECT valor FROM configuracion WHERE clave = 'sii_proveedor'`)[0]?.valor || 'tango';
    const api_key = query(`SELECT valor FROM configuracion WHERE clave = 'sii_api_key'`)[0]?.valor || '';
    const rut_empresa = query(`SELECT valor FROM configuracion WHERE clave = 'sii_rut_empresa'`)[0]?.valor || '';
    const razon_social = query(`SELECT valor FROM configuracion WHERE clave = 'sii_razon_social'`)[0]?.valor || '';
    const giro = query(`SELECT valor FROM configuracion WHERE clave = 'sii_giro'`)[0]?.valor || '';
    const direccion_sii = query(`SELECT valor FROM configuracion WHERE clave = 'sii_direccion'`)[0]?.valor || '';
    const comuna = query(`SELECT valor FROM configuracion WHERE clave = 'sii_comuna'`)[0]?.valor || '';
    const resolvedor = query(`SELECT valor FROM configuracion WHERE clave = 'sii_resolvedor'`)[0]?.valor || 'sii';
    const printer = query(`SELECT valor FROM configuracion WHERE clave = 'sii_printer'`)[0]?.valor || '';
    const auto_print = query(`SELECT valor FROM configuracion WHERE clave = 'sii_auto_print'`)[0]?.valor !== 'false';
    return { enabled: enabled === true, proveedor, api_key, rut_empresa, razon_social, giro, direccion_sii, comuna, resolvedor, printer, auto_print };
  });

  ipcMain.handle('sii:setConfig', (_, config) => {
    if (config.enabled !== undefined) run(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('sii_enabled', ?)`, [String(config.enabled)]);
    if (config.proveedor !== undefined) run(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('sii_proveedor', ?)`, [config.proveedor]);
    if (config.api_key !== undefined) run(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('sii_api_key', ?)`, [config.api_key]);
    if (config.rut_empresa !== undefined) run(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('sii_rut_empresa', ?)`, [config.rut_empresa]);
    if (config.razon_social !== undefined) run(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('sii_razon_social', ?)`, [config.razon_social]);
    if (config.giro !== undefined) run(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('sii_giro', ?)`, [config.giro]);
    if (config.direccion_sii !== undefined) run(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('sii_direccion', ?)`, [config.direccion_sii]);
    if (config.comuna !== undefined) run(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('sii_comuna', ?)`, [config.comuna]);
    if (config.resolvedor !== undefined) run(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('sii_resolvedor', ?)`, [config.resolvedor]);
    if (config.printer !== undefined) run(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('sii_printer', ?)`, [config.printer]);
    if (config.auto_print !== undefined) run(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('sii_auto_print', ?)`, [String(config.auto_print)]);
    return true;
  });

  // ==================== SCALE ====================
  ipcMain.handle('scale:read', () => {
    return { weight: 0, unit: 'kg', connected: false, message: 'Báscula no conectada (simulación)' };
  });

  ipcMain.handle('scale:configure', (_, config) => {
    run(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('scale_port', ?)`, [config.port || 'COM1']);
    run(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('scale_protocol', ?)`, [config.protocol || 'rs232']);
    return true;
  });

  ipcMain.handle('scale:getConfig', () => {
    const port = query(`SELECT valor FROM configuracion WHERE clave = 'scale_port'`)[0]?.valor || 'COM1';
    const protocol = query(`SELECT valor FROM configuracion WHERE clave = 'scale_protocol'`)[0]?.valor || 'rs232';
    return { port, protocol };
  });

  // ==================== BOLETAS ====================
  ipcMain.handle('boletas:getAll', () => {
    const rows = query(`SELECT * FROM boletas_emitidas ORDER BY created_at DESC`);
    return rows;
  });

  ipcMain.handle('boletas:register', (_, data) => {
    const folio = (query(`SELECT MAX(folio) as max FROM boletas_emitidas`)[0]?.max || 0) + 1;
    run(`INSERT INTO boletas_emitidas (folio, tipo_dte, total, rut_cliente, razon_social_cliente, xml_response, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [folio, data.tipo_dte || '39', data.total || 0, data.rut_cliente || '', data.razon_social_cliente || '', data.xml_response || '', new Date().toISOString()]);
    const inserted = query(`SELECT * FROM boletas_emitidas ORDER BY id DESC LIMIT 1`)[0];
    return inserted;
  });

  ipcMain.handle('printer:getConfig', () => {
    const enabledRow = query(`SELECT valor FROM configuracion WHERE clave = 'printer_enabled'`)[0];
    const enabled = enabledRow ? enabledRow.valor === 'true' : true;
    const printer = query(`SELECT valor FROM configuracion WHERE clave = 'printer_name'`)[0]?.valor || '';
    const auto_print = query(`SELECT valor FROM configuracion WHERE clave = 'printer_auto_print'`)[0]?.valor !== 'false';
    return { enabled, printer, auto_print };
  });

  ipcMain.handle('printer:setConfig', (_, config) => {
    if (config.enabled !== undefined) run(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('printer_enabled', ?)`, [String(config.enabled)]);
    if (config.printer !== undefined) run(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('printer_name', ?)`, [config.printer]);
    if (config.auto_print !== undefined) run(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('printer_auto_print', ?)`, [String(config.auto_print)]);
    return true;
  });

  // ==================== APP INFO ====================
  ipcMain.handle('app:getInfo', () => {
    return { version: '1.0.0', name: 'Nexbit POS', platform: process.platform };
  });

  ipcMain.handle('sesiones:getCurrent', () => {
    if (!currentUser) return null;
    const result = query(`SELECT s.*, c.nombre as caja_nombre FROM sesiones_caja s JOIN cajas c ON s.caja_id = c.id WHERE s.usuario_id = ? AND s.activa = 1 ORDER BY s.id DESC LIMIT 1`, [currentUser.id]);
    return result[0] || null;
  });
}

function getCurrentSessionId() {
  return currentSessionId;
}

function getCurrentUserId() {
  return currentUser?.id || null;
}

function endCurrentSession() {
  if (!currentSessionId) return false;
  run(`UPDATE sesiones_caja SET activa = 0, fin = datetime('now','localtime') WHERE id = ?`, [currentSessionId]);
  logAudit(currentUser?.id || 0, 'cierre_app', 'Sesión cerrada al cerrar la aplicación');
  currentSessionId = null;
  return true;
}

  // ==================== PROMOCIONES Y CUPONES ====================
  ipcMain.handle('cupones:getAll', () => query(`SELECT * FROM cupones ORDER BY id DESC`));
  ipcMain.handle('cupones:create', (_, data) => {
    run(`INSERT INTO cupones (codigo, tipo, valor, min_compra, vigencia_desde, vigencia_hasta, usos_maximos, tipo_aplicacion, producto_id, categoria_id, productos_ids) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.codigo, data.tipo, data.valor, data.min_compra || 0, data.vigencia_desde || null, data.vigencia_hasta || null, data.usos_maximos || 0, data.tipo_aplicacion || 'todos', data.producto_id || null, data.categoria_id || null, data.productos_ids ? JSON.stringify(data.productos_ids) : null]);
    return { id: getLastInsertId() };
  });
  ipcMain.handle('cupones:update', (_, data) => {
    run(`UPDATE cupones SET codigo=?, tipo=?, valor=?, min_compra=?, vigencia_desde=?, vigencia_hasta=?, usos_maximos=?, activo=?, tipo_aplicacion=?, producto_id=?, categoria_id=?, productos_ids=? WHERE id=?`,
      [data.codigo, data.tipo, data.valor, data.min_compra || 0, data.vigencia_desde || null, data.vigencia_hasta || null, data.usos_maximos || 0, data.activo, data.tipo_aplicacion || 'todos', data.producto_id || null, data.categoria_id || null, data.productos_ids ? JSON.stringify(data.productos_ids) : null, data.id]);
    return true;
  });
  ipcMain.handle('cupones:delete', (_, id) => { run(`DELETE FROM cupones WHERE id=?`, [id]); return true; });
  ipcMain.handle('cupones:usar', (_, codigo) => {
    const cupon = query(`SELECT * FROM cupones WHERE codigo=? AND activo=1`, [codigo])[0];
    if (!cupon) throw new Error('Cupón no encontrado o inactivo');
    if (cupon.usos_maximos > 0 && cupon.usos_actuales >= cupon.usos_maximos) throw new Error('Cupón agotado');
    run(`UPDATE cupones SET usos_actuales = usos_actuales + 1 WHERE id=?`, [cupon.id]);
    const parsed = { ...cupon, productos_ids: cupon.productos_ids ? JSON.parse(cupon.productos_ids) : null };
    return parsed;
  });

  ipcMain.handle('descuentos:getAll', () => {
    const items = query(`SELECT d.*, p.nombre as producto_nombre, p.codigo_barras FROM descuentos_cantidad d LEFT JOIN productos p ON d.producto_id = p.id ORDER BY d.id DESC`);
    return items.map(d => ({ ...d, reglas: JSON.parse(d.reglas || '[]') }));
  });
  ipcMain.handle('descuentos:create', (_, data) => {
    run(`INSERT INTO descuentos_cantidad (producto_id, reglas, tipo) VALUES (?, ?, ?)`, [data.producto_id, JSON.stringify(data.reglas), data.tipo || 'precio_fijo']);
    return { id: getLastInsertId() };
  });
  ipcMain.handle('descuentos:update', (_, data) => {
    run(`UPDATE descuentos_cantidad SET producto_id=?, reglas=?, activo=?, tipo=? WHERE id=?`, [data.producto_id, JSON.stringify(data.reglas), data.activo, data.tipo || 'precio_fijo', data.id]);
    return true;
  });
  ipcMain.handle('descuentos:delete', (_, id) => { run(`DELETE FROM descuentos_cantidad WHERE id=?`, [id]); return true; });
  ipcMain.handle('descuentos:getByProducto', (_, productoId) => {
    const d = query(`SELECT * FROM descuentos_cantidad WHERE producto_id=? AND activo=1 ORDER BY id DESC LIMIT 1`, [productoId])[0];
    return d ? { ...d, reglas: JSON.parse(d.reglas || '[]') } : null;
  });

  ipcMain.handle('products:getPromoted', () => {
    return query(`SELECT * FROM productos WHERE en_promocion = 1 AND activo = 1 ORDER BY nombre`);
  });
  ipcMain.handle('products:setPromotion', (_, data) => {
    run(`UPDATE productos SET en_promocion = ?, precio_promo = ? WHERE id = ?`, [data.activo ? 1 : 0, data.precio_promo || null, data.producto_id]);
    return true;
  });

  ipcMain.handle('grupos:getAll', () => {
    const grupos = query(`SELECT * FROM grupos ORDER BY nombre`);
    return grupos.map(g => ({
      ...g,
      items: query(`SELECT gd.producto_id, gd.cantidad, p.nombre as nombre_producto, p.precio_venta FROM grupo_detalles gd LEFT JOIN productos p ON gd.producto_id = p.id WHERE gd.grupo_id = ?`, [g.id]),
    }));
  });
  ipcMain.handle('grupos:create', (_, data) => {
    run(`INSERT INTO grupos (nombre, precio, activo) VALUES (?, ?, ?)`, [data.nombre, data.precio, data.activo ?? 1]);
    const id = getLastInsertId();
    for (const it of data.items || []) {
      if (it.producto_id) run(`INSERT INTO grupo_detalles (grupo_id, producto_id, cantidad) VALUES (?, ?, ?)`, [id, it.producto_id, it.cantidad || 1]);
    }
    return { id };
  });
  ipcMain.handle('grupos:update', (_, data) => {
    run(`UPDATE grupos SET nombre = ?, precio = ?, activo = ? WHERE id = ?`, [data.nombre, data.precio, data.activo ?? 1, data.id]);
    run(`DELETE FROM grupo_detalles WHERE grupo_id = ?`, [data.id]);
    for (const it of data.items || []) {
      if (it.producto_id) run(`INSERT INTO grupo_detalles (grupo_id, producto_id, cantidad) VALUES (?, ?, ?)`, [data.id, it.producto_id, it.cantidad || 1]);
    }
    return true;
  });
  ipcMain.handle('grupos:delete', (_, id) => {
    run(`DELETE FROM grupo_detalles WHERE grupo_id = ?`, [id]);
    run(`DELETE FROM grupos WHERE id = ?`, [id]);
    return true;
  });

const ALL_PERMISSIONS = [
  'realizar_ventas', 'anular_ventas', 'aplicar_descuentos',
  'corte_caja', 'gestionar_productos', 'realizar_entradas',
  'ajustar_stock', 'ver_reportes', 'gestionar_usuarios',
  'cobrar_deudas', 'ver_auditoria', 'realizar_devoluciones',
];

function getDefaultPermissions(rol) {
  switch (rol) {
    case 'admin':
      return Object.fromEntries(ALL_PERMISSIONS.map(p => [p, true]));
    case 'gerente':
      return { realizar_ventas: true, anular_ventas: true, aplicar_descuentos: true, corte_caja: true, gestionar_productos: true, realizar_entradas: true, ajustar_stock: true, ver_reportes: true, cobrar_deudas: true, gestionar_usuarios: false, ver_auditoria: true, realizar_devoluciones: true };
    case 'cajero':
    default:
      return { realizar_ventas: true, anular_ventas: false, aplicar_descuentos: false, corte_caja: false, gestionar_productos: false, realizar_entradas: false, ajustar_stock: false, ver_reportes: false, cobrar_deudas: false, gestionar_usuarios: false, ver_auditoria: false, realizar_devoluciones: false };
  }
}

module.exports = { registerIpcHandlers, getCurrentSessionId, getCurrentUserId, endCurrentSession };
