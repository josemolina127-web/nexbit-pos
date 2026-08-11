const mockUsers = [
  { id: 1, nombre_usuario: 'admin', nombre_completo: 'Admin Principal', rol: 'admin', password: 'admin123' },
  { id: 2, nombre_usuario: 'gerente', nombre_completo: 'Gerente General', rol: 'gerente', password: 'gerente123' },
  { id: 3, nombre_usuario: 'cajero', nombre_completo: 'Cajero Ventas', rol: 'cajero', password: 'cajero123' },
];

let currentUser = null;
let mockVersion = 'basic';
let mockSiiConfig = { enabled: false, proveedor: 'tango', api_key: '', rut_empresa: '', razon_social: '', giro: '', direccion_sii: '', comuna: '', resolvedor: 'sii', printer: '', auto_print: true };
let mockPrinterConfig = { enabled: true, printer: '', auto_print: true };
let mockBoletasEmitidas = [];
let mockCajas = [
  { id: 1, nombre: 'Caja Principal', activa: 1, created_at: '2026-07-25' },
];
let mockCortes = [];
let mockSessions = [];
let mockCupones = [
  { id: 1, codigo: 'BIENVENIDA10', tipo: 'porcentaje', valor: 10, min_compra: 0, vigencia_desde: null, vigencia_hasta: null, usos_maximos: 0, usos_actuales: 0, activo: 1 },
  { id: 2, codigo: 'DESCUENTO500', tipo: 'monto', valor: 500, min_compra: 5000, vigencia_desde: null, vigencia_hasta: null, usos_maximos: 0, usos_actuales: 0, activo: 1 },
];
let mockDescuentosCantidad = [];
let mockGrupos = [
  { id: 1, nombre: 'Aceite + Arroz', precio: 60, activo: 1, items: [{ producto_id: 3, cantidad: 1, nombre_producto: 'Aceite 900ml', precio_venta: 45 }, { producto_id: 1, cantidad: 1, nombre_producto: 'Arroz 1kg', precio_venta: 25 }] },
];
let mockProducts = [
  { id: 1, codigo_barras: '7501000100101', nombre: 'Arroz 1kg', precio_venta: 25, precio_costo: 18, stock: 120, stock_minimo: 20, categoria_id: 2, categoria_nombre: 'Abarrotes', proveedor_id: 1, proveedor_nombre: 'Distribuidora Alimentos', unidad_medida: 'pieza', activo: 1, en_promocion: 1, precio_promo: 20 },
  { id: 2, codigo_barras: '7501000200202', nombre: 'Leche 1L', precio_venta: 22, precio_costo: 16, stock: 45, stock_minimo: 15, categoria_id: 3, categoria_nombre: 'Lácteos', proveedor_id: 1, proveedor_nombre: 'Distribuidora Alimentos', unidad_medida: 'pieza', activo: 1, en_promocion: 0, precio_promo: null },
  { id: 3, codigo_barras: '7501000300303', nombre: 'Aceite 900ml', precio_venta: 45, precio_costo: 32, stock: 8, stock_minimo: 10, categoria_id: 2, categoria_nombre: 'Abarrotes', proveedor_id: null, proveedor_nombre: null, unidad_medida: 'pieza', activo: 1, en_promocion: 0, precio_promo: null },
  { id: 4, codigo_barras: '', nombre: 'Manzana', precio_venta: 35, precio_costo: 22, stock: 30, stock_minimo: 10, categoria_id: 5, categoria_nombre: 'Frutas y Verduras', proveedor_id: null, proveedor_nombre: null, unidad_medida: 'kg', activo: 1, en_promocion: 1, precio_promo: 28 },
  { id: 5, codigo_barras: '7501000500505', nombre: 'Refresco 2L', precio_venta: 28, precio_costo: 18, stock: 60, stock_minimo: 20, categoria_id: 4, categoria_nombre: 'Bebidas', proveedor_id: 2, proveedor_nombre: 'Bebidas del Sur', unidad_medida: 'pieza', activo: 1, en_promocion: 0, precio_promo: null },
];

const rolePermissions = {
  admin: ['realizar_ventas','anular_ventas','aplicar_descuentos','corte_caja','gestionar_productos','realizar_entradas','ajustar_stock','ver_reportes','gestionar_usuarios','cobrar_deudas','ver_auditoria','realizar_devoluciones'],
  gerente: ['realizar_ventas','anular_ventas','aplicar_descuentos','corte_caja','gestionar_productos','realizar_entradas','ajustar_stock','ver_reportes','cobrar_deudas','ver_auditoria','realizar_devoluciones'],
  cajero: ['realizar_ventas','aplicar_descuentos'],
};



let mockSales = [
  { id: 1001, fecha: '2026-07-26 10:30:00', total: 1520, descuento: 0, forma_pago: 'efectivo', cliente_id: 1, cliente_nombre: 'Juan Pérez', nombre_usuario: 'admin', usuario_id: 1, anulada: 0, caja_id: 1, items: [{ producto_id: 1, nombre_producto: 'Arroz 1kg', cantidad: 2, precio_unitario: 25, descuento: 0, subtotal: 50 }, { producto_id: 2, nombre_producto: 'Leche 1L', cantidad: 3, precio_unitario: 22, descuento: 0, subtotal: 66 }] },
  { id: 1002, fecha: '2026-07-26 11:00:00', total: 4500, descuento: 100, forma_pago: 'tarjeta', cliente_id: null, cliente_nombre: null, nombre_usuario: 'cajero', usuario_id: 3, anulada: 0, caja_id: 1, items: [{ producto_id: 3, nombre_producto: 'Aceite 900ml', cantidad: 5, precio_unitario: 45, descuento: 0, subtotal: 225 }, { producto_id: 5, nombre_producto: 'Refresco 2L', cantidad: 10, precio_unitario: 28, descuento: 0, subtotal: 280 }] },
];

let mockReturns = [];

const mockMovements = [
  { id: 1, producto_id: 1, producto_nombre: 'Arroz 1kg', tipo: 'entrada', cantidad: 50, stock_anterior: 70, stock_nuevo: 120, referencia: 'Proveedor', nombre_usuario: 'admin', created_at: '2026-07-25 10:00:00' },
  { id: 2, producto_id: 2, producto_nombre: 'Leche 1L', tipo: 'venta', cantidad: -3, stock_anterior: 48, stock_nuevo: 45, referencia: 'Venta #1001', nombre_usuario: 'admin', created_at: '2026-07-26 10:30:00' },
  { id: 3, producto_id: 3, producto_nombre: 'Aceite 900ml', tipo: 'venta', cantidad: -5, stock_anterior: 13, stock_nuevo: 8, referencia: 'Venta #1002', nombre_usuario: 'cajero', created_at: '2026-07-26 11:00:00' },
  { id: 4, producto_id: 5, producto_nombre: 'Refresco 2L', tipo: 'venta', cantidad: -10, stock_anterior: 70, stock_nuevo: 60, referencia: 'Venta #1002', nombre_usuario: 'cajero', created_at: '2026-07-26 11:00:00' },
  { id: 5, producto_id: 4, producto_nombre: 'Manzana', tipo: 'ajuste', cantidad: -5, stock_anterior: 35, stock_nuevo: 30, motivo: 'Merma', nombre_usuario: 'admin', created_at: '2026-07-24 09:00:00' },
];

const mockReceiveDocs = [
  { id: 1, referencia: 'FAC-001', proveedor_nombre: 'Distribuidora Alimentos', proveedor_id: 1, total_items: 2, usuario: 'admin', created_at: '2026-07-25 10:00:00' },
];

const mockProviders = [
  { id: 1, nombre: 'Distribuidora Alimentos', telefono: '555-1000', email: 'ventas@distalimentos.com', direccion: 'Av. Principal 123' },
  { id: 2, nombre: 'Bebidas del Sur', telefono: '555-2000', email: 'pedidos@bebidassur.com', direccion: 'Calle Secundaria 456' },
];

let mockCategories = [
  { id: 1, nombre: 'General' }, { id: 2, nombre: 'Abarrotes' }, { id: 3, nombre: 'Lácteos' },
  { id: 4, nombre: 'Bebidas' }, { id: 5, nombre: 'Frutas y Verduras' },
];

const mockClients = [
  { id: 1, nombre: 'Juan Pérez', telefono: '555-0101', correo: '', direccion: '', saldo_pendiente: 0 },
  { id: 2, nombre: 'María García', telefono: '555-0202', correo: 'maria@email.com', direccion: '', saldo_pendiente: 150 },
];

let mockAbonos = [];

const nowISO = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

const normalizeStock = (val, unit) => {
  const n = Number(val) || 0;
  if (!unit || unit === 'pieza' || unit === 'unidad') return Math.round(n);
  return Math.round(n * 1000) / 1000;
};

export const mockApi = {
  __isMock: true,
  login: (username, password) => {
    const user = mockUsers.find(u => u.nombre_usuario === username && u.password === password);
    if (!user) return Promise.reject(new Error('Credenciales inválidas'));
    currentUser = { id: user.id, nombre_usuario: user.nombre_usuario, nombre_completo: user.nombre_completo, rol: user.rol };
    return Promise.resolve(currentUser);
  },
  logout: () => {
    if (currentUser) {
      mockSessions = mockSessions.map(s => s.usuario_id === currentUser.id && s.activa ? { ...s, activa: 0, fin: nowISO() } : s);
    }
    currentUser = null;
    return Promise.resolve(true);
  },
  getCurrentUser: () => Promise.resolve(currentUser),
  getLicenseStatus: () => Promise.resolve({ activated: true, plan: 'multi', cliente: 'Modo Demo', lic: 'DEMO', emitida: '2026-01-01', expira: null, max_cajas: 4, max_usuarios: 4 }),
  activateLicense: (code) => Promise.resolve({ activated: true, plan: 'multi', cliente: 'Modo Demo', lic: 'DEMO', emitida: '2026-01-01', expira: null, max_cajas: 4, max_usuarios: 4 }),
  getUserPermissions: () => {
    const perms = rolePermissions[currentUser?.rol] || [];
    return Promise.resolve(Object.fromEntries(perms.map(p => [p, true])));
  },
  getUserPermissionsByUser: (id) => {
    const u = mockUsers.find(u => u.id === id);
    if (u?.permisos && Object.keys(u.permisos).length) return Promise.resolve(u.permisos);
    const perms = rolePermissions[u?.rol] || [];
    return Promise.resolve(Object.fromEntries(perms.map(p => [p, true])));
  },
  getUsers: () => Promise.resolve(mockUsers.map(u => ({ ...u, password_hash: u.password }))),
  createUser: (data) => {
    const user = { id: Date.now(), nombre_usuario: data.nombre_usuario, nombre_completo: data.nombre_completo || '', rol: data.rol || 'cajero', activo: 1, password: data.password || '1234', permisos: data.permisos || {} };
    mockUsers.push(user);
    return Promise.resolve({ id: user.id });
  },
  updateUser: (id, data) => {
    mockUsers = mockUsers.map(u => u.id === id ? { ...u, nombre_completo: data.nombre_completo ?? u.nombre_completo, rol: data.rol ?? u.rol, activo: data.activo !== undefined ? data.activo : u.activo, password: data.password || u.password, nombre_usuario: data.nombre_usuario ?? u.nombre_usuario, permisos: data.permisos || u.permisos } : u);
    return Promise.resolve(true);
  },
  deleteUser: (id) => {
    const u = mockUsers.find(x => x.id === id);
    if (!u) return Promise.reject(new Error('Usuario no encontrado'));
    if (u.rol === 'admin') return Promise.reject(new Error('No se puede eliminar un usuario admin'));
    mockUsers = mockUsers.map(x => x.id === id ? { ...x, activo: 0 } : x);
    return Promise.resolve(true);
  },

  getProducts: () => Promise.resolve(mockProducts),
  getProduct: (id) => Promise.resolve(mockProducts.find(p => p.id === id)),
  createProduct: (data) => {
    const cat = mockCategories.find(c => c.id === (data.categoria_id || data.categoriaId));
    const p = { id: Date.now(), codigo_barras: '', categoria_id: null, categoria_nombre: null, stock_minimo: 0, unidad_medida: 'pieza', activo: 1, ...data, categoria_nombre: cat ? cat.nombre : null };
    p.stock = normalizeStock(p.stock, p.unidad_medida);
    p.stock_minimo = normalizeStock(p.stock_minimo, p.unidad_medida);
    mockProducts.push(p);
    return Promise.resolve(p);
  },
  updateProduct: (id, data) => {
    const idx = mockProducts.findIndex(p => p.id === id);
    if (idx >= 0) {
      const updated = { ...mockProducts[idx], ...data };
      updated.stock = normalizeStock(updated.stock, updated.unidad_medida);
      updated.stock_minimo = normalizeStock(updated.stock_minimo, updated.unidad_medida);
      if (data.categoria_id !== undefined || data.categoriaId !== undefined) {
        const cat = mockCategories.find(c => c.id === (data.categoria_id || data.categoriaId));
        updated.categoria_nombre = cat ? cat.nombre : null;
      }
      mockProducts[idx] = updated;
    }
    return Promise.resolve(true);
  },
  deleteProduct: (id) => { mockProducts = mockProducts.filter(p => p.id !== id); return Promise.resolve(true); },
  searchProducts: (query) => Promise.resolve(mockProducts.filter(p => p.nombre.toLowerCase().includes(query.toLowerCase()) || (p.codigo_barras && p.codigo_barras.includes(query)))),
  importProducts: (data) => Promise.resolve({ imported: data.length }),
  getCategories: () => Promise.resolve(mockCategories),
  createCategory: (name) => { const c = { id: Date.now(), nombre: name }; mockCategories = [...mockCategories, c]; return Promise.resolve(c); },
  updateCategory: (id, name) => { mockCategories = mockCategories.map(c => c.id === id ? { ...c, nombre: name } : c); return Promise.resolve(true); },
  deleteCategory: (id) => { mockCategories = mockCategories.filter(c => c.id !== id); return Promise.resolve(true); },

  getProviders: () => Promise.resolve(mockProviders),
  getProvider: (id) => Promise.resolve(mockProviders.find(p => p.id === id) || null),
  createProvider: (data) => { const p = { id: Date.now(), ...data }; mockProviders.push(p); return Promise.resolve(p); },
  updateProvider: (id, data) => { const idx = mockProviders.findIndex(p => p.id === id); if (idx >=0) mockProviders[idx] = { ...mockProviders[idx], ...data }; return Promise.resolve(true); },
  deleteProvider: (id) => { mockProviders = mockProviders.filter(p => p.id !== id); return Promise.resolve(true); },

  getStockAlerts: () => Promise.resolve(mockProducts.filter(p => p.stock <= p.stock_minimo)),
  adjustStock: (data) => Promise.resolve(true),
  receiveInventory: (data) => {
    const docId = Date.now();
    const referencia = data.referencia || `REC-${docId}`;
    const proveedor = data.proveedor_id ? mockProviders.find(p => p.id === data.proveedor_id) : null;
    const nombre_usuario = data.nombre_usuario || currentUser?.nombre_usuario || 'admin';
    const items = [];
    for (const item of data.items) {
      const prod = mockProducts.find(p => p.id === item.producto_id);
      if (!prod) continue;
      const stockAnt = prod.stock;
      prod.stock = normalizeStock(prod.stock + item.cantidad, prod.unidad_medida);
      if (item.precio_costo) prod.precio_costo = item.precio_costo;
      const mov = { id: docId + Math.random(), producto_id: item.producto_id, producto_nombre: prod.nombre, tipo: 'entrada', cantidad: item.cantidad, stock_anterior: stockAnt, stock_nuevo: prod.stock, precio_costo: item.precio_costo || prod.precio_costo, referencia, nombre_usuario, created_at: data.fecha ? `${data.fecha} 12:00:00` : nowISO() };
      mockMovements.unshift(mov);
      items.push({ producto_id: item.producto_id, producto_nombre: prod.nombre, cantidad: item.cantidad, precio_costo: item.precio_costo || prod.precio_costo });
    }
    mockReceiveDocs.unshift({ id: docId, referencia, proveedor_nombre: proveedor?.nombre || '—', proveedor_id: data.proveedor_id, total_items: items.length, items, usuario: nombre_usuario, created_at: data.fecha ? `${data.fecha} 12:00:00` : nowISO() });
    return Promise.resolve(true);
  },
  getReceiveDocuments: () => Promise.resolve(mockReceiveDocs),
  updateReceiveDocument: (id, data) => {
    const doc = mockReceiveDocs.find(d => d.id === id);
    if (!doc) return Promise.reject(new Error('Documento no encontrado'));
    if (data.referencia) {
      const oldRef = doc.referencia;
      doc.referencia = data.referencia;
      mockMovements.filter(m => m.referencia === oldRef && m.tipo === 'entrada').forEach(m => m.referencia = data.referencia);
    }
    return Promise.resolve(true);
  },
  updateReceiveDocumentItem: (docId, productId, data) => {
    const doc = mockReceiveDocs.find(d => d.id === docId);
    if (!doc) return Promise.reject(new Error('Documento no encontrado'));
    const item = doc.items.find(i => i.producto_id === productId);
    if (!item) return Promise.reject(new Error('Producto no encontrado en el documento'));
    const oldCantidad = item.cantidad;
    if (data.cantidad !== undefined) item.cantidad = data.cantidad;
    if (data.precio_costo !== undefined) item.precio_costo = data.precio_costo;
    const prod = mockProducts.find(p => p.id === productId);
    if (prod && data.cantidad !== undefined) {
      const diff = data.cantidad - oldCantidad;
      prod.stock = normalizeStock(Math.max(0, prod.stock + diff), prod.unidad_medida);
    }
    const ref = doc.referencia;
    const mov = mockMovements.find(m => m.referencia === ref && m.producto_id === productId && m.tipo === 'entrada');
    if (mov) {
      if (data.cantidad !== undefined) {
        const diff = data.cantidad - oldCantidad;
        mov.cantidad = data.cantidad;
        mov.stock_anterior = Math.max(0, mov.stock_anterior + diff);
        mov.stock_nuevo = Math.max(0, mov.stock_nuevo + diff);
      }
      if (data.precio_costo !== undefined) mov.precio_costo = data.precio_costo;
    }
    const totalCantidad = doc.items.reduce((s, i) => s + i.cantidad, 0);
    doc.total_items = doc.items.length;
    return Promise.resolve(true);
  },
  deleteReceiveDocumentItem: (docId, productId) => {
    const doc = mockReceiveDocs.find(d => d.id === docId);
    if (!doc) return Promise.reject(new Error('Documento no encontrado'));
    const itemIdx = doc.items.findIndex(i => i.producto_id === productId);
    if (itemIdx === -1) return Promise.reject(new Error('Producto no encontrado en el documento'));
    const item = doc.items[itemIdx];
    const prod = mockProducts.find(p => p.id === productId);
    if (prod) prod.stock = normalizeStock(Math.max(0, prod.stock - item.cantidad), prod.unidad_medida);
    doc.items.splice(itemIdx, 1);
    doc.total_items = doc.items.length;
    const ref = doc.referencia;
    mockMovements = mockMovements.filter(m => !(m.referencia === ref && m.producto_id === productId && m.tipo === 'entrada'));
    return Promise.resolve(true);
  },
  deleteReceiveDocument: (id) => {
    const doc = mockReceiveDocs.find(d => d.id === id);
    if (!doc) return Promise.reject(new Error('Documento no encontrado'));
    const ref = doc.referencia;
    for (const item of doc.items) {
      const prod = mockProducts.find(p => p.id === item.producto_id);
      if (prod) prod.stock = normalizeStock(Math.max(0, prod.stock - item.cantidad), prod.unidad_medida);
    }
    mockMovements = mockMovements.filter(m => !(m.referencia === ref && m.tipo === 'entrada'));
    mockReceiveDocs = mockReceiveDocs.filter(d => d.id !== id);
    return Promise.resolve(true);
  },
  getInventoryMovements: (filters = {}) => {
    let data = mockMovements;
    if (filters.desde) data = data.filter(m => m.created_at >= filters.desde);
    if (filters.hasta) data = data.filter(m => m.created_at <= filters.hasta);
    return Promise.resolve(data);
  },
  updateMovement: ({ id, cantidad, referencia }) => {
    const idx = mockMovements.findIndex(m => m.id === id);
    if (idx >= 0) {
      const old = mockMovements[idx];
      if (cantidad !== undefined && cantidad !== old.cantidad) {
        const delta = cantidad - old.cantidad;
        const prod = mockProducts.find(p => p.id === old.producto_id);
        if (prod) prod.stock = normalizeStock(prod.stock + delta, prod.unidad_medida);
        mockMovements[idx] = { ...old, cantidad, stock_anterior: old.stock_anterior + delta, stock_nuevo: old.stock_nuevo + delta };
      }
      if (referencia !== undefined) mockMovements[idx].referencia = referencia;
    }
    return Promise.resolve(true);
  },

  deleteMovement: (id) => {
    const idx = mockMovements.findIndex(x => x.id === id);
    if (idx >= 0) {
      const m = mockMovements[idx];
      const prod = mockProducts.find(p => p.id === m.producto_id);
      if (prod) prod.stock = normalizeStock(prod.stock - m.cantidad, prod.unidad_medida);
      mockMovements.splice(idx, 1);
    }
    return Promise.resolve(true);
  },

  getInventoryDashboard: (filters = {}) => {
    const valorTotal = mockProducts.reduce((s, p) => s + p.stock * p.precio_costo, 0);
    return Promise.resolve({
      totalProductos: { cnt: mockProducts.length, total_items: mockProducts.reduce((s, p) => s + p.stock, 0), valor_total: valorTotal },
      alertasCount: mockProducts.filter(p => p.stock <= p.stock_minimo).length,
      categorias: [
        { nombre: 'Abarrotes', valor: 3500, productos: 2 },
        { nombre: 'Lácteos', valor: 720, productos: 1 },
        { nombre: 'Bebidas', valor: 1080, productos: 1 },
        { nombre: 'Frutas y Verduras', valor: 660, productos: 1 },
      ],
      topProducts: [
        { nombre: 'Arroz 1kg', total_vendido: 45, total_ingresos: 1125 },
        { nombre: 'Leche 1L', total_vendido: 30, total_ingresos: 660 },
        { nombre: 'Refresco 2L', total_vendido: 20, total_ingresos: 560 },
      ],
      sinMovimiento: [
        { id: 3, nombre: 'Aceite 900ml', stock: 8, precio_costo: 32, ultimo_movimiento: '2026-06-15 10:00:00' },
        { id: 4, nombre: 'Manzana', stock: 30, precio_costo: 22, ultimo_movimiento: '2026-07-01 09:00:00' },
      ],
    });
  },

  createSale: (data) => {
    const id = Date.now();
    const baseTotal = data.items.reduce((s, i) => s + i.subtotal, 0);
    const descuentoTotal = (data.descuento || 0) + (data.cupon_descuento || 0) + (data.combo_descuento || 0);
    const total = Math.max(0, baseTotal - descuentoTotal);
    const pagos = data.pagos || [{ tipo: data.forma_pago, monto: total }];
    const formaPago = pagos.length > 1 ? 'mixto' : pagos[0].tipo;
    const sale = { id, fecha: nowISO(), total, descuento: descuentoTotal, forma_pago: formaPago, detalle_pago: JSON.stringify(pagos), cliente_id: data.cliente_id || null, cliente_nombre: 'Juan Pérez', nombre_usuario: 'admin', usuario_id: 1, anulada: 0, caja_id: currentUser?.caja_id || 1, items: data.items.map(i => ({ ...i, descuento: 0 })) };
    mockSales = [sale, ...mockSales];
    const corte = mockCortes.find(c => !c.cerrado && c.caja_id === sale.caja_id);
    if (corte) corte.monto_ventas = (corte.monto_ventas || 0) + total;
    return Promise.resolve({ ...sale, pagos, forma_pago: formaPago });
  },
  getSales: (filters = {}) => {
    let data = mockSales;
    if (filters.mis_ventas) data = data.filter(s => s.usuario_id === currentUser?.id);
    if (filters.desde) data = data.filter(s => s.fecha >= filters.desde);
    if (filters.hasta) data = data.filter(s => s.fecha <= filters.hasta);
    if (filters.usuario_id) data = data.filter(s => s.usuario_id === parseInt(filters.usuario_id));
    if (filters.caja_id) data = data.filter(s => s.caja_id === filters.caja_id);
    if (filters.anulada !== undefined) data = data.filter(s => s.anulada === filters.anulada);
    return Promise.resolve(data);
  },
  getSale: (id) => Promise.resolve(mockSales.find(s => s.id === id) || null),
  voidSale: (id, reason) => {
    const venta = mockSales.find(s => s.id === id);
    if (!venta) return Promise.reject(new Error('Venta no encontrada'));
    if (venta.anulada) return Promise.reject(new Error('La venta ya está anulada'));
    mockSales = mockSales.map(s => s.id === id ? { ...s, anulada: 1, motivo_anulacion: reason } : s);
    for (const item of venta.items || []) {
      if (item.producto_id) {
        const prod = mockProducts.find(p => p.id === item.producto_id);
        if (prod) {
          const stockAnt = prod.stock;
          prod.stock = normalizeStock(prod.stock + item.cantidad, prod.unidad_medida);
          mockMovements.unshift({ id: Date.now() + Math.random(), producto_id: item.producto_id, producto_nombre: item.nombre_producto, tipo: 'entrada', cantidad: item.cantidad, stock_anterior: stockAnt, stock_nuevo: prod.stock, referencia: `Anulación venta #${id}`, nombre_usuario: currentUser?.nombre_usuario || 'admin', created_at: nowISO() });
        }
      }
    }
    if (venta.forma_pago === 'credito' && venta.cliente_id) {
      const client = mockClients.find(c => c.id === venta.cliente_id);
      if (client) client.saldo_pendiente = Math.max(0, (client.saldo_pendiente || 0) - venta.total);
    }
    return Promise.resolve(true);
  },
  getTodaySales: () => Promise.resolve(mockSales.filter(s => !s.anulada)),
  getSalesSummary: (filters = {}) => {
    let active = mockSales.filter(s => !s.anulada);
    if (filters.desde) active = active.filter(s => s.fecha >= filters.desde);
    if (filters.hasta) active = active.filter(s => s.fecha <= filters.hasta);
    const total = active.reduce((s, v) => s + v.total, 0);
    const desc = active.reduce((s, v) => s + (v.descuento || 0), 0);
    return Promise.resolve({ total_ventas: active.length, monto_total: total, total_descuentos: desc, ticket_promedio: active.length ? total / active.length : 0, formas_pago: [] });
  },

  getClients: () => Promise.resolve(mockClients),
  getClient: (id) => Promise.resolve(mockClients.find(c => c.id === id)),
  createClient: (data) => Promise.resolve({ id: Date.now(), ...data, saldo_pendiente: 0 }),
  updateClient: (id, data) => Promise.resolve(true),
  searchClients: (query) => Promise.resolve(mockClients.filter(c => c.nombre.toLowerCase().includes(query.toLowerCase()))),
  getClientDebt: (id) => {
    const client = mockClients.find(c => c.id === id);
    const abonos = mockAbonos.filter(a => a.cliente_id === id);
    return Promise.resolve({ client, ventas: [], abonos });
  },
  registerPayment: (data) => {
    const abono = { id: Date.now(), cliente_id: data.cliente_id, venta_id: data.venta_id || null, monto: data.monto, created_at: nowISO() };
    mockAbonos.push(abono);
    const client = mockClients.find(c => c.id === data.cliente_id);
    if (client) client.saldo_pendiente = Math.max(0, client.saldo_pendiente - data.monto);
    return Promise.resolve(true);
  },

  openCashRegister: (data) => {
    const cajaId = data.caja_id || 1;
    const corte = { id: Date.now(), caja_id: cajaId, fecha_apertura: nowISO(), monto_inicial: data.monto_inicial, monto_ventas: 0, cerrado: 0, usuario_id: currentUser?.id || 1 };
    mockCortes = [corte, ...mockCortes];
    return Promise.resolve({ id: corte.id });
  },
  closeCashRegister: (data) => {
    const totalEsperado = 5000;
    mockCortes = mockCortes.map(c => c.id === data.id ? { ...c, cerrado: 1, monto_final: data.monto_final, observaciones: data.observaciones, fecha_cierre: nowISO(), reporte_json: data.reporte_json || null } : c);
    return Promise.resolve({ total_esperado, diferencia: data.monto_final - totalEsperado });
  },
  getCashRegisterStatus: (filters) => {
    let active = mockCortes.find(c => !c.cerrado && (!filters?.caja_id || c.caja_id === filters.caja_id));
    return Promise.resolve(active || null);
  },
  getCashRegisterHistory: (filters) => {
    let data = mockCortes.filter(c => c.cerrado);
    if (filters?.caja_id) data = data.filter(c => c.caja_id === filters.caja_id);
    return Promise.resolve(data);
  },
  getCajaStatus: (cajaId) => {
    const c = mockCortes.find(cc => cc.caja_id === cajaId && !cc.cerrado);
    if (!c) return Promise.resolve(null);
    const u = mockUsers.find(us => us.id === c.usuario_id);
    return Promise.resolve({ ...c, nombre_usuario: u?.nombre_usuario, nombre_completo: u?.nombre_completo });
  },

  getCajas: () => Promise.resolve([...mockCajas]),
  createCaja: (data) => {
    const maxCajas = mockVersion === 'pro' || mockVersion === 'multi' ? 4 : 2;
    if (mockCajas.length >= maxCajas) return Promise.reject(new Error(`Límite de cajas (${maxCajas})`));
    const caja = { id: Date.now(), nombre: data.nombre, activa: 1, created_at: nowISO() };
    mockCajas = [...mockCajas, caja];
    return Promise.resolve(caja);
  },
  updateCaja: (data) => { mockCajas = mockCajas.map(c => c.id === data.id ? { ...c, nombre: data.nombre } : c); return Promise.resolve(true); },
  deleteCaja: (id) => { mockCajas = mockCajas.filter(c => c.id !== id); return Promise.resolve(true); },
  // Sessions
  startSession: (data) => {
    const existing = mockSessions.find(s => s.caja_id === data.caja_id && s.activa);
    if (existing) return Promise.reject(new Error('Esta caja ya tiene un cajero asignado'));
    const ses = { id: Date.now(), caja_id: data.caja_id, usuario_id: data.usuario_id, inicio: nowISO(), fin: null, activa: 1 };
    mockSessions = [...mockSessions, ses];
    return Promise.resolve({ id: ses.id });
  },
  endSession: (data) => {
    mockSessions = mockSessions.map(s => s.id === data.sesion_id ? { ...s, activa: 0, fin: nowISO() } : s);
    return Promise.resolve(true);
  },
  endSessionByUser: (data) => {
    mockSessions = mockSessions.map(s => s.usuario_id === data.usuario_id && s.activa ? { ...s, activa: 0, fin: nowISO() } : s);
    return Promise.resolve(true);
  },
  getAllCajasWithStatus: () => {
    return Promise.resolve(mockCajas.filter(c => c.activa).map(c => {
      const corte = mockCortes.find(cc => cc.caja_id === c.id && !cc.cerrado) || null;
      const sesiones = mockSessions.filter(s => s.caja_id === c.id && s.activa).map(s => {
        const u = mockUsers.find(us => us.id === s.usuario_id);
        return { ...s, nombre_usuario: u?.nombre_usuario, nombre_completo: u?.nombre_completo };
      });
      return { ...c, abierta: !!corte, corte, sesiones, sesiones_count: sesiones.length };
    }));
  },
  joinCajaSession: (data) => {
    const uid = currentUser?.id || data.usuario_id;
    const existingUserSession = mockSessions.find(s => s.usuario_id === uid && s.activa);
    if (existingUserSession) return Promise.reject(new Error('Ya tiene una sesión activa en otra caja'));
    const ses = { id: Date.now(), caja_id: data.caja_id, usuario_id: uid, inicio: nowISO(), fin: null, activa: 1 };
    mockSessions = [...mockSessions, ses];
    return Promise.resolve({ id: ses.id });
  },
  getAvailableCajas: () => {
    const occupied = mockSessions.filter(s => s.activa).map(s => s.caja_id);
    return Promise.resolve(mockCajas.filter(c => !occupied.includes(c.id)));
  },
  getActiveSession: (cajaId) => {
    const s = mockSessions.find(s => s.caja_id === cajaId && s.activa);
    if (!s) return Promise.resolve(null);
    const u = mockUsers.find(u => u.id === s.usuario_id);
    return Promise.resolve({ ...s, nombre_usuario: u?.nombre_usuario, nombre_completo: u?.nombre_completo });
  },
  getAllActiveSessions: () => {
    return Promise.resolve(mockSessions.filter(s => s.activa).map(s => {
      const u = mockUsers.find(us => us.id === s.usuario_id);
      const c = mockCajas.find(ca => ca.id === s.caja_id);
      return { ...s, nombre_usuario: u?.nombre_usuario, nombre_completo: u?.nombre_completo, caja_nombre: c?.nombre };
    }));
  },
  getCurrentSession: () => {
    if (!currentUser) return Promise.resolve(null);
    const s = mockSessions.find(s => s.usuario_id === currentUser.id && s.activa);
    if (!s) return Promise.resolve(null);
    const c = mockCajas.find(ca => ca.id === s.caja_id);
    return Promise.resolve({ ...s, caja_nombre: c?.nombre });
  },

  getCajaMetrics: () => {
    const perCaja = mockCajas.map(c => {
      const ventasCaja = mockSales.filter(s => !s.anulada && s.caja_id === c.id);
      return { id: c.id, nombre: c.nombre, abierta: mockCortes.some(co => co.caja_id === c.id && !co.cerrado) ? 1 : 0, monto_inicial: 0, monto_ventas: ventasCaja.reduce((s, v) => s + v.total, 0), total_ventas: ventasCaja.length, ingresos: ventasCaja.reduce((s, v) => s + v.total, 0), total_sesiones: mockSessions.filter(s => s.caja_id === c.id).length };
    });
    const perCajero = [
      { id: 1, nombre_completo: 'Admin Principal', nombre_usuario: 'admin', rol: 'admin', total_ventas: 5, ingresos: 15200, ticket_promedio: 3040, caja_id: 1, caja_nombre: 'Caja Principal', total_sesiones: 3 },
      { id: 3, nombre_completo: 'Cajero Ventas', nombre_usuario: 'cajero', rol: 'cajero', total_ventas: 12, ingresos: 28400, ticket_promedio: 2367, caja_id: 1, caja_nombre: 'Caja Principal', total_sesiones: 5 },
    ];
    const sesionesActivas = mockSessions.filter(s => s.activa).map(s => {
      const u = mockUsers.find(us => us.id === s.usuario_id);
      const c = mockCajas.find(ca => ca.id === s.caja_id);
      return { ...s, nombre_usuario: u?.nombre_usuario, nombre_completo: u?.nombre_completo, caja_nombre: c?.nombre };
    });
    return Promise.resolve({ perCaja, perCajero, sesionesActivas });
  },

  getVersion: () => Promise.resolve(mockVersion),
  setVersion: (v) => { mockVersion = v; return Promise.resolve(true); },
  getMaxCajas: () => Promise.resolve(mockVersion === 'pro' || mockVersion === 'multi' ? 4 : 2),

  getDailyReport: (date) => {
    const daySales = mockSales.filter(s => !s.anulada && s.fecha.startsWith(date));
    const total_ventas = daySales.length;
    const monto_total = daySales.reduce((s, v) => s + v.total, 0);
    const descuentos = daySales.reduce((s, v) => s + (v.descuento || 0), 0);
    const formas_pago = Object.entries(daySales.reduce((acc, v) => { acc[v.forma_pago] = (acc[v.forma_pago] || 0) + 1; return acc; }, {})).map(([forma_pago, cantidad]) => ({ forma_pago, cantidad, monto: daySales.filter(s => s.forma_pago === forma_pago).reduce((s, v) => s + v.total, 0) }));
    const productCounts = {};
    daySales.forEach(s => (s.items || []).forEach(i => { productCounts[i.nombre_producto] = (productCounts[i.nombre_producto] || 0) + i.cantidad; }));
    const top_productos = Object.entries(productCounts).map(([nombre_producto, cantidad]) => ({ nombre_producto, cantidad, total: daySales.filter(s => (s.items || []).some(i => i.nombre_producto === nombre_producto)).reduce((s, v) => s + v.total, 0) })).sort((a, b) => b.cantidad - a.cantidad).slice(0, 10);
    return Promise.resolve({ fecha: date, summary: { total_ventas, monto_total, descuentos }, formas_pago, top_productos });
  },
  getTopProducts: (filters = {}) => {
    let data = mockSales.filter(s => !s.anulada);
    if (filters.desde) data = data.filter(s => s.fecha >= filters.desde);
    if (filters.hasta) data = data.filter(s => s.fecha <= filters.hasta);
    const productMap = {};
    data.forEach(s => (s.items || []).forEach(i => {
      if (!productMap[i.nombre_producto]) productMap[i.nombre_producto] = { nombre_producto: i.nombre_producto, codigo_barras: mockProducts.find(p => p.id === i.producto_id)?.codigo_barras || '', cantidad: 0, total: 0, precio_promedio: i.precio_unitario };
      productMap[i.nombre_producto].cantidad += i.cantidad;
      productMap[i.nombre_producto].total += i.subtotal;
    }));
    return Promise.resolve(Object.values(productMap).sort((a, b) => b.cantidad - a.cantidad).slice(0, 20));
  },
  getProfitReport: (filters = {}) => {
    let data = mockSales.filter(s => !s.anulada);
    if (filters.desde) data = data.filter(s => s.fecha >= filters.desde);
    if (filters.hasta) data = data.filter(s => s.fecha <= filters.hasta);
    const ingresos = data.reduce((s, v) => s + v.total, 0);
    const productMap = {};
    data.forEach(s => (s.items || []).forEach(i => {
      if (!productMap[i.nombre_producto]) productMap[i.nombre_producto] = { nombre_producto: i.nombre_producto, ventas: 0, costo: 0, cantidad: 0 };
      productMap[i.nombre_producto].ventas += i.subtotal;
      productMap[i.nombre_producto].cantidad += i.cantidad;
      const prod = mockProducts.find(p => p.id === i.producto_id);
      productMap[i.nombre_producto].costo += (prod?.precio_costo || 0) * i.cantidad;
    }));
    const productos = Object.values(productMap).map(p => ({ ...p, ganancia: p.ventas - p.costo }));
    const costo_total = productos.reduce((s, p) => s + p.costo, 0);
    const ganancia = ingresos - costo_total;
    return Promise.resolve({ summary: { ingresos, costo_total, ganancia }, productos });
  },
  getAuditLog: () => Promise.resolve([]),

  createReturn: (data) => {
    const id = Date.now();
    const total = data.items.reduce((s, i) => s + i.subtotal, 0);
    for (const item of data.items) {
      if (item.producto_id) {
        const prod = mockProducts.find(p => p.id === item.producto_id);
        if (prod) {
          const stockAnt = prod.stock;
          prod.stock = normalizeStock(prod.stock + item.cantidad, prod.unidad_medida);
          mockMovements.unshift({ id: Date.now() + Math.random(), producto_id: item.producto_id, producto_nombre: item.nombre_producto, tipo: 'entrada', cantidad: item.cantidad, stock_anterior: stockAnt, stock_nuevo: prod.stock, referencia: `Devolución #${id}`, nombre_usuario: currentUser?.nombre_usuario || 'admin', created_at: nowISO() });
        }
      }
    }
    const venta = mockSales.find(s => s.id === data.venta_id);
    if (venta && venta.forma_pago === 'credito' && venta.cliente_id) {
      const client = mockClients.find(c => c.id === venta.cliente_id);
      if (client) client.saldo_pendiente = Math.max(0, (client.saldo_pendiente || 0) - total);
    }
    const ret = { id, fecha: nowISO(), total, venta_id: data.venta_id || null, motivo: data.motivo || null, nombre_usuario: currentUser?.nombre_usuario || 'admin', items: data.items };
    mockReturns = [ret, ...mockReturns];
    return Promise.resolve(ret);
  },
  getReturns: () => Promise.resolve(mockReturns),
  getReturn: (id) => Promise.resolve(mockReturns.find(r => r.id === id) || null),

  printTicket: (data) => Promise.resolve(true),
  getPrinters: () => Promise.resolve(['Impresora Térmica', 'Microsoft Print to PDF']),
  getBoletasEmitidas: () => Promise.resolve(mockBoletasEmitidas),
  registerBoletaEmitida: (data) => { const b = { id: Date.now(), folio: mockBoletasEmitidas.length + 1, created_at: nowISO(), ...data }; mockBoletasEmitidas = [b, ...mockBoletasEmitidas]; return Promise.resolve(b); },

  readScale: () => Promise.resolve({ weight: 0, unit: 'kg', connected: false, message: 'Báscula no disponible en modo mock' }),
  configureScale: (config) => Promise.resolve(true),
  getScaleConfig: () => Promise.resolve({ port: 'COM1', protocol: 'rs232' }),
  getPrinterConfig: () => Promise.resolve({ ...mockPrinterConfig }),
  setPrinterConfig: (config) => { mockPrinterConfig = { ...mockPrinterConfig, ...config }; return Promise.resolve(true); },
  getSiiConfig: () => Promise.resolve({ ...mockSiiConfig }),
  setSiiConfig: (config) => { mockSiiConfig = { ...mockSiiConfig, ...config }; return Promise.resolve(true); },

  getAppInfo: () => Promise.resolve({ version: '1.0.0-dev', name: 'Next Byte (Mock)', platform: 'browser' }),

  // Cupones
  getCupones: () => Promise.resolve([...mockCupones]),
  createCupon: (data) => {
    const c = { id: Date.now(), codigo: data.codigo, tipo: data.tipo, valor: data.valor, min_compra: data.min_compra || 0, vigencia_desde: data.vigencia_desde || null, vigencia_hasta: data.vigencia_hasta || null, usos_maximos: data.usos_maximos || 0, usos_actuales: 0, activo: 1, tipo_aplicacion: data.tipo_aplicacion || 'todos', producto_id: data.producto_id || null, categoria_id: data.categoria_id || null, productos_ids: data.productos_ids || null, created_at: nowISO() };
    mockCupones = [c, ...mockCupones]; return Promise.resolve({ id: c.id });
  },
  updateCupon: (data) => { mockCupones = mockCupones.map(c => c.id === data.id ? { ...c, ...data } : c); return Promise.resolve(true); },
  deleteCupon: (id) => { mockCupones = mockCupones.filter(c => c.id !== id); return Promise.resolve(true); },
  usarCupon: (codigo) => {
    const c = mockCupones.find(c => c.codigo === codigo && c.activo);
    if (!c) return Promise.reject(new Error('Cupón no encontrado o inactivo'));
    if (c.usos_maximos > 0 && c.usos_actuales >= c.usos_maximos) return Promise.reject(new Error('Cupón agotado'));
    c.usos_actuales++; return Promise.resolve({ ...c });
  },

  // Descuentos por cantidad
  getDescuentosCantidad: () => Promise.resolve(mockDescuentosCantidad.map(d => {
    const p = mockProducts.find(pr => pr.id === d.producto_id);
    return { ...d, producto_nombre: p?.nombre, codigo_barras: p?.codigo_barras };
  })),
  createDescuentoCantidad: (data) => { const d = { id: Date.now(), producto_id: data.producto_id, reglas: data.reglas, tipo: data.tipo || 'precio_fijo', activo: 1 }; mockDescuentosCantidad = [d, ...mockDescuentosCantidad]; return Promise.resolve({ id: d.id }); },
  updateDescuentoCantidad: (data) => { mockDescuentosCantidad = mockDescuentosCantidad.map(d => d.id === data.id ? { ...d, ...data } : d); return Promise.resolve(true); },
  deleteDescuentoCantidad: (id) => { mockDescuentosCantidad = mockDescuentosCantidad.filter(d => d.id !== id); return Promise.resolve(true); },
  getDescuentoPorProducto: (productoId) => {
    const d = mockDescuentosCantidad.find(d => d.producto_id === productoId && d.activo !== 0);
    return Promise.resolve(d || null);
  },

  // Promociones
  getPromoted: () => {
    return Promise.resolve(mockProducts.filter(p => p.en_promocion && p.activo));
  },
  setPromotion: (data) => {
    mockProducts = mockProducts.map(p => p.id === data.producto_id ? { ...p, en_promocion: data.activo ? 1 : 0, precio_promo: data.activo ? data.precio_promo : null } : p);
    return Promise.resolve(true);
  },

  // Grupos / combos
  getGrupos: () => {
    return Promise.resolve(mockGrupos.map(g => ({
      ...g,
      items: g.items.map(i => ({ ...i, nombre_producto: i.nombre_producto || mockProducts.find(p => p.id === i.producto_id)?.nombre, precio_venta: i.precio_venta ?? mockProducts.find(p => p.id === i.producto_id)?.precio_venta })),
    })));
  },
  createGrupo: (data) => {
    const id = Date.now();
    mockGrupos = [...mockGrupos, { id, nombre: data.nombre, precio: data.precio, activo: data.activo ?? 1, items: data.items.map(i => ({ ...i, nombre_producto: mockProducts.find(p => p.id === i.producto_id)?.nombre, precio_venta: mockProducts.find(p => p.id === i.producto_id)?.precio_venta })) }];
    return Promise.resolve({ id });
  },
  updateGrupo: (data) => {
    mockGrupos = mockGrupos.map(g => g.id === data.id ? { ...g, nombre: data.nombre, precio: data.precio, activo: data.activo ?? 1, items: data.items.map(i => ({ ...i, nombre_producto: mockProducts.find(p => p.id === i.producto_id)?.nombre, precio_venta: mockProducts.find(p => p.id === i.producto_id)?.precio_venta })) } : g);
    return Promise.resolve(true);
  },
  deleteGrupo: (id) => {
    mockGrupos = mockGrupos.filter(g => g.id !== id);
    return Promise.resolve(true);
  },
};
