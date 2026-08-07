# Next Byte — Guía Técnica de Despliegue

Documento para el integrador/instalador. Cubre la arquitectura, requisitos de red/hardware y el despliegue multi-caja en producción.

---

## 1. Arquitectura

- **Aplicación**: Electron (Windows x64), instalador NSIS o versión portable.
- **Base de datos**: SQLite (`better-sqlite3`) con journal mode WAL y `busy_timeout` para tolerar una venta.
- **Licencias**: códigos firmados con clave Ed25519 (`payload.firma`), validados contra un identificador de hardware (`fingerprint`). Planes: `basic` (1x1), `pro` (1x2 + premium), `multi` (4x4 + premium). Vigencia anual o de por vida (`expira`).
- **Actualizaciones**: `electron-updater` contra GitHub Releases (`latest.yml` + instalador + blockmap).

### Ubicación de datos

- BD principal: `%APPDATA%/nexbit-pos/nexbit.db` (+ `-wal` / `-shm` en modo WAL).

---

## 2. Despliegue de 1 caja (Basic / Pro)

1. Instalar `Nexbit-POS-Setup-<version>.exe` en el equipo del negocio.
2. Activar: *Configuración → Licencia* → pegar el código del plan comprado.
3. Usuario admin por defecto `admin` / `admin123` — **cambiar en producción**.
4. Configurar impresión, balanza y opciones según el cliente.

Sin internet la venta normal funciona; sólo las actualizaciones requieren salida a GitHub.

---

## 3. Despliegue Multi-Cajas (plan 4 cajas)

### Topología

```
                    [ROUTER]   (puede operar sin internet)
                    |   |   |
            [Caja 1]  [Caja 2] ... [Caja 4]
                    |   |
              [PC SERVIDOR]  (carpeta compartida con la BD)
```

Todas las cajas usan **la misma base de datos** en la carpeta compartida del servidor (SMB local).

### Pasos

1. **PC servidor**: crear una carpeta y compartirla en la red con permisos de **lectura/escritura** para las cajas (ruta tipo `\\SERVIDOR\carpeta\nexbit.db`).
2. **Cada caja**: instalar la aplicación y apuntar la base de datos a la ruta compartida. (La migración a `better-sqlite3`+WAL ya está hecha; el selector de ruta de conexión es el paso pendiente antes de vender multi-caja.)
3. Verificar vendiento desde 2 cajas a la vez y que ambas vean el mismo stock/ventas.

### Requisitos obligatorios

- **Red cableada (Ethernet)** obligatoria: NO se respalda el funcionamiento por WiFi.
- **PC servidor siempre encendido** mientras haya una caja activa.
- **Máximo 4 cajas** concurrentes (lo define el plan).
- Carpeta compartida **sin acceso desde internet**.
- Todos los equipos dentro de la misma red local.

### WAL y red de archivos (importante)

- En redes SMB/CIFS los archivos `-wal`/`-shm` usan bloqueos compartidos cuya fiabilidad depende del servidor. Se recomienda probar en la red real del cliente; si aparecen candados ("database is locked"), cambiar el journal a `DELETE` en el servidor. El despliegue multi-caja NO se cierra hasta validar una de las dos opciones contra 2 equipos físicos.

### Backups

- **Botón integrado (plan Pro):** en *Configuración → Respaldo de Base de Datos*, el botón abre un diálogo de guardado y ejecuta `db.backup()` de better-sqlite3: copia consistente sin necesidad de cerrar la app (usa el backup API nativo de SQLite, correcto incluso con WAL activo). El respaldo incluye toda la información.
- En **multi-caja**, el respaldo se hace **en el servidor** (toda la base vive ahí). El botón de la app crea la copia; llévela a pendrive o disco externo con la app abierta o cerrada, da igual: el backup API garantiza consistencia.

---

## 4. Seguridad

- Cambiar credenciales por defecto.
- Permisos de la carpeta compartida: solo las cajas del negocio.
- No exponer la carpeta a internet; SMB solo dentro de la red local.
- Respaldo diario (o más frecuente si se requiere).

---

## 5. Prueba de aceptación (multi-caja)

1. Dos equipos en red cableada apuntando a la misma BD compartida.
2. Abrir caja en ambos y vender en paralelo:
   - Stock descontado en ambas (consistencia en tiempo real).
   - Sin errores de "database is locked".
   - Cierre de caja correcto en cada una.
3. Respaldo/restauración: copiar `nexbit.db` con la app cerrada y verificar apertura (integridad OK).
4. Apagón del servidor en plena venta: la app debe mostrar error reparable (no corromper la BD).

> **Pendiente**: validación en red real (SMB locking) con 2 equipos físicos antes de declarar el multi-caja cerrado.

---

## 6. FAQ técnica

| Pregunta | Respuesta |
|---|---|
| ¿Por qué no WiFi? | La escritura compartida depende de bloqueos de archivo; el WiFi pierde micro-interrupciones que en el momento justo pueden fallar una venta. |
| ¿El servidor se apaga de noche? | Sí, si no hay cajas operando. Regla: servidor encendido mientras haya una caja activa. |
| ¿Internet necesaria para operar? | No para el día a día; solo para actualizar la aplicación. |
| ¿Qué pasa si se corta la luz en el servidor mid-venta? | La escritura en curso puede fallar; la app muestra error. Por eso el requisito de servidor estable y backup. |