-- 002: tabla app_meta para el sistema de actualizaciones (boton Actualizar de Config)
-- Las instalaciones nuevas ya la traen en schema.sql; esta migracion cubre las existentes.
CREATE TABLE IF NOT EXISTS app_meta (
  clave VARCHAR(50) NOT NULL PRIMARY KEY,
  valor VARCHAR(200) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO app_meta (clave, valor) VALUES ('app_version', '1');