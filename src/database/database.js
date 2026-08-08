const path = require('path');
const { app } = require('electron');
const Database = require('better-sqlite3');
const fs = require('fs');

let db = null;

function configPath() {
  return path.join(app.getPath('userData'), 'db-path.json');
}

function getDbPath() {
  try {
    // Override de ruta (BD compartida en red) si está configurado
    const cfg = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
    if (cfg && typeof cfg.path === 'string' && cfg.path.trim()) return cfg.path.trim();
  } catch {}
  return path.join(app.getPath('userData'), 'nexbit.db');
}

async function initDatabase() {
  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 30000');

  runMigrations();
  return db;
}

function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS proveedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      telefono TEXT,
      email TEXT,
      direccion TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

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

    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre_usuario TEXT NOT NULL UNIQUE,
      nombre_completo TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'cajero',
      activo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS permisos_usuario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      permiso TEXT NOT NULL,
      valor INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
      UNIQUE(usuario_id, permiso)
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      telefono TEXT,
      correo TEXT,
      direccion TEXT,
      saldo_pendiente REAL NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

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

    CREATE TABLE IF NOT EXISTS cajas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      activa INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

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

    CREATE TABLE IF NOT EXISTS grupos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      precio REAL NOT NULL DEFAULT 0,
      activo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS grupo_detalles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grupo_id INTEGER NOT NULL REFERENCES grupos(id),
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      cantidad REAL NOT NULL DEFAULT 1
    );

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

    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );

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

    CREATE TABLE IF NOT EXISTS descuentos_cantidad (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER,
      reglas TEXT NOT NULL DEFAULT '[]',
      activo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (producto_id) REFERENCES productos(id)
    );
  `);

  // Migrations: add columns if not exists (better-sqlite3 supports IF NOT EXISTS)
  const addColumn = (table, column, def) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    if (!cols.includes(column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
    }
  };
  addColumn('ventas', 'caja_id', 'INTEGER');
  addColumn('ventas', 'detalle_pago', 'TEXT');
  addColumn('cortes_caja', 'caja_id', 'INTEGER REFERENCES cajas(id)');
  addColumn('cortes_caja', 'reporte_json', 'TEXT');
  addColumn('cupones', 'tipo_aplicacion', "TEXT DEFAULT 'todos'");
  addColumn('cupones', 'producto_id', 'INTEGER');
  addColumn('cupones', 'categoria_id', 'INTEGER');
  addColumn('cupones', 'productos_ids', 'TEXT');
  addColumn('descuentos_cantidad', 'tipo', "TEXT DEFAULT 'precio_fijo'");
  addColumn('usuarios', 'caja_id', 'INTEGER REFERENCES cajas(id)');
  addColumn('productos', 'proveedor_id', 'INTEGER REFERENCES proveedores(id)');
  addColumn('productos', 'en_promocion', 'INTEGER DEFAULT 0');
  addColumn('productos', 'precio_promo', 'REAL');

  // Insert default admin if not exists
  const admin = db.prepare(`SELECT id FROM usuarios WHERE nombre_usuario = 'admin'`).get();
  if (!admin) {
    const hash = require('crypto').createHash('sha256').update('admin123').digest('hex');
    db.prepare(`INSERT INTO usuarios (nombre_usuario, nombre_completo, password_hash, rol) VALUES ('admin', 'Administrador', ?, 'admin')`).run(hash);
  }

  // Insert default categories
  if (!db.prepare(`SELECT id FROM categorias LIMIT 1`).get()) {
    db.prepare(`INSERT INTO categorias (nombre) VALUES ('General')`).run();
    db.prepare(`INSERT INTO categorias (nombre) VALUES ('Abarrotes')`).run();
    db.prepare(`INSERT INTO categorias (nombre) VALUES ('Lácteos')`).run();
    db.prepare(`INSERT INTO categorias (nombre) VALUES ('Bebidas')`).run();
    db.prepare(`INSERT INTO categorias (nombre) VALUES ('Frutas y Verduras')`).run();
    db.prepare(`INSERT INTO categorias (nombre) VALUES ('Carnes')`).run();
    db.prepare(`INSERT INTO categorias (nombre) VALUES ('Limpieza')`).run();
  }

  // Insert default cajas
  if (!db.prepare(`SELECT id FROM cajas LIMIT 1`).get()) {
    db.prepare(`INSERT INTO cajas (nombre) VALUES ('Caja Principal')`).run();
  }

  // Insert default proveedores
  if (!db.prepare(`SELECT id FROM proveedores LIMIT 1`).get()) {
    db.prepare(`INSERT INTO proveedores (nombre, telefono, email, direccion) VALUES ('Proveedor General', '555-0000', 'proveedor@email.com', 'Dirección principal')`).run();
  }

  // Insert default config
  db.exec(`
    INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('descuento_maximo', '30');
    INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('empresa_nombre', 'Mi Tienda');
    INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('ticket_pie', 'Gracias por su compra');
    INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('version', 'basic');
  `);
}

function setDbPath(dbPath) {
  if (!dbPath || !dbPath.trim()) {
    fs.rmSync(configPath(), { force: true });
    return {};
  }
  const p = dbPath.trim();
  // Validar que la ruta no sea relativa (UNC \\server\share\nexbit.db o C:\...)
  if (!path.isAbsolute(p)) throw new Error('La ruta debe ser absoluta (ej: \\\\SERVIDOR\\carpeta\\nexbit.db)');
  // Validar que el directorio exista y sea escribible (prueba con archivo temporal)
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) throw new Error(`El directorio no existe: ${dir}`);
  const probe = path.join(dir, `.nexbit-write-test-${Date.now()}.tmp`);
  try {
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
  } catch (e) {
    throw new Error(`Sin permisos de escritura en: ${dir}`);
  }
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify({ path: p }));
  return p;
}

function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

function query(sql, params = []) {
  return db.prepare(sql).all(...params);
}

function run(sql, params = []) {
  const result = db.prepare(sql).run(...params);
  return result.lastInsertRowid;
}

function getLastInsertId() {
  // Last insert id is captured via run(); also readable from sqlite
  return db.prepare('SELECT last_insert_rowid() AS id').get().id;
}

module.exports = { initDatabase, getDb, getDbPath, setDbPath, query, run, getLastInsertId };
