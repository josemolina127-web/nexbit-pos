# Nexbit POS Web (versión cPanel) — Instalador automático

## Qué es
La misma app Nexbit POS (misma UI React) pero corriendo en navegador con backend PHP + MySQL en cPanel. **No toca la app de escritorio** (vive en `web/` y `dist-web/`).

## Estructura
```
web/
  schema.sql        # DDL MySQL + seeds (categorías, caja principal, licencia demo); el admin lo crea el instalador
  api/index.php     # Backend PHP completo (incluye acciones install.* del instalador)
  api/config.generated.php  # Creado por el instalador al conectar la BD; se crea solo, no se sube
  api/schema.sql    # Copia de schema.sql usada por install.applyDb
  tools/gen-license.js  # Genera códigos de licencia firmados (node web/tools/gen-license.js [plan cajas usuarios cliente])
  adapter.js        # window.nexbit -> fetch a la API (reemplaza el IPC de Electron)
  InstallerWizard.jsx# Instalador estilo WordPress: licencia -> BD -> admin -> usuarios -> cajas
  main.web.jsx      # Entry point web (importa adapter + UI desktop)
  index.html        # Template del build (incluye Manrope self-hosted)
  vite.config.web.js# Build Vite separado (no toca el de Electron)
  smoke.js          # Smoke test que instala desde cero y prueba toda la API
  router.local.php  # SOLO prueba local; NO subir a producción
```

## Cómo subir a cPanel (una vez) — el cliente no toca nada de esto
1. **Base de datos**: cPanel → Bases de datos MySQL → crear BD + usuario (puede quedar vacía, el instalador la llena).
2. **Archivos**: subir el contenido de `dist-web/` a `public_html/` (INCLUYE `api/`, el instalador crea todo solo). NO subir `web/` ni `router.local.php`.
3. **Reparar build** por si cambias la UI en el futuro:
   ```
   npx vite build --config web/vite.config.web.js
   Copy-Item -Recurse web/api dist-web/api   # el build borra dist-web: vuelve a copiar el backend
   ```
   y sube `dist-web/` otra vez.
4. **El cliente abre el dominio** → el instalador le pide: código de licencia → datos de la BD → crear admin → (opcional) usuarios → cajas → entra al POS. La app crea tablas, seeds, admin y cajas automáticamente (`install.*`).

## Actualizar la web (ya instalada) — de ahora en adelante
El build usa **nombres de archivo fijos** (`assets/app.js`, sin hash) y el `.htaccess` desactiva la cache del navegador: una actualización es *sobreescribir los mismos archivos*, no hay nada que borrar.

1. **Configura los datos FTP una sola vez** en `ftp-config.txt` (cPanel → FTP Accounts; `RUTA=/public_html`).
2. **Cada cambio** → publicar:
   ```
   empaquetar.bat    # compila + deja dist-web/ listo (también regenera nexbit-pos-web.zip)
   subir.bat         # sube solo los archivos nuevos por FTP (sobreescribe, crea carpetas)
   ```
3. **Cambios de base de datos**: crea `web/api/migraciones/002-algo.sql` (y copia a `dist-web/api/migraciones/`). Al subirlo, el backend lo aplica solo una vez (tabla `migraciones`) — orden alfabético del nombre, `;` separa sentencias, `--` comenta líneas.
4. **El cliente recarga con Ctrl+F5** y ya tiene la versión nueva (las migraciones se aplican solas en el primer request).

Ojo: `api/config.generated.php` y `api/router.local.php` son locales y `subir.bat` los salta automáticamente.

## Actualización automática por botón (repo GitHub privado)
El cliente (dale el botón **Config → Actualizaciones → Actualizar ahora**) se actualiza solo: descarga `nexbit-pos-web.zip` desde el repo, reemplaza los archivos y aplica las migraciones de BD automáticamente. **El repo debe ser PRIVADO** (el backend contiene `LICENSE_SECRET`).

**Una vez (proveedor):**
```
git init update-repo
git -C update-repo add -A
git -C update-repo commit -m "inicial"
gh repo create nexbit-pos-web --private --source update-repo --push    # o crea el repo en github.com y agrega el remote a mano
```

**Cada cambio → publicar:**
```
publicar.bat    # sube version.json (v+1), compila el zip y hace git push
```

**Por cliente (una vez):** nada. El zip ya trae `api/config.proveedor.php` con el repo y token del proveedor; el backend lo mezcla con `config.generated.php` (solo credenciales de BD, que escribe el instalador). En instalaciones viejas, subir el zip nuevo ya deja todo listo.

Alternativa opcional: `'github_base' => 'https://tudominio.com/updates'` (deben existir `/version.json` y `/nexbit-pos-web.zip`) en `config.generated.php` para alojar el zip en tu propio servidor en vez de GitHub.

El backend nunca sobrescribe `config.generated.php` ni `router.local.php` (datos locales de la BD). Las versiones se comparan con `version.json` (`{"version": N}`, sin BOM, JSON válido); si la publicada es mayor, el botón ofrece actualizar. Prueba local: apunta `github_base` a un servidor estático con ambos archivos.

## Emitir licencias (proveedor)
```
node web/tools/gen-license.js basic 1 2 CLIENTE-X
node web/tools/gen-license.js multi 4 10 CLIENTE-A      # imprime el código: plan:cajas:usuarios:cliente:hmac
```
El secreto vive en `web/api/index.php` (`LICENSE_SECRET`). La app también puede emitir desde Configuración → Licencias (`license.create`, admin, requiere un código firmado válido con los datos correctos).

## Probar local (sin servidor web)
Requiere Laragon (o PHP+MySQL). La BD debe existir pero puede estar vacía: el smoke la instala sola.
```powershell
# 1. BD (vacía basta)
mysql -u root -e "CREATE DATABASE IF NOT EXISTS nexbit_pos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. API + UI
npx vite build --config web/vite.config.web.js
Copy-Item -Recurse web/api dist-web/api   # IMPORTANTE: el build borra dist-web, hay que volver a copiar el backend
php -S 127.0.0.1:8787 -t dist-web
# abrir http://127.0.0.1:8787/   (con BD vacía verás el instalador)
```

## Smoke test de la API (instala desde cero, ~64 checks)
```
node web/smoke.js
```
(usa el PHP de Laragon; revisa la ruta `PHP` al inicio del archivo; recrea la BD `nexbit_pos` vacía y pasa por: applyDb → saveLicense → createAdmin → createUsers → createCajas → login → todas las fases).

## Licencias web
- Los códigos están **firmados** (HMAC-SHA256 de `plan:cajas:usuarios:cliente`). `verifyLicense()` rechaza códigos sin firma válida.
- `license.activate(codigo)` cambia la licencia activa; los límites se aplican al crear cajas y usuarios.
- Sin licencia activa la app queda en plan "demo" (1 caja / 2 usuarios, `activated: false`). El seed instala `multi:4:10:DEMO:23782e1f096e` pre-activada.

## Alcance
**Funciona**: login/usuarios/permisos, productos/categorías/proveedores, venta (POS) con stock + caja + sesiones, clientes/abonos, reportes diarios/ganancias/top, inventario completo (alertas, ajustes, movimientos, recibos de mercancía con edición/borrado), devoluciones (reintegran stock y generan crédito a clientes), cupones (CRUD + usos + agotamiento), descuentos por cantidad (CRUD por producto), grupos/combos (CRUD con items), métricas de cajas/cajeros, boletas (folio correlativo), SII/escala/impresora (config persistente en BD).

**Stubs (funcionalidad desktop que no aplica en web)**: impresión térmica (no-op; en web se imprime con el navegador), lectura de báscula (0 simulado, config persistida), multi-caja local SMB (no aplica, en web todas las cajas ven la misma BD por internet), backup local (error claro; usar backup del hosting), app.restart/copy (no-op).

## Impresión térmica y báscula
La web no puede hablar directo con la impresora USB ni el puerto COM; se usa un **agente local** por PC de caja:
```
# en cada PC de caja (una vez):
web\agent\start-agent.bat        # o: node web/agent/print-agent.js
```
- **Impresión**: el agente escucha en `127.0.0.1:9777` y lista/usa las impresoras de Windows (PowerShell `Out-Printer`). Config → Impresora muestra las impresoras reales y "Probar" imprime; cada venta/cierre de caja imprime por la predeterminada (o la elegida en Config SII).
- **Báscula (RS232)**: el agente lee el peso del puerto COM configurado (`.NET SerialPort`, baud 9600, 8N1). Configura el puerto en Config → Báscula; el botón ⚖️ Pesar del POS muestra el peso. La config vive en `web/agent/scale.json` (por PC, no en la BD).
- Sin agente, la app no crashea: no imprime y el peso muestra "Báscula no disponible".

## Limitaciones conocidas
- Una sola BD central: trabajan todas las cajas desde cualquier navegador (ventaja sobre SMB).
- Sin trabajo offline (necesita internet).