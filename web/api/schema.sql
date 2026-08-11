-- Nexbit POS - Esquema MySQL para version web (cPanel)
-- Ejecutar una sola vez en phpMyAdmin (Base de datos -> SQL)

CREATE TABLE IF NOT EXISTS categorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS proveedores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  telefono VARCHAR(50),
  email VARCHAR(150),
  direccion VARCHAR(250),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS productos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo_barras VARCHAR(64) UNIQUE,
  nombre VARCHAR(200) NOT NULL,
  precio_venta DECIMAL(12,3) NOT NULL DEFAULT 0,
  precio_costo DECIMAL(12,3) NOT NULL DEFAULT 0,
  stock DECIMAL(12,3) NOT NULL DEFAULT 0,
  stock_minimo DECIMAL(12,3) NOT NULL DEFAULT 0,
  categoria_id INT,
  unidad_medida VARCHAR(20) NOT NULL DEFAULT 'pieza',
  activo TINYINT NOT NULL DEFAULT 1,
  imagen TEXT NULL,
  proveedor_id INT,
  en_promocion TINYINT DEFAULT 0,
  precio_promo DECIMAL(12,3),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_productos_categoria (categoria_id),
  INDEX idx_productos_proveedor (proveedor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre_usuario VARCHAR(80) NOT NULL UNIQUE,
  nombre_completo VARCHAR(150) NOT NULL,
  password_hash VARCHAR(64) NOT NULL,
  rol VARCHAR(20) NOT NULL DEFAULT 'cajero',
  activo TINYINT NOT NULL DEFAULT 1,
  caja_id INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS permisos_usuario (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  permiso VARCHAR(60) NOT NULL,
  valor TINYINT NOT NULL DEFAULT 1,
  UNIQUE (usuario_id, permiso)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS clientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  telefono VARCHAR(50),
  correo VARCHAR(150),
  direccion VARCHAR(250),
  saldo_pendiente DECIMAL(12,3) NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ventas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total DECIMAL(12,3) NOT NULL DEFAULT 0,
  descuento DECIMAL(12,3) NOT NULL DEFAULT 0,
  forma_pago VARCHAR(30) NOT NULL DEFAULT 'efectivo',
  detalle_pago TEXT,
  cliente_id INT,
  usuario_id INT,
  caja_id INT,
  anulada TINYINT NOT NULL DEFAULT 0,
  motivo_anulacion VARCHAR(250),
  sincronizado TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ventas_fecha (fecha),
  INDEX idx_ventas_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ventas_detalle (
  id INT AUTO_INCREMENT PRIMARY KEY,
  venta_id INT NOT NULL,
  producto_id INT,
  nombre_producto VARCHAR(200) NOT NULL,
  cantidad DECIMAL(12,3) NOT NULL DEFAULT 1,
  precio_unitario DECIMAL(12,3) NOT NULL,
  descuento DECIMAL(12,3) NOT NULL DEFAULT 0,
  subtotal DECIMAL(12,3) NOT NULL,
  INDEX idx_detalle_venta (venta_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cajas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  activa TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sesiones_caja (
  id INT AUTO_INCREMENT PRIMARY KEY,
  caja_id INT NOT NULL,
  usuario_id INT NOT NULL,
  inicio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fin DATETIME,
  activa TINYINT NOT NULL DEFAULT 1,
  INDEX idx_sesiones_caja (caja_id, activa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS grupos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  precio DECIMAL(12,3) NOT NULL DEFAULT 0,
  activo TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS grupo_detalles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grupo_id INT NOT NULL,
  producto_id INT NOT NULL,
  cantidad DECIMAL(12,3) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  cantidad DECIMAL(12,3) NOT NULL,
  stock_anterior DECIMAL(12,3) NOT NULL,
  stock_nuevo DECIMAL(12,3) NOT NULL,
  precio_costo DECIMAL(12,3),
  referencia VARCHAR(250),
  usuario_id INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_mov_producto (producto_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS abonos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  venta_id INT,
  monto DECIMAL(12,3) NOT NULL,
  usuario_id INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cortes_caja (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fecha_apertura DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_cierre DATETIME,
  monto_inicial DECIMAL(12,3) NOT NULL DEFAULT 0,
  monto_ventas DECIMAL(12,3) NOT NULL DEFAULT 0,
  monto_final DECIMAL(12,3),
  usuario_id INT,
  cerrado TINYINT NOT NULL DEFAULT 0,
  observaciones VARCHAR(250),
  caja_id INT,
  reporte_json TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS auditoria (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT,
  accion VARCHAR(60) NOT NULL,
  detalle TEXT,
  valores_anteriores TEXT,
  valores_nuevos TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS devoluciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  venta_id INT,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total DECIMAL(12,3) NOT NULL DEFAULT 0,
  motivo VARCHAR(250),
  usuario_id INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS devoluciones_detalle (
  id INT AUTO_INCREMENT PRIMARY KEY,
  devolucion_id INT NOT NULL,
  producto_id INT,
  nombre_producto VARCHAR(200) NOT NULL,
  cantidad DECIMAL(12,3) NOT NULL DEFAULT 1,
  precio_unitario DECIMAL(12,3) NOT NULL,
  subtotal DECIMAL(12,3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS documentos_entrada (
  id INT AUTO_INCREMENT PRIMARY KEY,
  referencia VARCHAR(150) NOT NULL,
  proveedor_id INT,
  proveedor_nombre VARCHAR(150) DEFAULT '',
  total_items INT DEFAULT 0,
  usuario_id INT,
  items_json TEXT,
  created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS configuracion (
  clave VARCHAR(80) PRIMARY KEY,
  valor TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS boletas_emitidas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  folio INT NOT NULL,
  tipo_dte VARCHAR(10) DEFAULT '39',
  total DECIMAL(12,3) DEFAULT 0,
  rut_cliente VARCHAR(30) DEFAULT '',
  razon_social_cliente VARCHAR(200) DEFAULT '',
  xml_response TEXT,
  created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cupones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(60) NOT NULL UNIQUE,
  tipo VARCHAR(20) NOT NULL DEFAULT 'porcentaje',
  tipo_aplicacion VARCHAR(20) DEFAULT 'todos',
  valor DECIMAL(12,3) NOT NULL DEFAULT 0,
  min_compra DECIMAL(12,3) DEFAULT 0,
  producto_id INT,
  categoria_id INT,
  productos_ids TEXT,
  vigencia_desde VARCHAR(20),
  vigencia_hasta VARCHAR(20),
  usos_maximos INT DEFAULT 0,
  usos_actuales INT DEFAULT 0,
  activo TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS descuentos_cantidad (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT,
  tipo VARCHAR(20) DEFAULT 'precio_fijo',
  reglas TEXT NOT NULL,
  activo TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== Licencias web =====
CREATE TABLE IF NOT EXISTS licencias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(60) NOT NULL UNIQUE,
  plan VARCHAR(20) NOT NULL DEFAULT 'multi',
  max_cajas INT NOT NULL DEFAULT 1,
  max_usuarios INT NOT NULL DEFAULT 2,
  activo TINYINT NOT NULL DEFAULT 0,
  activated_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== Seed inicial =====

-- Control de intentos de login fallidos (por IP): 5 fallos -> bloqueo 5 minutos
CREATE TABLE IF NOT EXISTS login_intentos (
  ip VARCHAR(45) NOT NULL PRIMARY KEY,
  intentos INT NOT NULL DEFAULT 0,
  bloqueo_hasta DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Version de la app instalada (la sube el boton Actualizar de Config)
CREATE TABLE IF NOT EXISTS app_meta (
  clave VARCHAR(50) NOT NULL PRIMARY KEY,
  valor VARCHAR(200) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO app_meta (clave, valor) VALUES ('app_version', '1');
-- El admin lo crea el instalador (paso obligatorio: install.createAdmin)
INSERT INTO categorias (nombre) VALUES ('General') ON DUPLICATE KEY UPDATE nombre = nombre;
INSERT INTO categorias (nombre) VALUES ('Abarrotes') ON DUPLICATE KEY UPDATE nombre = nombre;
INSERT INTO categorias (nombre) VALUES ('Lácteos') ON DUPLICATE KEY UPDATE nombre = nombre;
INSERT INTO categorias (nombre) VALUES ('Bebidas') ON DUPLICATE KEY UPDATE nombre = nombre;
INSERT INTO categorias (nombre) VALUES ('Frutas y Verduras') ON DUPLICATE KEY UPDATE nombre = nombre;
INSERT INTO categorias (nombre) VALUES ('Carnes') ON DUPLICATE KEY UPDATE nombre = nombre;
INSERT INTO categorias (nombre) VALUES ('Limpieza') ON DUPLICATE KEY UPDATE nombre = nombre;

INSERT INTO cajas (nombre) SELECT 'Caja Principal' WHERE NOT EXISTS (SELECT 1 FROM cajas);
INSERT INTO proveedores (nombre, telefono, email, direccion) SELECT 'Proveedor General', '555-0000', 'proveedor@email.com', 'Dirección principal' WHERE NOT EXISTS (SELECT 1 FROM proveedores);

-- Licencia demo pre-activada (multi 4 cajas / 10 usuarios); misma capacidad que el plan fijo anterior
INSERT INTO licencias (codigo, plan, max_cajas, max_usuarios, activo, activated_at)
SELECT 'multi:4:10:DEMO:23782e1f096e', 'multi', 4, 10, 1, NOW()
WHERE NOT EXISTS (SELECT 1 FROM licencias);

INSERT INTO configuracion (clave, valor) VALUES
  ('descuento_maximo', '30'),
  ('empresa_nombre', 'Mi Tienda'),
  ('ticket_pie', 'Gracias por su compra'),
  ('version', 'basic')
ON DUPLICATE KEY UPDATE clave = clave;