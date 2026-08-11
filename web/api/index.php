<?php
// Nexbit POS Web API - Fase 1 MVP
// Configura aqui las credenciales de MySQL de tu cPanel.
// Para probar local: php -S localhost:8787 -t web
// Luego en un navegador (o curl) haz POST a /api/index.php con {action, args}

// Polyfills para cPanel con PHP 7.x (str_starts_with es de PHP 8.0)
if (!function_exists('str_starts_with')) {
  function str_starts_with($haystack, $needle) { return $needle === '' || strncmp($haystack, $needle, strlen($needle)) === 0; }
}
if (!function_exists('str_ends_with')) {
  function str_ends_with($haystack, $needle) { return $needle === '' || substr($haystack, -strlen($needle)) === $needle; }
}
if (!function_exists('str_contains')) {
  function str_contains($haystack, $needle) { return $needle === '' || strpos($haystack, $needle) !== false; }
}

const DB_HOST = 'localhost';
const DB_NAME = 'nexbit_pos';
const DB_USER = 'root';
const DB_PASS = '';
const ALLOW_ORIGIN = '*'; // cPanel: pon tu dominio, ej: 'https://pos.midominio.cl'

const ALL_PERMISSIONS = [
  'realizar_ventas','anular_ventas','aplicar_descuentos','corte_caja','gestionar_productos',
  'realizar_entradas','ajustar_stock','ver_reportes','gestionar_usuarios','cobrar_deudas',
  'ver_auditoria','realizar_devoluciones'
];

// Licencia web: plan y limites viven en la tabla `licencias` (ver license.activate / license.create).
function isAdmin() { global $user; return $user && $user['rol'] === 'admin'; }
function requireAdmin() { if (!isAdmin()) fail('Solo administrador'); }

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . ALLOW_ORIGIN);
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

// ---- config de BD: el instalador escribe config.generated.php al estilo WordPress ----
$DB_CONFIG = ['host' => DB_HOST, 'name' => DB_NAME, 'user' => DB_USER, 'pass' => DB_PASS];
$CONFIG_FILE = __DIR__ . '/config.generated.php';
if (file_exists($CONFIG_FILE)) $DB_CONFIG = require $CONFIG_FILE;
// Config del proveedor (repo de actualizaciones): viaja en el zip, vale para
// todos los clientes -> las instalaciones nuevas no necesitan editar nada.
$PROV_FILE = __DIR__ . '/config.proveedor.php';
if (file_exists($PROV_FILE)) { $prov = require $PROV_FILE; if (is_array($prov)) $DB_CONFIG = array_merge($DB_CONFIG, $prov); }

function connectDb($cfg) {
  return new PDO(
    'mysql:host=' . $cfg['host'] . ';dbname=' . $cfg['name'] . ';charset=utf8mb4',
    $cfg['user'], $cfg['pass'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
  );
}

$pdo = null;
$DB_ERROR = null;
try { $pdo = connectDb($DB_CONFIG); } catch (Throwable $e) { $DB_ERROR = $e->getMessage(); }

// ---- helpers ----
function q($sql, $params = []) { global $pdo; $st = $pdo->prepare($sql); $st->execute($params); return $st->fetchAll(PDO::FETCH_ASSOC); }
function one($sql, $params = []) { $r = q($sql, $params); return $r ? $r[0] : null; }
function run($sql, $params = []) { global $pdo; $st = $pdo->prepare($sql); $st->execute($params); return (int)$pdo->lastInsertId(); }
function hashPassword($pw) { return hash('sha256', $pw); }

// MySQL devuelve DECIMAL como string ("3400.000"); la UI necesita numeros.
// Convierte a float las columnas numericas conocidas (recursivo).
function numify(&$data) {
  $NUM = ['total','monto','precio_venta','precio_costo','stock','stock_minimo','saldo_pendiente','cantidad',
    'subtotal','monto_inicial','monto_final','monto_ventas','descuento','valor','ventas','costo','ganancia',
    'precio_unitario','precio_promedio','ingresos','ticket_promedio','total_items','valor_total','monto_total',
    'total_descuentos','total_ventas','precio_promo','alertasCount','anulada'];
  if (is_array($data)) {
    foreach ($data as $k => &$v) {
      if (is_array($v)) { numify($v); }
      elseif (is_string($v) && is_numeric($v) && in_array($k, $NUM, true) && $k !== '') { $v = (float)$v; }
    }
  }
}
function ok($data = true) { numify($data); echo json_encode(['ok' => true, 'data' => $data]); exit; }
function fail($msg) { http_response_code(400); echo json_encode(['ok' => false, 'error' => $msg]); exit; }
function normStock($v, $unit) { $n = (float)$v; return $unit === 'pieza' ? round($n) : round($n * 1000) / 1000; }
function planInfo() {
  global $pdo;
  $lic = one('SELECT * FROM licencias WHERE activo = 1 ORDER BY id DESC LIMIT 1');
  if (!$lic) return ['activated' => false, 'plan' => 'demo', 'max_cajas' => 1, 'max_usuarios' => 2, 'codigo' => null];
  return ['activated' => true, 'plan' => $lic['plan'], 'max_cajas' => (int)$lic['max_cajas'], 'max_usuarios' => (int)$lic['max_usuarios'], 'codigo' => $lic['codigo']];
}
function requireAuth() { global $user; if (!$user) fail('No autenticado'); }
function logAudit($usuarioId, $accion, $detalle) { run('INSERT INTO auditoria (usuario_id, accion, detalle) VALUES (?,?,?)', [$usuarioId, $accion, $detalle]); }

// ---- licencias firmadas (el proveedor emite con web/tools/gen-license.js) ----
const LICENSE_SECRET = 'nxb7Hq3mP9xL2vRs';
function verifyLicense($codigo) {
  $parts = explode(':', (string)$codigo);
  if (count($parts) !== 5) return null;
  [$plan, $cajas, $usuarios, $cliente, $hmac] = $parts;
  if (!in_array($plan, ['basic', 'pro', 'multi'], true)) return null;
  $payload = $plan . ':' . (int)$cajas . ':' . (int)$usuarios . ':' . $cliente;
  if (substr(hash_hmac('sha256', $payload, LICENSE_SECRET), 0, 12) !== $hmac) return null;
  return ['plan' => $plan, 'max_cajas' => (int)$cajas, 'max_usuarios' => (int)$usuarios, 'cliente' => $cliente];
}

// ejecuta un archivo .sql (esquema completo o una migracion suelta; idempotente)
function execSqlFile($path) {
  global $pdo;
  $sql = file_get_contents($path);
  foreach (preg_split('/;\s*\r?\n/', $sql) as $stmt) {
    $lines = array_filter(array_map('trim', explode("\n", $stmt)), fn($l) => $l !== '' && !str_starts_with($l, '--'));
    $stmt = trim(implode("\n", $lines));
    if ($stmt === '') continue;
    run($stmt);
  }
}
function installSchema() { execSqlFile(__DIR__ . '/schema.sql'); }

// sesion por cookie (same-origin; ALLOW_ORIGIN "*" + cookies: usar SameSite=Lax no requiere credenciales CORS)
// sesion larga: que un refresco despues de un rato no tire al login (hosting con GC corto)
ini_set('session.gc_maxlifetime', 28800);
session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax']);
session_start();

// Solo POST: el navegador deja de ver el API por GET/URL directa
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') { http_response_code(405); exit('{"ok":false,"error":"Método no permitido"}'); }

// Solo desde el dominio configurado (ALLOW_ORIGIN distinto de "*"): bloquea llamadas de otros sitios
if (ALLOW_ORIGIN !== '*' && !empty($_SERVER['HTTP_ORIGIN'])) {
  $perm = array_map('trim', explode(',', ALLOW_ORIGIN));
  if (!in_array(rtrim($_SERVER['HTTP_ORIGIN'], '/'), $perm)) { http_response_code(403); exit('{"ok":false,"error":"Origen no permitido"}'); }
}

$user = null;
if (!empty($_SESSION['user_id']) && $pdo) {
  $user = one('SELECT id, nombre_usuario, nombre_completo, rol FROM usuarios WHERE id = ? AND activo = 1', [$_SESSION['user_id']]);
}

// ---- migraciones: api/migraciones/001-*.sql se aplican solas al subir el archivo ----
// Cada archivo corre UNA vez (se registra en la tabla migraciones). Un archivo puede
// llevar varios CREATE/ALTER/INSERT separados por ";" y comentarios "--".
function applyMigrations() {
  global $pdo;
  try { run('CREATE TABLE IF NOT EXISTS migraciones (archivo VARCHAR(200) PRIMARY KEY, aplicada DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'); }
  catch (Throwable $e) { return; }
  $dir = __DIR__ . '/migraciones';
  if (!is_dir($dir)) return;
  $pendientes = [];
  foreach (glob($dir . '/*.sql') ?: [] as $f) $pendientes[basename($f)] = $f;
  ksort($pendientes); // orden alfabetico: 001-..., 002-...
  $hechas = array_column(q('SELECT archivo FROM migraciones'), 'archivo');
  foreach ($pendientes as $nombre => $f) {
    if (in_array($nombre, $hechas, true)) continue;
    try {
      execSqlFile($f);
      run('INSERT INTO migraciones (archivo, aplicada) VALUES (?, NOW())', [$nombre]);
    } catch (Throwable $e) {} // ponytail: migracion con error se salta, no bloquea la app
  }
}
applyMigrations();

// ---- actualizaciones automaticas desde GitHub (repo PRIVADO del proveedor) ----
// Repo = contenido de dist-web + version.json + nexbit-pos-web.zip en la raiz.
// Config: const GITHUB_REPO abajo, o por cliente en config.generated.php:
//   return ['host'=>..., 'name'=>..., 'user'=>..., 'pass'=>..., 'github_repo'=>'proveedor/nexbit-pos-web', 'github_token'=>'xxx'];
const GITHUB_REPO = ''; // ej: 'proveedor/nexbit-pos-web'
function fetchFromGithub($path) {
  global $DB_CONFIG;
  $repo = $DB_CONFIG['github_repo'] ?? GITHUB_REPO;
  $token = $DB_CONFIG['github_token'] ?? '';
  $base = $DB_CONFIG['github_base'] ?? '';
  if ($base === '' || $base === null) {
    if ($repo === '') return [null, null, 'Actualizaciones no configuradas (github_repo en config.generated.php)'];
    $url = 'https://raw.githubusercontent.com/' . $repo . '/main/' . $path;
  } else {
    $url = rtrim($base, '/') . '/' . $path; // github_base: servidor propio del proveedor
  }
  $headers = [];
  if ($token !== '') $headers[] = 'Authorization: Bearer ' . $token; // tokens fine-grained: solo por header
  $ctx = stream_context_create(['http' => ['method' => 'GET', 'header' => $headers, 'timeout' => 60, 'ignore_errors' => true]]);
  $raw = @file_get_contents($url, false, $ctx);
  if ($raw === false) return [null, null, 'No se pudo conectar con GitHub. Revisa la red y github_repo.'];
  $status = 0;
  foreach ($http_response_header ?? [] as $h) if (preg_match('#^HTTP/\S+\s+(\d+)#', $h, $m)) $status = (int)$m[1];
  if ($status === 401 || $status === 403) return [null, null, 'GitHub rechazo el acceso (HTTP ' . $status . '). Revisa github_token (repo privado) o permite "read all" al token.'];
  if ($status === 404) return [null, null, 'El archivo ' . $path . ' no esta en el repo (HTTP 404).'];
  if ($status >= 400) return [null, null, 'GitHub respondio HTTP ' . $status . '.'];
  return [$raw, $repo, null];
}
function appVersion() {
  global $pdo;
  try { run('CREATE TABLE IF NOT EXISTS app_meta (clave VARCHAR(50) PRIMARY KEY, valor VARCHAR(200) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'); } catch (Throwable $e) {
    return 1;
  }
  $v = one('SELECT valor FROM app_meta WHERE clave = ?', ['app_version']);
  return $v ? (int)$v['valor'] : 1;
}
function setAppVersion($v) {
  global $pdo;
  $ex = one('SELECT valor FROM app_meta WHERE clave = ?', ['app_version']);
  if ($ex) run('UPDATE app_meta SET valor = ? WHERE clave = ?', [(string)$v, 'app_version']);
  else run('INSERT INTO app_meta (clave, valor) VALUES (?, ?)', ['app_version', (string)$v]);
}
function rrmdir($dir) {
  if (!is_dir($dir)) return;
  foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST) as $f) {
    $f->isDir() ? rmdir($f->getPathname()) : unlink($f->getPathname());
  }
  rmdir($dir);
}
// reemplaza los archivos de la app con los del update; nunca toca config local
function copyTree($src, $dst) {
  foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($src, FilesystemIterator::SKIP_DOTS)) as $f) {
    $rel = substr($f->getPathname(), strlen($src) + 1);
    $base = basename($rel);
    if ($base === 'config.generated.php' || $base === 'router.local.php') continue;
    $target = $dst . '/' . $rel;
    if ($f->isDir()) { if (!is_dir($target)) mkdir($target, 0777, true); }
    else { @mkdir(dirname($target), 0777, true); @copy($f->getPathname(), $target); }
  }
}

function hasPermission($permiso) {
  global $user;
  if (!$user) return false;
  if ($user['rol'] === 'admin') return true;
  return !!one('SELECT 1 FROM permisos_usuario WHERE usuario_id = ? AND permiso = ? AND valor = 1', [$user['id'], $permiso]);
}
function requirePermission($permiso) { if (!hasPermission($permiso)) fail('Permiso denegado'); }

// ---- router ----
$body = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $body['action'] ?? '';
$args = $body['args'] ?? [];

try {
  if (!$pdo && !in_array($action, ['install.status', 'install.checkLicense', 'install.testDb', 'install.applyDb'], true)) {
    fail('Base de datos no configurada. Ejecuta el instalador (recarga la página).');
  }
  switch ($action) {

    // ============ INSTALADOR (estilo WordPress) ============
    case 'install.status': {
      $st = ['config' => (bool)$pdo, 'db' => false, 'licencia' => false, 'admin' => false, 'cajas' => false];
      if ($pdo) {
        $st['db'] = !!one("SHOW TABLES LIKE 'usuarios'");
        if ($st['db']) {
          $st['licencia'] = !!one('SELECT 1 FROM licencias WHERE activo = 1');
          $st['admin'] = !!one("SELECT 1 FROM usuarios WHERE rol = 'admin' AND activo = 1");
          $st['cajas'] = (int)one('SELECT COUNT(*) c FROM cajas')['c'] > 0;
        }
      }
      ok($st);
    }
    case 'install.checkLicense': {
      $v = verifyLicense($args[0] ?? '');
      if (!$v) fail('Código de licencia no válido. Verifica con tu proveedor.');
      ok($v + ['codigo' => $args[0]]);
    }
    case 'install.testDb': {
      $d = $args[0];
      try { connectDb(['host' => $d['host'], 'name' => $d['name'], 'user' => $d['user'], 'pass' => $d['pass'] ?? '']); }
      catch (Throwable $e) { fail('No se pudo conectar: ' . $e->getMessage()); }
      ok(true);
    }
    case 'install.applyDb': {
      $d = $args[0];
      $cfg = ['host' => $d['host'], 'name' => $d['name'], 'user' => $d['user'], 'pass' => $d['pass'] ?? ''];
      global $pdo;
      try { $pdo = null; $pdo = connectDb($cfg); }
      catch (Throwable $e) { fail('No se pudo conectar: ' . $e->getMessage()); }
      file_put_contents($CONFIG_FILE, "<?php\nreturn " . var_export($cfg, true) . ";\n");
      installSchema();
      ok(true);
    }
    case 'install.saveLicense': {
      $v = verifyLicense($args[0] ?? '');
      if (!$v) fail('Código de licencia no válido. Verifica con tu proveedor.');
      run('INSERT INTO licencias (codigo, plan, max_cajas, max_usuarios, activo, activated_at)
        VALUES (?,?,?,?,1,NOW())
        ON DUPLICATE KEY UPDATE plan = VALUES(plan), max_cajas = VALUES(max_cajas), max_usuarios = VALUES(max_usuarios), activo = 1, activated_at = NOW()',
        [$args[0], $v['plan'], $v['max_cajas'], $v['max_usuarios']]);
      run('UPDATE licencias SET activo = 0 WHERE codigo <> ?', [$args[0]]);
      ok(true);
    }
    case 'install.createAdmin': {
      $d = $args[0];
      if (empty($d['usuario']) || empty($d['password'])) fail('Ingresa usuario y contraseña');
      $exists = one('SELECT 1 FROM usuarios WHERE nombre_usuario = ?', [$d['usuario']]);
      if ($exists) fail('Ese nombre de usuario ya existe');
      $id = run('INSERT INTO usuarios (nombre_usuario, nombre_completo, password_hash, rol) VALUES (?,?,?,?)',
        [$d['usuario'], $d['nombre'] ?? $d['usuario'], hashPassword($d['password']), 'admin']);
      ok(['id' => (int)$id]);
    }
    case 'install.createUsers': {
      $n = 0;
      foreach (($args[0] ?? []) as $u) {
        if (empty($u['usuario']) || empty($u['password'])) continue;
        if (one('SELECT 1 FROM usuarios WHERE nombre_usuario = ?', [$u['usuario']])) continue;
        $rol = $u['rol'] ?? 'cajero';
        $id = run('INSERT INTO usuarios (nombre_usuario, nombre_completo, password_hash, rol) VALUES (?,?,?,?)',
          [$u['usuario'], $u['nombre'] ?? $u['usuario'], hashPassword($u['password']), $rol]);
        if ($rol === 'cajero') {
          run('INSERT INTO permisos_usuario (usuario_id, permiso, valor) VALUES (?,?,?)', [$id, 'realizar_ventas', 1]);
          run('INSERT INTO permisos_usuario (usuario_id, permiso, valor) VALUES (?,?,?)', [$id, 'aplicar_descuentos', 1]);
        } elseif ($rol === 'gerente') {
          foreach (ALL_PERMISSIONS as $p) run('INSERT INTO permisos_usuario (usuario_id, permiso, valor) VALUES (?,?,?)', [$id, $p, 1]);
        }
        $n++;
      }
      ok(['creados' => $n]);
    }
    case 'install.createCajas': {
      $raw = is_array($args[0] ?? null) ? $args[0] : $args;
      $nombres = array_values(array_unique(array_filter(array_map('trim', $raw))));
      if (!$nombres) fail('Crea al menos una caja');
      $ids = [];
      foreach ($nombres as $nombre) {
        if (one('SELECT 1 FROM cajas WHERE nombre = ?', [$nombre])) continue;
        $ids[] = (int)run('INSERT INTO cajas (nombre) VALUES (?)', [$nombre]);
      }
      if (!$ids && !one('SELECT 1 FROM cajas')) fail('No se pudo crear ninguna caja');
      ok(['ids' => $ids]);
    }

    // ============ AUTH ============
    case 'auth.login': {
      // tabla de seguridad; se crea sola en instalaciones antiguas
      run('CREATE TABLE IF NOT EXISTS login_intentos (ip VARCHAR(45) NOT NULL PRIMARY KEY, intentos INT NOT NULL DEFAULT 0, bloqueo_hasta DATETIME NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
      $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
      $bloqueo = one('SELECT bloqueo_hasta > NOW() AS activo, TIMESTAMPDIFF(SECOND, NOW(), bloqueo_hasta) AS segundos FROM login_intentos WHERE ip = ?', [$ip]);
      if ($bloqueo && $bloqueo['activo']) {
        fail('Has alcanzado el límite de intentos de inicio de sesión. Puedes volver a intentarlo en ' . (int)$bloqueo['segundos'] . ' segundos.');
      }
      $hash = hashPassword($args[1] ?? '');
      $u = one('SELECT id, nombre_usuario, nombre_completo, rol FROM usuarios WHERE nombre_usuario = ? AND password_hash = ? AND activo = 1', [$args[0], $hash]);
      if (!$u) {
        run('INSERT INTO login_intentos (ip, intentos, bloqueo_hasta) VALUES (?, 1, NULL) ON DUPLICATE KEY UPDATE intentos = intentos + 1, bloqueo_hasta = IF(intentos + 1 >= 5, DATE_ADD(NOW(), INTERVAL 5 MINUTE), bloqueo_hasta)', [$ip]);
        $int = one('SELECT intentos FROM login_intentos WHERE ip = ?', [$ip]);
        if ((int)$int['intentos'] >= 5) fail('Has alcanzado el límite de intentos de inicio de sesión. Puedes volver a intentarlo en 300 segundos.');
        fail('Usuario o contraseña incorrectos');
      }
      run('DELETE FROM login_intentos WHERE ip = ?', [$ip]);
      $_SESSION['user_id'] = $u['id'];
      logAudit($u['id'], 'login', 'Usuario ' . $u['nombre_usuario'] . ' inició sesión');
      ok($u);
    }
    case 'auth.logout': {
      if ($user) { run('UPDATE sesiones_caja SET activa = 0, fin = NOW() WHERE usuario_id = ? AND activa = 1', [$user['id']]); logAudit($user['id'], 'logout', 'Cierre de sesión'); }
      session_destroy();
      ok(true);
    }
    case 'auth.getCurrentUser': ok($user);
    case 'auth.getUserPermissions': {
      if (!$user) ok([]);
      if ($user['rol'] === 'admin') ok(array_fill_keys(ALL_PERMISSIONS, true));
      $perms = q('SELECT permiso, valor FROM permisos_usuario WHERE usuario_id = ?', [$user['id']]);
      $result = [];
      foreach ($perms as $p) $result[$p['permiso']] = (bool)$p['valor'];
      ok($result);
    }
    case 'auth.getUsers': { requireAuth(); return ok(q('SELECT id, nombre_usuario, nombre_completo, rol, activo FROM usuarios WHERE activo = 1 ORDER BY nombre_completo')); }
    case 'auth.createUser': {
      requireAuth();
      $data = $args[0];
      $count = one('SELECT COUNT(*) c FROM usuarios WHERE activo = 1')['c'];
      if ($count >= planInfo()['max_usuarios']) fail('Límite de usuarios alcanzado (' . planInfo()['max_usuarios'] . ')');
      $ex = one('SELECT id, activo FROM usuarios WHERE nombre_usuario = ?', [$data['nombre_usuario']]);
      if ($ex && (int)$ex['activo'] === 1) fail('Ese nombre de usuario ya existe. Elige otro.');
      if ($ex) {
        $id = (int)$ex['id'];
        run('UPDATE usuarios SET activo = 1, nombre_completo = ?, password_hash = ?, rol = ? WHERE id = ?',
          [$data['nombre_completo'], hashPassword($data['password']), $data['rol'] ?? 'cajero', $id]);
        run('DELETE FROM permisos_usuario WHERE usuario_id = ?', [$id]);
      } else {
        $id = run('INSERT INTO usuarios (nombre_usuario, nombre_completo, password_hash, rol) VALUES (?,?,?,?)',
          [$data['nombre_usuario'], $data['nombre_completo'], hashPassword($data['password']), $data['rol'] ?? 'cajero']);
      }
      $perms = ($data['permisos'] ?? null);
      if (!$perms) $perms = $data['rol'] === 'cajero' ? ['realizar_ventas' => 1, 'aplicar_descuentos' => 1] : ($data['rol'] === 'gerente' ? array_fill_keys(ALL_PERMISSIONS, 1) : []);
      foreach ($perms as $permiso => $valor) run('INSERT INTO permisos_usuario (usuario_id, permiso, valor) VALUES (?,?,?)', [$id, $permiso, $valor ? 1 : 0]);
      logAudit($user['id'], 'crear_usuario', 'Usuario creado: ' . $data['nombre_usuario']);
      ok(['id' => $id] + $data);
    }
    case 'auth.updateUser': {
      requireAuth();
      $data = $args[1] ?? [];
      if (!empty($data['password'])) run('UPDATE usuarios SET nombre_completo = ?, rol = ?, password_hash = ? WHERE id = ?', [$data['nombre_completo'], $data['rol'], hashPassword($data['password']), $args[0]]);
      else run('UPDATE usuarios SET nombre_completo = ?, rol = ? WHERE id = ?', [$data['nombre_completo'], $data['rol'], $args[0]]);
      if (!empty($data['permisos'])) foreach ($data['permisos'] as $permiso => $valor)
        run('INSERT INTO permisos_usuario (usuario_id, permiso, valor) VALUES (?,?,?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)', [$args[0], $permiso, $valor ? 1 : 0]);
      ok(true);
    }
    case 'auth.deleteUser': {
      requirePermission('gestionar_usuarios');
      $target = one('SELECT nombre_usuario, rol, activo FROM usuarios WHERE id = ?', [$args[0]]);
      if (!$target) fail('Usuario no encontrado');
      if ($target['rol'] === 'admin') fail('No se puede eliminar un usuario admin');
      if ($user['id'] === (int)$args[0]) fail('No puedes eliminar tu propio usuario');
      run('UPDATE sesiones_caja SET activa = 0, fin = NOW() WHERE usuario_id = ? AND activa = 1', [$args[0]]);
      run('UPDATE usuarios SET activo = 0 WHERE id = ?', [$args[0]]);
      logAudit($user['id'], 'eliminar_usuario', 'Usuario eliminado (desactivado): ' . $target['nombre_usuario']);
      ok(true);
    }

    // ============ LICENSE (real: tabla licencias) ============
    case 'license.getStatus': ok(planInfo());
    case 'license.activate': {
      $codigo = trim($args[0] ?? '');
      if (!$codigo) fail('Código de licencia requerido');
      $v = verifyLicense($codigo);
      if (!$v) fail('Código de licencia no válido. Verifica con tu proveedor.');
      run('INSERT INTO licencias (codigo, plan, max_cajas, max_usuarios, activo, activated_at)
        VALUES (?,?,?,?,1,NOW())
        ON DUPLICATE KEY UPDATE plan = VALUES(plan), max_cajas = VALUES(max_cajas), max_usuarios = VALUES(max_usuarios), activo = 1, activated_at = NOW()',
        [$codigo, $v['plan'], $v['max_cajas'], $v['max_usuarios']]);
      run('UPDATE licencias SET activo = 0 WHERE codigo <> ?', [$codigo]);
      logAudit($user['id'], 'activar_licencia', 'Licencia activada: ' . $codigo);
      ok(planInfo());
    }
    case 'license.list': {
      $p = planInfo();
      ok(['actual' => $p, 'licencias' => q('SELECT id, codigo, plan, max_cajas, max_usuarios, activo, activated_at, created_at FROM licencias ORDER BY id DESC')]);
    }
    case 'license.create': {
      $d = $args[0];
      $id = run('INSERT INTO licencias (codigo, plan, max_cajas, max_usuarios) VALUES (?,?,?,?)',
        [$d['codigo'], $d['plan'] ?? 'multi', $d['max_cajas'] ?? 1, $d['max_usuarios'] ?? 2]);
      logAudit($user['id'], 'crear_licencia', 'Licencia creada: ' . $d['codigo']);
      ok(['id' => (int)$id]);
    }
    case 'license.delete': { run('DELETE FROM licencias WHERE id = ?', [$args[0]]); ok(true); }
    case 'config.getVersion': {
      $p = planInfo();
      ok($p['activated'] ? $p['plan'] : 'demo');
    }
    case 'config.getMaxCajas': {
      $p = planInfo();
      ok($p['max_cajas']);
    }

    // ============ PRODUCTS ============
    case 'products.getAll': {
      $f = $args[0] ?? [];
      $sql = 'SELECT p.*, c.nombre categoria_nombre, pr.nombre proveedor_nombre FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id LEFT JOIN proveedores pr ON p.proveedor_id = pr.id WHERE 1=1';
      $params = [];
      if (isset($f['activo'])) { $sql .= ' AND p.activo = ?'; $params[] = $f['activo']; }
      if (!empty($f['categoria_id'])) { $sql .= ' AND p.categoria_id = ?'; $params[] = $f['categoria_id']; }
      if (!empty($f['proveedor_id'])) { $sql .= ' AND p.proveedor_id = ?'; $params[] = $f['proveedor_id']; }
      if (!empty($f['stock_bajo'])) $sql .= ' AND p.stock <= p.stock_minimo';
      $sql .= ' ORDER BY p.nombre';
      ok(q($sql, $params));
    }
    case 'products.get': ok(one('SELECT p.*, c.nombre categoria_nombre, pr.nombre proveedor_nombre FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id LEFT JOIN proveedores pr ON p.proveedor_id = pr.id WHERE p.id = ?', [$args[0]]));
    case 'products.search': {
      $s = '%' . $args[0] . '%';
      ok(q('SELECT p.*, c.nombre categoria_nombre, pr.nombre proveedor_nombre FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id LEFT JOIN proveedores pr ON p.proveedor_id = pr.id WHERE p.activo = 1 AND p.stock > 0 AND (p.nombre LIKE ? OR p.codigo_barras LIKE ?) ORDER BY p.nombre LIMIT 20', [$s, $s]));
    }
    case 'products.create': {
      requirePermission('gestionar_productos');
      $d = $args[0];
      $isUnit = ($d['unidad_medida'] ?? 'pieza') === 'pieza';
      $id = run('INSERT INTO productos (codigo_barras, nombre, precio_venta, precio_costo, stock, stock_minimo, categoria_id, unidad_medida, proveedor_id) VALUES (?,?,?,?,?,?,?,?,?)',
        [$d['codigo_barras'] ?? null, $d['nombre'], $d['precio_venta'], $d['precio_costo'], normStock($d['stock'] ?? 0, $isUnit ? 'pieza' : 'kg'), normStock($d['stock_minimo'] ?? 0, $isUnit ? 'pieza' : 'kg'), $d['categoria_id'] ?? null, $d['unidad_medida'] ?? 'pieza', !empty($d['proveedor_id']) ? (int)$d['proveedor_id'] : null]);
      logAudit($user['id'], 'crear_producto', 'Producto creado: ' . $d['nombre']);
      ok(['id' => $id] + $d);
    }
    case 'products.update': {
      requirePermission('gestionar_productos');
      $d = $args[1];
      $old = one('SELECT * FROM productos WHERE id = ?', [$args[0]]);
      $isUnit = ($d['unidad_medida'] ?? $old['unidad_medida']) === 'pieza';
      run('UPDATE productos SET codigo_barras=?, nombre=?, precio_venta=?, precio_costo=?, stock=?, stock_minimo=?, categoria_id=?, unidad_medida=?, proveedor_id=? WHERE id=?',
        [$d['codigo_barras'], $d['nombre'], $d['precio_venta'], $d['precio_costo'], normStock($d['stock'] ?? 0, $isUnit ? 'pieza' : 'kg'), $d['stock_minimo'] ?? 0, $d['categoria_id'], $d['unidad_medida'], !empty($d['proveedor_id']) ? (int)$d['proveedor_id'] : null, $args[0]]);
      logAudit($user['id'], 'actualizar_producto', 'Producto actualizado: ' . $d['nombre']);
      ok(true);
    }
    case 'products.delete': {
      requirePermission('gestionar_productos');
      $old = one('SELECT nombre FROM productos WHERE id = ?', [$args[0]]);
      run('DELETE FROM movimientos_inventario WHERE producto_id = ?', [$args[0]]);
      run('UPDATE ventas_detalle SET producto_id = NULL WHERE producto_id = ?', [$args[0]]);
      run('DELETE FROM productos WHERE id = ?', [$args[0]]);
      logAudit($user['id'], 'eliminar_producto', 'Producto eliminado: ' . ($old['nombre'] ?? '?'));
      ok(true);
    }
    case 'products.getCategories': ok(q('SELECT * FROM categorias ORDER BY nombre'));
    case 'products.createCategory': { $id = run('INSERT INTO categorias (nombre) VALUES (?)', [$args[0]]); ok(['id' => $id, 'nombre' => $args[0]]); }
    case 'products.updateCategory': { run('UPDATE categorias SET nombre = ? WHERE id = ?', [$args[1], $args[0]]); ok(true); }
    case 'products.deleteCategory': { run('UPDATE productos SET categoria_id = NULL WHERE categoria_id = ?', [$args[0]]); run('DELETE FROM categorias WHERE id = ?', [$args[0]]); ok(true); }
    case 'products.getPromoted': ok(q('SELECT * FROM productos WHERE activo = 1 AND en_promocion = 1 ORDER BY nombre'));
    case 'products.import': { $n = 0; foreach (($args[0] ?? []) as $p) { try { run('INSERT INTO productos (codigo_barras, nombre, precio_venta, precio_costo, stock, stock_minimo, categoria_id, unidad_medida, proveedor_id) VALUES (?,?,?,?,?,?,?,?,?)', [$p['codigo_barras'] ?? null, $p['nombre'], $p['precio_venta'] ?? 0, $p['precio_costo'] ?? 0, $p['stock'] ?? 0, $p['stock_minimo'] ?? 0, $p['categoria_id'] ?? null, $p['unidad_medida'] ?? 'pieza', $p['proveedor_id'] ?? null]); $n++; } catch (Throwable $e) {} } ok(['imported' => $n]); }
    case 'products.importWoo': {
      $d = $args[0];
      if (empty($d['url']) || empty($d['consumer_key']) || empty($d['consumer_secret'])) fail('Ingresa URL, Consumer Key y Consumer Secret de WooCommerce');
      $url = trim($d['url']);
      if (!preg_match('#^https?://#i', $url)) fail('La URL debe empezar con http:// o https://');
      $auth = 'Basic ' . base64_encode($d['consumer_key'] . ':' . $d['consumer_secret']);
      $n = 0; $page = 1; $pages = 1;
      do {
        $qs = 'per_page=100&page=' . $page;
        if (!empty($d['status'])) $qs .= '&status=' . urlencode($d['status']);
        $ctx = stream_context_create(['http' => ['method' => 'GET', 'header' => "Authorization: $auth\r\nAccept: application/json\r\n", 'timeout' => 30, 'ignore_errors' => true]]);
        $raw = @file_get_contents(rtrim($url, '/') . '/wp-json/wc/v3/products?' . $qs, false, $ctx);
        if ($raw === false) fail('No se pudo conectar con la tienda. Revisa la URL.');
        $status = 0;
        foreach ($http_response_header ?? [] as $h) if (preg_match('#^HTTP/\S+\s+(\d+)#', $h, $m)) $status = (int)$m[1];
        if ($status >= 400) fail($status === 401 ? 'Credenciales inválidas (HTTP 401). Revisa Consumer Key y Consumer Secret.' : "La tienda respondió HTTP $status.");
        $items = json_decode($raw, true);
        if (!is_array($items)) fail('Respuesta no válida. Revisa Consumer Key y Consumer Secret.');
        foreach ($http_response_header ?? [] as $h) if (stripos($h, 'X-WP-TotalPages:') === 0) $pages = max(1, (int)trim(substr($h, 16)));
        foreach ($items as $p) {
          $nombre = $p['name'] ?? '';
          if ($nombre === '') continue;
          $categoria_id = null;
          $cat = $p['categories'][0]['name'] ?? null;
          if ($cat) {
            $ex = one('SELECT id FROM categorias WHERE nombre = ?', [$cat]);
            $categoria_id = $ex ? (int)$ex['id'] : (int)run('INSERT INTO categorias (nombre) VALUES (?)', [$cat]);
          }
          $sku = $p['sku'] ?? null;
          if ($sku === null || $sku === '') $sku = 'WC-' . (int)($p['id'] ?? 0);
          try {
            run('INSERT INTO productos (codigo_barras, nombre, precio_venta, precio_costo, stock, stock_minimo, categoria_id, unidad_medida) VALUES (?,?,?,?,?,?,?,?)', [
              $sku, $nombre, (float)($p['price'] ?? 0), 0,
              ($p['stock_quantity'] ?? null) !== null ? (float)$p['stock_quantity'] : 0, 0, $categoria_id,
              ($p['weight'] ?? 0) > 0 ? 'kg' : 'pieza',
            ]);
            $n++;
          } catch (Throwable $e) {} // ponytail: duplicado (SKU ya importado) -> se salta, no cancela el resto
        }
        $page++;
      } while ($page <= $pages);
      ok(['imported' => $n]);
    }
    case 'products.setPromotion': { $d = $args[0]; run('UPDATE productos SET en_promocion = ?, precio_promo = ? WHERE id = ?', [$d['en_promocion'] ? 1 : 0, $d['precio_promo'] ?? null, $d['producto_id']]); ok(true); }
    case 'auth.getUserPermissionsByUser': {
      $id = $args[0];
      $u = one('SELECT rol FROM usuarios WHERE id = ?', [$id]);
      if ($u && $u['rol'] === 'admin') ok(array_fill_keys(ALL_PERMISSIONS, true));
      $perms = q('SELECT permiso, valor FROM permisos_usuario WHERE usuario_id = ?', [$id]);
      $result = [];
      foreach ($perms as $p) $result[$p['permiso']] = (bool)$p['valor'];
      ok($result);
    }

    // ============ PROVEEDORES ============
    case 'proveedores.getAll': ok(q('SELECT * FROM proveedores ORDER BY nombre'));
    case 'proveedores.get': ok(one('SELECT * FROM proveedores WHERE id = ?', [$args[0]]));
    case 'proveedores.create': { $d = $args[0]; $id = run('INSERT INTO proveedores (nombre, telefono, email, direccion) VALUES (?,?,?,?)', [$d['nombre'], $d['telefono'] ?? null, $d['email'] ?? null, $d['direccion'] ?? null]); ok(['id' => $id] + $d); }
    case 'proveedores.update': { $d = $args[1]; run('UPDATE proveedores SET nombre=?, telefono=?, email=?, direccion=? WHERE id=?', [$d['nombre'], $d['telefono'] ?? null, $d['email'] ?? null, $d['direccion'] ?? null, $args[0]]); ok(true); }
    case 'proveedores.delete': { run('UPDATE productos SET proveedor_id = NULL WHERE proveedor_id = ?', [$args[0]]); run('DELETE FROM proveedores WHERE id = ?', [$args[0]]); ok(true); }

    // ============ SALES ============
    case 'sales.create': {
      requirePermission('realizar_ventas');
      $d = $args[0];
      $total = 0; $descTotal = 0;
      foreach ($d['items'] as $item) { $total += $item['cantidad'] * $item['precio_unitario'] - ($item['descuento'] ?? 0); $descTotal += $item['descuento'] ?? 0; }
      $descGlobal = ($d['descuento'] ?? 0) + ($d['cupon_descuento'] ?? 0) + ($d['combo_descuento'] ?? 0);
      $total = max(0, $total - $descGlobal); $descTotal += $descGlobal;
      $sesion = one('SELECT caja_id FROM sesiones_caja WHERE usuario_id = ? AND activa = 1 ORDER BY id DESC LIMIT 1', [$user['id']]);
      $userCaja = $sesion['caja_id'] ?? (one('SELECT caja_id FROM usuarios WHERE id = ?', [$user['id']])['caja_id'] ?? null);
      $pagos = $d['pagos'] ?? [['tipo' => $d['forma_pago'], 'monto' => $total]];
      $formaPago = count($pagos) > 1 ? 'mixto' : $pagos[0]['tipo'];
      $ventaId = run('INSERT INTO ventas (total, descuento, forma_pago, detalle_pago, cliente_id, usuario_id, caja_id) VALUES (?,?,?,?,?,?,?)',
        [$total, $descTotal, $formaPago, json_encode($pagos), $d['cliente_id'] ?? null, $user['id'], $userCaja]);
      foreach ($d['items'] as $item) {
        run('INSERT INTO ventas_detalle (venta_id, producto_id, nombre_producto, cantidad, precio_unitario, descuento, subtotal) VALUES (?,?,?,?,?,?,?)',
          [$ventaId, $item['producto_id'] ?? null, $item['nombre_producto'], $item['cantidad'], $item['precio_unitario'], $item['descuento'] ?? 0, $item['cantidad'] * $item['precio_unitario'] - ($item['descuento'] ?? 0)]);
        if (!empty($item['producto_id'])) {
          $prod = one('SELECT * FROM productos WHERE id = ?', [$item['producto_id']]);
          if ($prod) {
            $stockAnt = $prod['stock']; $stockNuevo = normStock($stockAnt - $item['cantidad'], $prod['unidad_medida']);
            run('UPDATE productos SET stock = ? WHERE id = ?', [$stockNuevo, $item['producto_id']]);
            run('INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, usuario_id, referencia) VALUES (?,?,?,?,?,?,?)',
              [$item['producto_id'], 'venta', -$item['cantidad'], $stockAnt, $stockNuevo, $user['id'], 'Venta #' . $ventaId]);
          }
        }
      }
      $credito = 0; foreach ($pagos as $p) if ($p['tipo'] === 'credito') $credito += $p['monto'];
      if ($credito > 0 && !empty($d['cliente_id'])) run('UPDATE clientes SET saldo_pendiente = saldo_pendiente + ? WHERE id = ?', [$credito, $d['cliente_id']]);
      $corte = one('SELECT id FROM cortes_caja WHERE cerrado = 0 AND caja_id = ? ORDER BY id DESC LIMIT 1', [$userCaja ?? 1]);
      if ($corte) run('UPDATE cortes_caja SET monto_ventas = monto_ventas + ? WHERE id = ?', [$total, $corte['id']]);
      logAudit($user['id'], 'realizar_venta', 'Venta #' . $ventaId . ' - $' . number_format($total, 2));
      ok(['id' => $ventaId, 'total' => $total, 'folio' => $ventaId, 'pagos' => $pagos, 'forma_pago' => $formaPago]);
    }
    case 'sales.getAll': {
      $f = $args[0] ?? [];
      $sql = 'SELECT v.*, c.nombre cliente_nombre, u.nombre_usuario FROM ventas v LEFT JOIN clientes c ON v.cliente_id = c.id LEFT JOIN usuarios u ON v.usuario_id = u.id WHERE 1=1';
      $params = [];
      if (!empty($f['desde'])) { $sql .= ' AND v.fecha >= ?'; $params[] = $f['desde']; }
      if (!empty($f['hasta'])) { $sql .= ' AND v.fecha <= ?'; $params[] = $f['hasta']; }
      if (isset($f['anulada'])) { $sql .= ' AND v.anulada = ?'; $params[] = $f['anulada']; }
      if (!empty($f['mis_ventas'])) { $sql .= ' AND v.usuario_id = ?'; $params[] = $user['id']; }
      elseif (!empty($f['usuario_id'])) { $sql .= ' AND v.usuario_id = ?'; $params[] = $f['usuario_id']; }
      if (!empty($f['caja_id'])) { $sql .= ' AND v.caja_id = ?'; $params[] = $f['caja_id']; }
      $sql .= ' ORDER BY v.id DESC LIMIT 200';
      ok(q($sql, $params));
    }
    case 'sales.get': {
      $v = one('SELECT v.*, c.nombre cliente_nombre, u.nombre_usuario FROM ventas v LEFT JOIN clientes c ON v.cliente_id = c.id LEFT JOIN usuarios u ON v.usuario_id = u.id WHERE v.id = ?', [$args[0]]);
      if (!$v) ok(null);
      $v['items'] = q('SELECT * FROM ventas_detalle WHERE venta_id = ?', [$args[0]]);
      ok($v);
    }
    case 'sales.void': {
      requirePermission('anular_ventas');
      $venta = one('SELECT * FROM ventas WHERE id = ?', [$args[0]]);
      if (!$venta) fail('Venta no encontrada');
      if ($venta['anulada']) fail('La venta ya está anulada');
      run('UPDATE ventas SET anulada = 1, motivo_anulacion = ? WHERE id = ?', [$args[1], $args[0]]);
      $items = q('SELECT * FROM ventas_detalle WHERE venta_id = ?', [$args[0]]);
      foreach ($items as $item) {
        if (empty($item['producto_id'])) continue;
        $prod = one('SELECT * FROM productos WHERE id = ?', [$item['producto_id']]);
        if (!$prod) continue;
        $stockAnt = $prod['stock']; $stockNuevo = normStock($stockAnt + $item['cantidad'], $prod['unidad_medida']);
        run('UPDATE productos SET stock = ? WHERE id = ?', [$stockNuevo, $item['producto_id']]);
        run('INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, usuario_id, referencia) VALUES (?,?,?,?,?,?,?)',
          [$item['producto_id'], 'entrada', $item['cantidad'], $stockAnt, $stockNuevo, $user['id'], 'Anulación venta #' . $args[0]]);
      }
      if ($venta['cliente_id'] && in_array($venta['forma_pago'], ['credito', 'mixto'])) {
        $credito = $venta['total'];
        $pagos = json_decode($venta['detalle_pago'] ?? '', true);
        if (is_array($pagos)) $credito = array_sum(array_column(array_filter($pagos, fn($p) => $p['tipo'] === 'credito'), 'monto'));
        run('UPDATE clientes SET saldo_pendiente = GREATEST(0, saldo_pendiente - ?) WHERE id = ?', [$credito, $venta['cliente_id']]);
      }
      logAudit($user['id'], 'anular_venta', 'Venta #' . $args[0] . ' anulada');
      ok(true);
    }
    case 'sales.getToday': ok(q('SELECT v.*, c.nombre cliente_nombre, u.nombre_usuario FROM ventas v LEFT JOIN clientes c ON v.cliente_id = c.id LEFT JOIN usuarios u ON v.usuario_id = u.id WHERE DATE(v.fecha) = CURDATE() AND v.anulada = 0 ORDER BY v.id'));
    case 'sales.getSummary': {
      $f = $args[0] ?? [];
      $sql = 'SELECT COUNT(*) total_ventas, COALESCE(SUM(total),0) monto_total, COALESCE(SUM(descuento),0) total_descuentos, COALESCE(AVG(total),0) ticket_promedio FROM ventas WHERE anulada = 0';
      $params = [];
      if (!empty($f['desde'])) { $sql .= ' AND fecha >= ?'; $params[] = $f['desde']; }
      if (!empty($f['hasta'])) { $sql .= ' AND fecha <= ?'; $params[] = $f['hasta']; }
      $res = one($sql, $params);
      $paySql = 'SELECT forma_pago, COUNT(*) cantidad, SUM(total) monto FROM ventas WHERE anulada = 0';
      $payParams = [];
      if (!empty($f['desde'])) { $paySql .= ' AND fecha >= ?'; $payParams[] = $f['desde']; }
      if (!empty($f['hasta'])) { $paySql .= ' AND fecha <= ?'; $payParams[] = $f['hasta']; }
      $res['formas_pago'] = q($paySql . ' GROUP BY forma_pago', $payParams);
      ok($res);
    }

    // ============ CLIENTS ============
    case 'clients.getAll': {
      $f = $args[0] ?? [];
      ok(q('SELECT * FROM clientes' . (!empty($f['con_deuda']) ? ' WHERE saldo_pendiente > 0' : '') . ' ORDER BY nombre'));
    }
    case 'clients.get': ok(one('SELECT * FROM clientes WHERE id = ?', [$args[0]]));
    case 'clients.create': { $d = $args[0]; $id = run('INSERT INTO clientes (nombre, telefono, correo, direccion) VALUES (?,?,?,?)', [$d['nombre'], $d['telefono'] ?? null, $d['correo'] ?? null, $d['direccion'] ?? null]); ok(['id' => $id] + $d); }
    case 'clients.update': { $d = $args[1]; run('UPDATE clientes SET nombre=?, telefono=?, correo=?, direccion=? WHERE id=?', [$d['nombre'], $d['telefono'] ?? null, $d['correo'] ?? null, $d['direccion'] ?? null, $args[0]]); ok(true); }
    case 'clients.search': { $s = '%' . $args[0] . '%'; ok(q('SELECT * FROM clientes WHERE nombre LIKE ? OR telefono LIKE ? ORDER BY nombre LIMIT 20', [$s, $s])); }
    case 'clients.getDebt': {
      $client = one('SELECT * FROM clientes WHERE id = ?', [$args[0]]);
      if (!$client) fail('Cliente no encontrado');
      ok(['client' => $client,
        'ventas' => q('SELECT id, fecha, total, created_at FROM ventas WHERE cliente_id = ? AND anulada = 0 AND forma_pago = ? ORDER BY fecha', [$args[0], 'credito']),
        'abonos' => q('SELECT * FROM abonos WHERE cliente_id = ? ORDER BY created_at', [$args[0]])]);
    }
    case 'clients.registerPayment': {
      requirePermission('cobrar_deudas');
      $d = $args[0];
      run('INSERT INTO abonos (cliente_id, venta_id, monto, usuario_id) VALUES (?,?,?,?)', [$d['cliente_id'], $d['venta_id'] ?? null, $d['monto'], $user['id']]);
      run('UPDATE clientes SET saldo_pendiente = GREATEST(0, saldo_pendiente - ?) WHERE id = ?', [$d['monto'], $d['cliente_id']]);
      ok(true);
    }

    // ============ CASH REGISTER / CAJAS / SESIONES ============
    case 'caja.open': { requirePermission('corte_caja'); $d = $args[0]; $id = run('INSERT INTO cortes_caja (monto_inicial, usuario_id, caja_id) VALUES (?,?,?)', [$d['monto_inicial'], $user['id'], $d['caja_id'] ?? 1]); logAudit($user['id'], 'abrir_caja', 'Caja ' . ($d['caja_id'] ?? 1) . ' abierta'); ok(['id' => $id]); }
    case 'caja.close': {
      requirePermission('corte_caja');
      $d = $args[0];
      $corte = one('SELECT * FROM cortes_caja WHERE id = ?', [$d['id']]);
      if (!$corte) fail('Corte no encontrado');
      $ventasHoy = one('SELECT COALESCE(SUM(total),0) total FROM ventas WHERE DATE(fecha) = CURDATE() AND anulada = 0 AND caja_id = ?', [$corte['caja_id'] ?? 1])['total'];
      $totalEsperado = $corte['monto_inicial'] + $ventasHoy;
      run('UPDATE cortes_caja SET fecha_cierre = NOW(), monto_ventas = ?, monto_final = ?, cerrado = 1, observaciones = ?, reporte_json = ? WHERE id = ?',
        [$ventasHoy, $d['monto_final'], $d['observaciones'] ?? null, isset($d['reporte_json']) ? json_encode($d['reporte_json']) : null, $d['id']]);
      ok(['total_esperado' => $totalEsperado, 'diferencia' => $d['monto_final'] - $totalEsperado]);
    }
    case 'caja.status': {
      $f = $args[0] ?? [];
      $sql = 'SELECT cc.*, u.nombre_usuario, u.nombre_completo FROM cortes_caja cc LEFT JOIN usuarios u ON cc.usuario_id = u.id WHERE cc.cerrado = 0';
      $params = [];
      if (!empty($f['caja_id'])) { $sql .= ' AND cc.caja_id = ?'; $params[] = $f['caja_id']; }
      $sql .= ' ORDER BY cc.id DESC LIMIT 1';
      ok(one($sql, $params));
    }
    case 'caja.history': {
      $f = $args[0] ?? [];
      $sql = 'SELECT cc.*, u.nombre_usuario, u.nombre_completo, c.nombre caja_nombre FROM cortes_caja cc LEFT JOIN usuarios u ON cc.usuario_id = u.id LEFT JOIN cajas c ON cc.caja_id = c.id WHERE 1=1';
      $params = [];
      if (!empty($f['desde'])) { $sql .= ' AND cc.fecha_apertura >= ?'; $params[] = $f['desde']; }
      if (!empty($f['hasta'])) { $sql .= ' AND cc.fecha_apertura <= ?'; $params[] = $f['hasta']; }
      if (!empty($f['caja_id'])) { $sql .= ' AND cc.caja_id = ?'; $params[] = $f['caja_id']; }
      $sql .= ' ORDER BY cc.id DESC LIMIT 50';
      $rows = q($sql, $params);
      foreach ($rows as &$r) $r['reporte_json'] = $r['reporte_json'] ? json_decode($r['reporte_json'], true) : null;
      ok($rows);
    }
    case 'cajas.list': ok(q('SELECT * FROM cajas WHERE activa = 1 ORDER BY id'));
    case 'cajas.create': { requireAdmin(); $d = $args[0]; $n = one('SELECT COUNT(*) c FROM cajas WHERE activa = 1')['c']; if ($n >= planInfo()['max_cajas']) fail('Límite de cajas alcanzado (' . planInfo()['max_cajas'] . ')'); $id = run('INSERT INTO cajas (nombre) VALUES (?)', [$d['nombre']]); ok(['id' => $id]); }
    case 'cajas.update': { $d = $args[0]; run('UPDATE cajas SET nombre = ? WHERE id = ?', [$d['nombre'], $d['id']]); ok(true); }
    case 'cajas.delete': { run('UPDATE cajas SET activa = 0 WHERE id = ?', [$args[0]]); ok(true); }
    case 'cajas.getStatus': ok(one('SELECT cc.*, u.nombre_usuario, u.nombre_completo FROM cortes_caja cc LEFT JOIN usuarios u ON cc.usuario_id = u.id WHERE cc.caja_id = ? AND cc.cerrado = 0 ORDER BY cc.id DESC LIMIT 1', [$args[0]]));
    case 'cajas.getAllWithStatus': {
      $cajas = q('SELECT * FROM cajas WHERE activa = 1 ORDER BY id');
      foreach ($cajas as &$c) {
        $corte = one('SELECT cc.*, u.nombre_completo abierto_por FROM cortes_caja cc LEFT JOIN usuarios u ON u.id = cc.usuario_id WHERE cc.caja_id = ? AND cc.cerrado = 0 ORDER BY cc.id DESC LIMIT 1', [$c['id']]);
        $sesiones = q('SELECT s.*, u.nombre_usuario, u.nombre_completo FROM sesiones_caja s JOIN usuarios u ON u.id = s.usuario_id WHERE s.caja_id = ? AND s.activa = 1', [$c['id']]);
        $c['abierta'] = !!$corte; $c['corte'] = $corte; $c['sesiones'] = $sesiones; $c['sesiones_count'] = count($sesiones);
      }
      ok($cajas);
    }
    case 'sesiones.start': {
      $d = $args[0];
      if (one('SELECT id FROM sesiones_caja WHERE caja_id = ? AND activa = 1', [$d['caja_id']])) fail('Esta caja ya tiene un cajero asignado');
      $id = run('INSERT INTO sesiones_caja (caja_id, usuario_id) VALUES (?,?)', [$d['caja_id'], $d['usuario_id']]);
      logAudit($d['usuario_id'], 'iniciar_sesion_caja', 'Cajero inició sesión en caja ' . $d['caja_id']);
      ok(['id' => $id]);
    }
    case 'sesiones.end': { run('UPDATE sesiones_caja SET activa = 0, fin = NOW() WHERE id = ?', [$args[0]['sesion_id']]); ok(true); }
    case 'sesiones.endByUser': { run('UPDATE sesiones_caja SET activa = 0, fin = NOW() WHERE usuario_id = ? AND activa = 1', [$args[0]['usuario_id']]); ok(true); }
    case 'sesiones.getAvailable': ok(q('SELECT c.* FROM cajas c WHERE c.activa = 1 AND c.id NOT IN (SELECT caja_id FROM sesiones_caja WHERE activa = 1) ORDER BY c.id'));
    case 'sesiones.getActive': ok(one('SELECT s.*, u.nombre_usuario, u.nombre_completo FROM sesiones_caja s JOIN usuarios u ON s.usuario_id = u.id WHERE s.caja_id = ? AND s.activa = 1 ORDER BY s.id DESC LIMIT 1', [$args[0]]));
    case 'sesiones.allActive': ok(q('SELECT s.*, u.nombre_usuario, u.nombre_completo, c.nombre caja_nombre FROM sesiones_caja s JOIN usuarios u ON s.usuario_id = u.id JOIN cajas c ON s.caja_id = c.id WHERE s.activa = 1 ORDER BY s.id DESC'));
    case 'sesiones.getCurrent': {
      requireAuth();
      ok(one('SELECT s.*, u.nombre_usuario, u.nombre_completo, c.nombre caja_nombre FROM sesiones_caja s JOIN usuarios u ON s.usuario_id = u.id JOIN cajas c ON s.caja_id = c.id WHERE s.usuario_id = ? AND s.activa = 1 ORDER BY s.id DESC LIMIT 1', [$user['id']]));
    }
    case 'sesiones.join': {
      requireAuth();
      if (one('SELECT id FROM sesiones_caja WHERE usuario_id = ? AND activa = 1', [$user['id']])) fail('Ya tiene una sesión activa en otra caja');
      $id = run('INSERT INTO sesiones_caja (caja_id, usuario_id) VALUES (?,?)', [$args[0]['caja_id'], $user['id']]);
      ok(['id' => $id]);
    }

    // ============ REPORTS (MVP) ============
    case 'reports.daily': {
      $d = $args[0] ?? date('Y-m-d');
      ok(['fecha' => $d,
        'summary' => one('SELECT COUNT(*) total_ventas, COALESCE(SUM(total),0) monto_total, COALESCE(SUM(descuento),0) descuentos FROM ventas WHERE DATE(fecha) = ? AND anulada = 0', [$d]),
        'formas_pago' => q('SELECT forma_pago, COUNT(*) cantidad, SUM(total) monto FROM ventas WHERE DATE(fecha) = ? AND anulada = 0 GROUP BY forma_pago', [$d]),
        'top_productos' => q('SELECT vd.nombre_producto, SUM(vd.cantidad) cantidad, SUM(vd.subtotal) total FROM ventas_detalle vd JOIN ventas v ON vd.venta_id = v.id WHERE DATE(v.fecha) = ? AND v.anulada = 0 GROUP BY vd.nombre_producto ORDER BY cantidad DESC LIMIT 10', [$d])]);
    }
    case 'reports.topProducts': {
      $f = $args[0] ?? [];
      $sql = 'SELECT vd.nombre_producto, p.codigo_barras, SUM(vd.cantidad) cantidad, SUM(vd.subtotal) total, AVG(vd.precio_unitario) precio_promedio FROM ventas_detalle vd JOIN ventas v ON vd.venta_id = v.id LEFT JOIN productos p ON vd.producto_id = p.id WHERE v.anulada = 0';
      $params = [];
      if (!empty($f['desde'])) { $sql .= ' AND v.fecha >= ?'; $params[] = $f['desde']; }
      if (!empty($f['hasta'])) { $sql .= ' AND v.fecha <= ?'; $params[] = $f['hasta']; }
      $sql .= ' GROUP BY vd.nombre_producto ORDER BY cantidad DESC LIMIT 20';
      ok(q($sql, $params));
    }
    case 'reports.profit': {
      $f = $args[0] ?? [];
      $where = 'WHERE anulada = 0'; $params = [];
      if (!empty($f['desde'])) { $where .= ' AND fecha >= ?'; $params[] = $f['desde']; }
      if (!empty($f['hasta'])) { $where .= ' AND fecha <= ?'; $params[] = $f['hasta']; }
      $ingresos = one('SELECT COALESCE(SUM(total),0) v FROM ventas ' . $where, $params)['v'];
      $bySql = 'SELECT vd.nombre_producto, SUM(vd.cantidad) cantidad, SUM(vd.subtotal) ventas, COALESCE(SUM(vd.cantidad * p.precio_costo),0) costo, SUM(vd.subtotal) - COALESCE(SUM(vd.cantidad * p.precio_costo),0) ganancia FROM ventas_detalle vd JOIN ventas v ON vd.venta_id = v.id LEFT JOIN productos p ON vd.producto_id = p.id WHERE v.anulada = 0';
      $byParams = [];
      if (!empty($f['desde'])) { $bySql .= ' AND v.fecha >= ?'; $byParams[] = $f['desde']; }
      if (!empty($f['hasta'])) { $bySql .= ' AND v.fecha <= ?'; $byParams[] = $f['hasta']; }
      $bySql .= ' GROUP BY vd.nombre_producto ORDER BY ganancia DESC LIMIT 20';
      $byProduct = q($bySql, $byParams);
      $costo = 0; foreach ($byProduct as $p) $costo += $p['costo'];
      ok(['summary' => ['ingresos' => $ingresos, 'costo_total' => $costo, 'ganancia' => $ingresos - $costo], 'productos' => $byProduct]);
    }
    case 'reports.auditLog': {
      $f = $args[0] ?? [];
      $sql = 'SELECT a.*, u.nombre_usuario FROM auditoria a LEFT JOIN usuarios u ON a.usuario_id = u.id WHERE 1=1';
      $params = [];
      if (!empty($f['usuario_id'])) { $sql .= ' AND a.usuario_id = ?'; $params[] = $f['usuario_id']; }
      if (!empty($f['accion'])) { $sql .= ' AND a.accion = ?'; $params[] = $f['accion']; }
      if (!empty($f['desde'])) { $sql .= ' AND a.created_at >= ?'; $params[] = $f['desde']; }
      if (!empty($f['hasta'])) { $sql .= ' AND a.created_at <= ?'; $params[] = $f['hasta']; }
      $sql .= ' ORDER BY a.id DESC LIMIT 200';
      ok(q($sql, $params));
    }

    // ============ INVENTORY (MVP básico) ============
    case 'inventory.getStockAlerts': ok(q('SELECT p.*, c.nombre categoria_nombre, pr.nombre proveedor_nombre FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id LEFT JOIN proveedores pr ON p.proveedor_id = pr.id WHERE p.activo = 1 AND p.stock <= p.stock_minimo ORDER BY (p.stock_minimo - p.stock) DESC'));
    case 'inventory.adjustStock': {
      requirePermission('ajustar_stock');
      $d = $args[0];
      $prod = one('SELECT * FROM productos WHERE id = ?', [$d['producto_id']]);
      if (!$prod) fail('Producto no encontrado');
      $stockAnt = $prod['stock'];
      $nuevo = normStock($d['nuevo_stock'] ?? 0, $prod['unidad_medida']);
      run('UPDATE productos SET stock = ? WHERE id = ?', [$nuevo, $d['producto_id']]);
      run('INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, precio_costo, referencia, usuario_id) VALUES (?,?,?,?,?,?,?,?)',
        [$d['producto_id'], 'ajuste', $nuevo - $stockAnt, $stockAnt, $nuevo, $d['precio_costo'] ?? $prod['precio_costo'], $d['motivo'] ?? 'Ajuste manual', $user['id']]);
      ok(true);
    }
    case 'inventory.getMovements': {
      $f = $args[0] ?? [];
      $sql = 'SELECT m.*, p.nombre producto_nombre, u.nombre_usuario FROM movimientos_inventario m LEFT JOIN productos p ON m.producto_id = p.id LEFT JOIN usuarios u ON m.usuario_id = u.id WHERE 1=1';
      $params = [];
      if (!empty($f['producto_id'])) { $sql .= ' AND m.producto_id = ?'; $params[] = $f['producto_id']; }
      if (!empty($f['tipo'])) { $sql .= ' AND m.tipo = ?'; $params[] = $f['tipo']; }
      if (!empty($f['desde'])) { $sql .= ' AND m.created_at >= ?'; $params[] = $f['desde']; }
      if (!empty($f['hasta'])) { $sql .= ' AND m.created_at <= ?'; $params[] = $f['hasta']; }
      $sql .= ' ORDER BY m.created_at DESC LIMIT 200';
      ok(q($sql, $params));
    }
    case 'inventory.dashboard': {
      $f = $args[0] ?? [];
      ok(['totalProductos' => one('SELECT COUNT(*) cnt, COALESCE(SUM(stock),0) total_items, COALESCE(SUM(stock * precio_costo),0) valor_total FROM productos WHERE activo = 1'),
        'alertasCount' => one('SELECT COUNT(*) cnt FROM productos WHERE activo = 1 AND stock <= stock_minimo')['cnt'],
        'categorias' => q('SELECT c.nombre, SUM(p.stock * p.precio_costo) valor, COUNT(p.id) productos FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id WHERE p.activo = 1 GROUP BY c.nombre ORDER BY valor DESC'),
        'topProducts' => q('SELECT vd.nombre_producto nombre, SUM(vd.cantidad) total_vendido, SUM(vd.subtotal) total_ingresos FROM ventas_detalle vd JOIN ventas v ON vd.venta_id = v.id WHERE v.anulada = 0 AND DATE_FORMAT(v.fecha, "%Y-%m") = DATE_FORMAT(CURDATE(), "%Y-%m") GROUP BY vd.nombre_producto ORDER BY total_vendido DESC LIMIT 5'),
        'sinMovimiento' => q('SELECT p.id, p.nombre, p.stock, p.precio_costo, MAX(m.created_at) ultimo_movimiento FROM productos p LEFT JOIN movimientos_inventario m ON m.producto_id = p.id WHERE p.activo = 1 GROUP BY p.id, p.nombre, p.stock, p.precio_costo HAVING MAX(m.created_at) IS NULL OR MAX(m.created_at) < DATE_SUB(NOW(), INTERVAL 30 DAY) ORDER BY p.nombre')]);
    }
    case 'inventory.receive': {
      requirePermission('realizar_entradas');
      $d = $args[0];
      $refBase = $d['referencia'] ?? ('REC-' . time());
      $provNombre = !empty($d['proveedor_id']) ? (one('SELECT nombre FROM proveedores WHERE id = ?', [$d['proveedor_id']])['nombre'] ?? '') : '';
      $ref = $provNombre ? $refBase . ' (' . $provNombre . ')' : $refBase;
      $items = [];
      foreach (($d['items'] ?? []) as $item) {
        $prod = one('SELECT * FROM productos WHERE id = ?', [$item['producto_id']]);
        if (!$prod) fail('Producto ID ' . $item['producto_id'] . ' no encontrado');
        $stockAnt = $prod['stock'];
        $stockNuevo = normStock($stockAnt + ($item['cantidad'] ?? 0), $prod['unidad_medida']);
        $costo = $item['precio_costo'] ?? $prod['precio_costo'];
        run('UPDATE productos SET stock = ?, precio_costo = ? WHERE id = ?', [$stockNuevo, $costo, $item['producto_id']]);
        run('INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, precio_costo, referencia, usuario_id) VALUES (?,?,?,?,?,?,?,?)',
          [$item['producto_id'], 'entrada', $item['cantidad'], $stockAnt, $stockNuevo, $costo, $ref, $user['id']]);
        $items[] = ['producto_id' => $item['producto_id'], 'producto_nombre' => $prod['nombre'], 'cantidad' => $item['cantidad'], 'precio_costo' => $costo];
      }
      run('INSERT INTO documentos_entrada (referencia, proveedor_id, proveedor_nombre, total_items, usuario_id, items_json, created_at) VALUES (?,?,?,?,?,?,NOW())',
        [$refBase, $d['proveedor_id'] ?? null, $provNombre, count($items), $user['id'], json_encode($items)]);
      logAudit($user['id'], 'recibir_mercancia', 'Entrada (' . count($items) . ' productos): ' . $ref);
      ok(true);
    }
    case 'inventory.getReceiveDocuments': {
      $docs = q('SELECT d.*, u.nombre_usuario usuario FROM documentos_entrada d LEFT JOIN usuarios u ON d.usuario_id = u.id ORDER BY d.created_at DESC');
      foreach ($docs as &$doc) $doc['items'] = $doc['items_json'] ? json_decode($doc['items_json'], true) : [];
      ok($docs);
    }
    case 'inventory.updateReceiveDocument': {
      requirePermission('realizar_entradas');
      $d = $args[1];
      if (!empty($d['referencia'])) {
        $oldRef = one('SELECT referencia FROM documentos_entrada WHERE id = ?', [$args[0]])['referencia'] ?? null;
        if ($oldRef) run('UPDATE movimientos_inventario SET referencia = ? WHERE referencia = ? AND tipo = ?', [$d['referencia'], $oldRef, 'entrada']);
        run('UPDATE documentos_entrada SET referencia = ? WHERE id = ?', [$d['referencia'], $args[0]]);
      }
      ok(true);
    }
    case 'inventory.updateReceiveDocumentItem': {
      requirePermission('realizar_entradas');
      $doc = one('SELECT * FROM documentos_entrada WHERE id = ?', [$args[0]]);
      if (!$doc) fail('Documento no encontrado');
      $items = $doc['items_json'] ? json_decode($doc['items_json'], true) : [];
      $idx = null;
      foreach ($items as $i => $it) if ($it['producto_id'] == $args[1]) $idx = $i;
      if ($idx === null) fail('Producto no encontrado en el documento');
      $oldCant = $items[$idx]['cantidad'];
      $d = $args[2];
      if (isset($d['cantidad'])) $items[$idx]['cantidad'] = $d['cantidad'];
      if (isset($d['precio_costo'])) $items[$idx]['precio_costo'] = $d['precio_costo'];
      run('UPDATE productos SET stock = GREATEST(0, stock + ?) WHERE id = ?', [($d['cantidad'] ?? $oldCant) - $oldCant, $args[1]]);
      run('UPDATE documentos_entrada SET items_json = ?, total_items = ? WHERE id = ?', [json_encode($items), count($items), $args[0]]);
      if (isset($d['cantidad'])) {
        $mov = one('SELECT id FROM movimientos_inventario WHERE referencia = ? AND producto_id = ? AND tipo = ?', [$doc['referencia'], $args[1], 'entrada']);
        if ($mov) run('UPDATE movimientos_inventario SET cantidad = ? WHERE id = ?', [$d['cantidad'], $mov['id']]);
      }
      ok(true);
    }
    case 'inventory.deleteReceiveDocumentItem': {
      requirePermission('realizar_entradas');
      $doc = one('SELECT * FROM documentos_entrada WHERE id = ?', [$args[0]]);
      if (!$doc) fail('Documento no encontrado');
      $items = $doc['items_json'] ? json_decode($doc['items_json'], true) : [];
      $item = null;
      foreach ($items as $it) if ($it['producto_id'] == $args[1]) $item = $it;
      if (!$item) fail('Producto no encontrado en el documento');
      run('UPDATE productos SET stock = GREATEST(0, stock - ?) WHERE id = ?', [$item['cantidad'], $args[1]]);
      $newItems = array_values(array_filter($items, fn($it) => $it['producto_id'] != $args[1]));
      run('UPDATE documentos_entrada SET items_json = ?, total_items = ? WHERE id = ?', [json_encode($newItems), count($newItems), $args[0]]);
      run('DELETE FROM movimientos_inventario WHERE referencia = ? AND producto_id = ? AND tipo = ?', [$doc['referencia'], $args[1], 'entrada']);
      ok(true);
    }
    case 'inventory.deleteReceiveDocument': {
      requirePermission('realizar_entradas');
      $doc = one('SELECT * FROM documentos_entrada WHERE id = ?', [$args[0]]);
      if (!$doc) fail('Documento no encontrado');
      $items = $doc['items_json'] ? json_decode($doc['items_json'], true) : [];
      foreach ($items as $item) {
        run('UPDATE productos SET stock = GREATEST(0, stock - ?) WHERE id = ?', [$item['cantidad'], $item['producto_id']]);
      }
      run('DELETE FROM movimientos_inventario WHERE referencia = ? AND tipo = ?', [$doc['referencia'], 'entrada']);
      run('DELETE FROM documentos_entrada WHERE id = ?', [$args[0]]);
      ok(true);
    }
    case 'inventory.updateMovement': {
      requirePermission('realizar_entradas');
      $d = $args[0];
      $old = one('SELECT * FROM movimientos_inventario WHERE id = ?', [$d['id']]);
      if (!$old) fail('Movimiento no encontrado');
      if (isset($d['cantidad']) && $d['cantidad'] != $old['cantidad']) {
        $delta = $d['cantidad'] - $old['cantidad'];
        run('UPDATE productos SET stock = stock + ? WHERE id = ?', [$delta, $old['producto_id']]);
        run('UPDATE movimientos_inventario SET cantidad = ?, stock_anterior = stock_anterior + ?, stock_nuevo = stock_nuevo + ? WHERE id = ?', [$d['cantidad'], $delta, $delta, $d['id']]);
      }
      if (isset($d['referencia'])) run('UPDATE movimientos_inventario SET referencia = ? WHERE id = ?', [$d['referencia'], $d['id']]);
      ok(true);
    }
    case 'inventory.deleteMovement': {
      requirePermission('realizar_entradas');
      $m = one('SELECT * FROM movimientos_inventario WHERE id = ?', [$args[0]]);
      if (!$m) fail('Movimiento no encontrado');
      run('UPDATE productos SET stock = stock - ? WHERE id = ?', [$m['cantidad'], $m['producto_id']]);
      run('DELETE FROM movimientos_inventario WHERE id = ?', [$args[0]]);
      ok(true);
    }

    // ============ RETURNS ============
    case 'returns.create': {
      requirePermission('realizar_devoluciones');
      $d = $args[0];
      $venta = !empty($d['venta_id']) ? one('SELECT * FROM ventas WHERE id = ?', [$d['venta_id']]) : null;
      if (!empty($d['venta_id']) && !$venta) fail('Venta no encontrada');
      $total = 0;
      foreach (($d['items'] ?? []) as $item) $total += (float)$item['subtotal'];
      $devId = run('INSERT INTO devoluciones (venta_id, total, motivo, usuario_id) VALUES (?,?,?,?)', [$d['venta_id'] ?? null, $total, $d['motivo'] ?? null, $user['id']]);
      foreach (($d['items'] ?? []) as $item) {
        run('INSERT INTO devoluciones_detalle (devolucion_id, producto_id, nombre_producto, cantidad, precio_unitario, subtotal) VALUES (?,?,?,?,?,?)',
          [$devId, $item['producto_id'] ?? null, $item['nombre_producto'], $item['cantidad'], $item['precio_unitario'], $item['subtotal']]);
        if (!empty($item['producto_id'])) {
          $prod = one('SELECT * FROM productos WHERE id = ?', [$item['producto_id']]);
          if ($prod) {
            $stockAnt = $prod['stock'];
            $stockNuevo = normStock($stockAnt + $item['cantidad'], $prod['unidad_medida']);
            run('UPDATE productos SET stock = ? WHERE id = ?', [$stockNuevo, $item['producto_id']]);
            run('INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, usuario_id, referencia) VALUES (?,?,?,?,?,?,?)',
              [$item['producto_id'], 'entrada', $item['cantidad'], $stockAnt, $stockNuevo, $user['id'], 'Devolución #' . $devId]);
          }
        }
      }
      if ($venta && $venta['forma_pago'] === 'credito' && $venta['cliente_id']) {
        run('UPDATE clientes SET saldo_pendiente = GREATEST(0, saldo_pendiente - ?) WHERE id = ?', [$total, $venta['cliente_id']]);
      }
      logAudit($user['id'], 'realizar_devolucion', 'Devolución #' . $devId . ' - $' . number_format($total, 2));
      ok(['id' => $devId, 'total' => $total]);
    }
    case 'returns.getAll': {
      $f = $args[0] ?? [];
      $sql = 'SELECT d.*, v.total venta_total, u.nombre_usuario FROM devoluciones d LEFT JOIN ventas v ON d.venta_id = v.id LEFT JOIN usuarios u ON d.usuario_id = u.id WHERE 1=1';
      $params = [];
      if (!empty($f['desde'])) { $sql .= ' AND d.fecha >= ?'; $params[] = $f['desde']; }
      if (!empty($f['hasta'])) { $sql .= ' AND d.fecha <= ?'; $params[] = $f['hasta']; }
      if (!empty($f['mis_devoluciones'])) { $sql .= ' AND d.usuario_id = ?'; $params[] = $user['id']; }
      $sql .= ' ORDER BY d.id DESC LIMIT 200';
      ok(q($sql, $params));
    }
    case 'returns.get': {
      $dev = one('SELECT d.*, v.total venta_total, u.nombre_usuario FROM devoluciones d LEFT JOIN ventas v ON d.venta_id = v.id LEFT JOIN usuarios u ON d.usuario_id = u.id WHERE d.id = ?', [$args[0]]);
      if (!$dev) ok(null);
      $dev['items'] = q('SELECT * FROM devoluciones_detalle WHERE devolucion_id = ?', [$args[0]]);
      ok($dev);
    }

    // ============ METRICAS CAJAS ============
    case 'cajas.metrics': {
      ok(['perCaja' => q('SELECT c.id, c.nombre, CASE WHEN cc.id IS NOT NULL THEN 1 ELSE 0 END abierta, cc.monto_inicial, cc.monto_ventas, (SELECT COUNT(*) FROM ventas v WHERE v.caja_id = c.id AND v.anulada = 0) total_ventas, (SELECT COALESCE(SUM(v.total),0) FROM ventas v WHERE v.caja_id = c.id AND v.anulada = 0) ingresos, (SELECT COUNT(*) FROM sesiones_caja s WHERE s.caja_id = c.id) total_sesiones FROM cajas c LEFT JOIN cortes_caja cc ON cc.caja_id = c.id AND cc.cerrado = 0 WHERE c.activa = 1 ORDER BY c.id'),
        'perCajero' => q('SELECT u.id, u.nombre_completo, u.nombre_usuario, u.rol, COUNT(v.id) total_ventas, COALESCE(SUM(v.total),0) ingresos, CASE WHEN COUNT(v.id) > 0 THEN COALESCE(SUM(v.total),0) / COUNT(v.id) ELSE 0 END ticket_promedio, u.caja_id, (SELECT c.nombre FROM cajas c WHERE c.id = u.caja_id) caja_nombre, (SELECT COUNT(*) FROM sesiones_caja s WHERE s.usuario_id = u.id) total_sesiones FROM usuarios u LEFT JOIN ventas v ON v.usuario_id = u.id AND v.anulada = 0 WHERE u.activo = 1 GROUP BY u.id ORDER BY ingresos DESC'),
        'sesionesActivas' => q('SELECT s.*, u.nombre_usuario, u.nombre_completo, c.nombre caja_nombre FROM sesiones_caja s JOIN usuarios u ON u.id = s.usuario_id JOIN cajas c ON c.id = s.caja_id WHERE s.activa = 1 ORDER BY s.inicio DESC')]);
    }

    // ============ CUPONES (completos) ============
    case 'cupones.getAll': ok(q('SELECT * FROM cupones ORDER BY id DESC'));
    case 'cupones.create': {
      $d = $args[0];
      $id = run('INSERT INTO cupones (codigo, tipo, valor, min_compra, vigencia_desde, vigencia_hasta, usos_maximos, tipo_aplicacion, producto_id, categoria_id, productos_ids) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [$d['codigo'], $d['tipo'], $d['valor'], $d['min_compra'] ?? 0, $d['vigencia_desde'] ?? null, $d['vigencia_hasta'] ?? null, $d['usos_maximos'] ?? 0, $d['tipo_aplicacion'] ?? 'todos', $d['producto_id'] ?? null, $d['categoria_id'] ?? null, isset($d['productos_ids']) ? json_encode($d['productos_ids']) : null]);
      ok(['id' => (int)$id]);
    }
    case 'cupones.update': {
      $d = $args[0];
      run('UPDATE cupones SET codigo=?, tipo=?, valor=?, min_compra=?, vigencia_desde=?, vigencia_hasta=?, usos_maximos=?, activo=?, tipo_aplicacion=?, producto_id=?, categoria_id=?, productos_ids=? WHERE id=?',
        [$d['codigo'], $d['tipo'], $d['valor'], $d['min_compra'] ?? 0, $d['vigencia_desde'] ?? null, $d['vigencia_hasta'] ?? null, $d['usos_maximos'] ?? 0, $d['activo'] ?? 1, $d['tipo_aplicacion'] ?? 'todos', $d['producto_id'] ?? null, $d['categoria_id'] ?? null, isset($d['productos_ids']) ? json_encode($d['productos_ids']) : null, $d['id']]);
      ok(true);
    }
    case 'cupones.delete': { run('DELETE FROM cupones WHERE id = ?', [$args[0]]); ok(true); }
    case 'cupones.usar': {
      $c = one('SELECT * FROM cupones WHERE codigo = ? AND activo = 1', [$args[0]]);
      if (!$c) fail('Cupón no encontrado o inactivo');
      if ((int)$c['usos_maximos'] > 0 && (int)$c['usos_actuales'] >= (int)$c['usos_maximos']) fail('Cupón agotado');
      run('UPDATE cupones SET usos_actuales = usos_actuales + 1 WHERE id = ?', [$c['id']]);
      $c = one('SELECT * FROM cupones WHERE id = ?', [$c['id']]);
      if ($c['productos_ids']) $c['productos_ids'] = json_decode($c['productos_ids'], true);
      ok($c);
    }

    // ============ DESCUENTOS POR CANTIDAD (completos) ============
    case 'descuentos.getAll': {
      $items = q('SELECT d.*, p.nombre producto_nombre, p.codigo_barras FROM descuentos_cantidad d LEFT JOIN productos p ON d.producto_id = p.id ORDER BY d.id DESC');
      foreach ($items as &$d) $d['reglas'] = json_decode($d['reglas'] ?? '[]', true) ?: [];
      ok($items);
    }
    case 'descuentos.create': { $d = $args[0]; $id = run('INSERT INTO descuentos_cantidad (producto_id, reglas, tipo) VALUES (?,?,?)', [$d['producto_id'], json_encode($d['reglas'] ?? []), $d['tipo'] ?? 'precio_fijo']); ok(['id' => (int)$id]); }
    case 'descuentos.update': { $d = $args[0]; run('UPDATE descuentos_cantidad SET producto_id=?, reglas=?, activo=?, tipo=? WHERE id=?', [$d['producto_id'], json_encode($d['reglas'] ?? []), $d['activo'] ?? 1, $d['tipo'] ?? 'precio_fijo', $d['id']]); ok(true); }
    case 'descuentos.delete': { run('DELETE FROM descuentos_cantidad WHERE id = ?', [$args[0]]); ok(true); }
    case 'descuentos.getByProducto': {
      $d = one('SELECT * FROM descuentos_cantidad WHERE producto_id = ? AND activo = 1 ORDER BY id DESC LIMIT 1', [$args[0]]);
      ok($d ? ['id' => $d['id'], 'producto_id' => $d['producto_id'], 'tipo' => $d['tipo'], 'reglas' => json_decode($d['reglas'] ?? '[]', true) ?: [], 'activo' => $d['activo']] : null);
    }

    // ============ GRUPOS (combos, completos) ============
    case 'grupos.getAll': {
      $grupos = q('SELECT * FROM grupos ORDER BY nombre');
      foreach ($grupos as &$g) {
        $g['items'] = q('SELECT gd.producto_id, gd.cantidad, p.nombre nombre_producto, p.precio_venta FROM grupo_detalles gd LEFT JOIN productos p ON gd.producto_id = p.id WHERE gd.grupo_id = ?', [$g['id']]);
      }
      ok($grupos);
    }
    case 'grupos.create': {
      $d = $args[0];
      $id = run('INSERT INTO grupos (nombre, precio, activo) VALUES (?,?,?)', [$d['nombre'], $d['precio'] ?? 0, $d['activo'] ?? 1]);
      foreach (($d['items'] ?? []) as $i) if (!empty($i['producto_id'])) run('INSERT INTO grupo_detalles (grupo_id, producto_id, cantidad) VALUES (?,?,?)', [$id, $i['producto_id'], $i['cantidad'] ?? 1]);
      ok(['id' => (int)$id]);
    }
    case 'grupos.update': {
      $d = $args[0];
      run('UPDATE grupos SET nombre = ?, precio = ?, activo = ? WHERE id = ?', [$d['nombre'], $d['precio'] ?? 0, $d['activo'] ?? 1, $d['id']]);
      run('DELETE FROM grupo_detalles WHERE grupo_id = ?', [$d['id']]);
      foreach (($d['items'] ?? []) as $i) if (!empty($i['producto_id'])) run('INSERT INTO grupo_detalles (grupo_id, producto_id, cantidad) VALUES (?,?,?)', [$d['id'], $i['producto_id'], $i['cantidad'] ?? 1]);
      ok(true);
    }
    case 'grupos.delete': { run('DELETE FROM grupo_detalles WHERE grupo_id = ?', [$args[0]]); run('DELETE FROM grupos WHERE id = ?', [$args[0]]); ok(true); }

    // ============ BOLETAS / SII / SCALE (config en BD, reales) ============
    case 'boletas.getAll': ok(q('SELECT * FROM boletas_emitidas ORDER BY created_at DESC'));
    case 'boletas.register': {
      $d = $args[0];
      $folio = (one('SELECT MAX(folio) max FROM boletas_emitidas')['max'] ?? 0) + 1;
      run('INSERT INTO boletas_emitidas (folio, tipo_dte, total, rut_cliente, razon_social_cliente, xml_response, created_at) VALUES (?,?,?,?,?,?,NOW())',
        [$folio, $d['tipo_dte'] ?? '39', $d['total'] ?? 0, $d['rut_cliente'] ?? '', $d['razon_social_cliente'] ?? '', $d['xml_response'] ?? '']);
      ok(one('SELECT * FROM boletas_emitidas ORDER BY id DESC LIMIT 1'));
    }
    case 'sii.getConfig': {
      $get = fn($k, $def = '') => one('SELECT valor FROM configuracion WHERE clave = ?', [$k])['valor'] ?? $def;
      ok(['enabled' => $get('sii_enabled') === 'true', 'proveedor' => $get('sii_proveedor', 'tango'), 'api_key' => $get('sii_api_key'), 'rut_empresa' => $get('sii_rut_empresa'), 'razon_social' => $get('sii_razon_social'), 'giro' => $get('sii_giro'), 'direccion_sii' => $get('sii_direccion'), 'comuna' => $get('sii_comuna'), 'resolvedor' => $get('sii_resolvedor', 'sii'), 'printer' => $get('sii_printer'), 'auto_print' => $get('sii_auto_print', 'true') !== 'false']);
    }
    case 'sii.setConfig': {
      $d = $args[0];
      $map = ['enabled' => 'sii_enabled', 'proveedor' => 'sii_proveedor', 'api_key' => 'sii_api_key', 'rut_empresa' => 'sii_rut_empresa', 'razon_social' => 'sii_razon_social', 'giro' => 'sii_giro', 'direccion_sii' => 'sii_direccion', 'comuna' => 'sii_comuna', 'resolvedor' => 'sii_resolvedor', 'printer' => 'sii_printer', 'auto_print' => 'sii_auto_print'];
      foreach ($map as $k => $clave) if (isset($d[$k])) run('INSERT INTO configuracion (clave, valor) VALUES (?,?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)', [$clave, is_bool($d[$k]) ? ($d[$k] ? 'true' : 'false') : (string)$d[$k]]);
      ok(true);
    }
    case 'scale.getConfig': {
      $get = fn($k, $def) => one('SELECT valor FROM configuracion WHERE clave = ?', [$k])['valor'] ?? $def;
      ok(['port' => $get('scale_port', 'COM1'), 'protocol' => $get('scale_protocol', 'rs232')]);
    }
    case 'scale.read': ok(['weight' => 0, 'unit' => 'kg', 'connected' => false, 'message' => 'Báscula no conectada (simulación)']);
    case 'scale.configure': {
      $d = $args[0];
      run('INSERT INTO configuracion (clave, valor) VALUES (?,?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)', ['scale_port', $d['port'] ?? 'COM1']);
      run('INSERT INTO configuracion (clave, valor) VALUES (?,?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)', ['scale_protocol', $d['protocol'] ?? 'rs232']);
      ok(true);
    }
    case 'printer.getConfig': {
      $get = fn($k, $def) => one('SELECT valor FROM configuracion WHERE clave = ?', [$k])['valor'] ?? $def;
      ok(['enabled' => $get('printer_enabled', 'true') === 'true', 'printer' => $get('printer_name', ''), 'auto_print' => $get('printer_auto_print', 'true') !== 'false']);
    }
    case 'printer.setConfig': {
      $d = $args[0];
      if (isset($d['enabled'])) run('INSERT INTO configuracion (clave, valor) VALUES (?,?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)', ['printer_enabled', $d['enabled'] ? 'true' : 'false']);
      if (isset($d['printer'])) run('INSERT INTO configuracion (clave, valor) VALUES (?,?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)', ['printer_name', $d['printer']]);
      if (isset($d['auto_print'])) run('INSERT INTO configuracion (clave, valor) VALUES (?,?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)', ['printer_auto_print', $d['auto_print'] ? 'true' : 'false']);
      ok(true);
    }

    // ============ STUBS (funcionalidad escritorio que no aplica en web) ============
    case 'printer.printTicket': ok(true);
    case 'updates.check': {
      requireAdmin();
      [$json, $repo, $err] = fetchFromGithub('version.json');
      if ($json === null) ok(['configured' => $repo !== null, 'current' => appVersion(), 'latest' => null, 'pending' => false, 'error' => $err]);
      $json = preg_replace('/^\xEF\xBB\xBF/', '', $json); // tolerar BOM (UTF-8 firm)
      $v = json_decode($json, true);
      $latest = (int)($v['version'] ?? 0);
      $cur = appVersion();
      ok(['configured' => true, 'current' => $cur, 'latest' => $latest, 'pending' => $latest > $cur, 'error' => null]);
    }
    case 'updates.apply': {
      requireAdmin();
      if (!class_exists('ZipArchive')) fail('El servidor no tiene la extension Zip (activala en cPanel: PHP Selector -> zip)');
      [$zipRaw, $repo, $err] = fetchFromGithub('nexbit-pos-web.zip');
      if ($zipRaw === null) fail($err);
      $tmp = __DIR__ . '/tmp_upd_' . bin2hex(random_bytes(4));
      mkdir($tmp);
      file_put_contents($tmp . '/upd.zip', $zipRaw);
      $za = new ZipArchive();
      if ($za->open($tmp . '/upd.zip') !== true) { rrmdir($tmp); fail('El zip del update no es valido'); }
      $za->extractTo($tmp . '/x');
      $za->close();
      $src = $tmp . '/x';
      $root = dirname(__DIR__); // cPanel: public_html/ (padre de api/)
      if (!is_file($src . '/index.html') || !is_file($src . '/api/index.php')) { rrmdir($tmp); fail('El update no trae la app completa (faltan index.html o api/index.php)'); }
      $v = 0;
      $verj = is_file($src . '/version.json') ? json_decode(file_get_contents($src . '/version.json'), true) : null;
      if ($verj) $v = (int)($verj['version'] ?? 0);
      copyTree($src, $root);
      rrmdir($tmp);
      if ($v > 0) setAppVersion($v);
      logAudit($user['id'], 'actualizacion_app', 'Actualizada a version ' . $v);
      ok(['version' => $v]);
    }
    case 'backup.create': fail('Backup local no aplica en web; usa el backup de cPanel');
    case 'app.getInfo': ok(['version' => 'web-1.0.0', 'name' => 'Next Byte', 'platform' => 'web']);
    case 'app.copy': ok(true);
    case 'app.restart': ok(true);
    case 'db.getPath': ok(null);
    case 'db.setPath': ok(true);
    case 'db.createServer': ok(['shareOk' => false, 'shareError' => 'Multi-caja local no aplica en web']);

    default: fail('Acción desconocida: ' . $action);
  }
} catch (Throwable $e) {
  fail('Error: ' . $e->getMessage());
}
