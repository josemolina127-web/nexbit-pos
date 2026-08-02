const path = require('path');
const { app } = require('electron');
const initSqlJs = require('sql.js');
const fs = require('fs');

let db = null;
let SQL = null;

function getDbPath() {
  try {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'nexbit.db');
  } catch {
    return path.join(__dirname, '../../data/nexbit.db');
  }
}

async function initDatabase() {
  const wasmPath = path.join(require.resolve('sql.js'), '../../dist/sql-wasm.wasm');
  SQL = await initSqlJs({ locateFile: () => wasmPath });
  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  runMigrations();
  saveDatabase();
  return db;
}

function runMigrations() {
  db.run(`
    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS proveedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      telefono TEXT,
      email TEXT,
      direccion TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo_barras TEXT UNIQUE,
      nombre TEXT NOT NULL,
      precio_venta REAL NOT NULL DEFAULT 0,
      precio_costo REAL NOT NULL DEFAULT 0,
      stock REAL NOT NULL DEFAULT 0,
      stock_minimo REAL NOT NULL DEFAULT 0,
      categoria_id INTEGER,
      unidad_medida TEXT NOT NULL DEFAULT 'pieza',
      activo INTEGER NOT NULL DEFAULT 1,
      imagen TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (categoria_id) REFERENCES categorias(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre_usuario TEXT NOT NULL UNIQUE,
      nombre_completo TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'cajero',
      activo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS permisos_usuario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      permiso TEXT NOT NULL,
      valor INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
      UNIQUE(usuario_id, permiso)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      telefono TEXT,
      correo TEXT,
      direccion TEXT,
      saldo_pendiente REAL NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      total REAL NOT NULL DEFAULT 0,
      descuento REAL NOT NULL DEFAULT 0,
      forma_pago TEXT NOT NULL DEFAULT 'efectivo',
      cliente_id INTEGER,
      usuario_id INTEGER,
      anulada INTEGER NOT NULL DEFAULT 0,
      motivo_anulacion TEXT,
      caja_id INTEGER,
      sincronizado INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (cliente_id) REFERENCES clientes(id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );
  `);

  // Add missing columns if not exists (migration)
  try { db.run(`ALTER TABLE ventas ADD COLUMN caja_id INTEGER`); } catch (e) {}
  try { db.run(`ALTER TABLE ventas ADD COLUMN detalle_pago TEXT`); } catch (e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS ventas_detalle (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL,
      producto_id INTEGER,
      nombre_producto TEXT NOT NULL,
      cantidad REAL NOT NULL DEFAULT 1,
      precio_unitario REAL NOT NULL,
      descuento REAL NOT NULL DEFAULT 0,
      subtotal REAL NOT NULL,
      FOREIGN KEY (venta_id) REFERENCES ventas(id),
      FOREIGN KEY (producto_id) REFERENCES productos(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cajas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      activa INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sesiones_caja (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caja_id INTEGER NOT NULL,
      usuario_id INTEGER NOT NULL,
      inicio TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      fin TEXT,
      activa INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (caja_id) REFERENCES cajas(id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );
  `);

  // Migrate: add caja_id column if not exists (sql.js can't do IF NOT EXISTS for ALTER)
  try { db.run(`ALTER TABLE cortes_caja ADD COLUMN caja_id INTEGER REFERENCES cajas(id)`); } catch(e) {}
try { db.run(`ALTER TABLE cortes_caja ADD COLUMN reporte_json TEXT`); } catch(e) {}
  try { db.run(`ALTER TABLE cupones ADD COLUMN tipo_aplicacion TEXT DEFAULT 'todos'`); } catch(e) {}
  try { db.run(`ALTER TABLE cupones ADD COLUMN producto_id INTEGER`); } catch(e) {}
  try { db.run(`ALTER TABLE cupones ADD COLUMN categoria_id INTEGER`); } catch(e) {}
  try { db.run(`ALTER TABLE cupones ADD COLUMN productos_ids TEXT`); } catch(e) {}
  try { db.run(`ALTER TABLE descuentos_cantidad ADD COLUMN tipo TEXT DEFAULT 'precio_fijo'`); } catch(e) {}
  try { db.run(`ALTER TABLE usuarios ADD COLUMN caja_id INTEGER REFERENCES cajas(id)`); } catch(e) {}
  try { db.run(`ALTER TABLE ventas ADD COLUMN caja_id INTEGER REFERENCES cajas(id)`); } catch(e) {}
  try { db.run(`ALTER TABLE productos ADD COLUMN proveedor_id INTEGER REFERENCES proveedores(id)`); } catch(e) {}
  try { db.run(`ALTER TABLE productos ADD COLUMN en_promocion INTEGER DEFAULT 0`); } catch(e) {}
  try { db.run(`ALTER TABLE productos ADD COLUMN precio_promo REAL`); } catch(e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS grupos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      precio REAL NOT NULL DEFAULT 0,
      activo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS grupo_detalles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grupo_id INTEGER NOT NULL REFERENCES grupos(id),
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      cantidad REAL NOT NULL DEFAULT 1
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS movimientos_inventario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('entrada','salida','ajuste','venta')),
      cantidad REAL NOT NULL,
      stock_anterior REAL NOT NULL,
      stock_nuevo REAL NOT NULL,
      precio_costo REAL,
      referencia TEXT,
      usuario_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (producto_id) REFERENCES productos(id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS abonos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL,
      venta_id INTEGER,
      monto REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      usuario_id INTEGER,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id),
      FOREIGN KEY (venta_id) REFERENCES ventas(id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cortes_caja (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha_apertura TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      fecha_cierre TEXT,
      monto_inicial REAL NOT NULL DEFAULT 0,
      monto_ventas REAL NOT NULL DEFAULT 0,
      monto_final REAL,
      usuario_id INTEGER,
      cerrado INTEGER NOT NULL DEFAULT 0,
      observaciones TEXT,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS auditoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      accion TEXT NOT NULL,
      detalle TEXT,
      valores_anteriores TEXT,
      valores_nuevos TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS devoluciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER,
      fecha TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      total REAL NOT NULL DEFAULT 0,
      motivo TEXT,
      usuario_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (venta_id) REFERENCES ventas(id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS devoluciones_detalle (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      devolucion_id INTEGER NOT NULL,
      producto_id INTEGER,
      nombre_producto TEXT NOT NULL,
      cantidad REAL NOT NULL DEFAULT 1,
      precio_unitario REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (devolucion_id) REFERENCES devoluciones(id),
      FOREIGN KEY (producto_id) REFERENCES productos(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS documentos_entrada (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referencia TEXT NOT NULL,
      proveedor_id INTEGER,
      proveedor_nombre TEXT DEFAULT '',
      total_items INTEGER DEFAULT 0,
      usuario_id INTEGER,
      items_json TEXT DEFAULT '[]',
      created_at TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS boletas_emitidas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folio INTEGER NOT NULL,
      tipo_dte TEXT DEFAULT '39',
      total REAL DEFAULT 0,
      rut_cliente TEXT DEFAULT '',
      razon_social_cliente TEXT DEFAULT '',
      xml_response TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );
  `);

  // PROMOCIONES Y CUPONES
  db.run(`
    CREATE TABLE IF NOT EXISTS cupones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL UNIQUE,
      tipo TEXT NOT NULL DEFAULT 'porcentaje',
      valor REAL NOT NULL DEFAULT 0,
      min_compra REAL DEFAULT 0,
      vigencia_desde TEXT,
      vigencia_hasta TEXT,
      usos_maximos INTEGER DEFAULT 0,
      usos_actuales INTEGER DEFAULT 0,
      activo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS descuentos_cantidad (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER,
      reglas TEXT NOT NULL DEFAULT '[]',
      activo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (producto_id) REFERENCES productos(id)
    );
  `);

  // Insert default admin if not exists
  const adminExists = db.exec(`SELECT id FROM usuarios WHERE nombre_usuario = 'admin'`);
  if (adminExists.length === 0) {
    const hash = require('crypto').createHash('sha256').update('admin123').digest('hex');
    db.run(`INSERT INTO usuarios (nombre_usuario, nombre_completo, password_hash, rol) VALUES ('admin', 'Administrador', ?, 'admin')`, [hash]);
  }

  // Insert default categories
  const cats = db.exec(`SELECT id FROM categorias LIMIT 1`);
  if (cats.length === 0) {
    db.run(`INSERT INTO categorias (nombre) VALUES ('General')`);
    db.run(`INSERT INTO categorias (nombre) VALUES ('Abarrotes')`);
    db.run(`INSERT INTO categorias (nombre) VALUES ('Lácteos')`);
    db.run(`INSERT INTO categorias (nombre) VALUES ('Bebidas')`);
    db.run(`INSERT INTO categorias (nombre) VALUES ('Frutas y Verduras')`);
    db.run(`INSERT INTO categorias (nombre) VALUES ('Carnes')`);
    db.run(`INSERT INTO categorias (nombre) VALUES ('Limpieza')`);
  }

  // Insert default cajas
  const cajasExist = db.exec(`SELECT id FROM cajas LIMIT 1`);
  if (cajasExist.length === 0) {
    db.run(`INSERT INTO cajas (nombre) VALUES ('Caja Principal')`);
  }

  // Insert default proveedores
  const provExist = db.exec(`SELECT id FROM proveedores LIMIT 1`);
  if (provExist.length === 0) {
    db.run(`INSERT INTO proveedores (nombre, telefono, email, direccion) VALUES ('Proveedor General', '555-0000', 'proveedor@email.com', 'Dirección principal')`);
  }

  // Insert default config
  db.run(`INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('descuento_maximo', '30')`);
  db.run(`INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('empresa_nombre', 'Mi Tienda')`);
  db.run(`INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('ticket_pie', 'Gracias por su compra')`);
  db.run(`INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('version', 'basic')`);
}

function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

function saveDatabase() {
  const dbPath = getDbPath();
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

let lastInsertId = 0;
function run(sql, params = []) {
  db.run(sql, params);
  // Capture rowid before export(); sql.js export() resets last_insert_rowid() to 0.
  lastInsertId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
  saveDatabase();
}

function getLastInsertId() {
  return lastInsertId;
}

module.exports = { initDatabase, getDb, saveDatabase, query, run, getLastInsertId };
