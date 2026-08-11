<?php
// Admin de la tienda: lista de pedidos + reenviar licencia. Advertencia:
// usa la clave de store-config.php (ADMIN_CLAVE). Te recomendamos ademas
// proteger esta carpeta con una contrasena en cPanel (ver LEEME).
require_once __DIR__ . '/store-funciones.php';
session_start();
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['clave'] ?? '') === $STORE_CFG['ADMIN_CLAVE']) $_SESSION['tienda_admin'] = true;
if (!empty($_SESSION['tienda_admin']) && isset($_GET['reenviar'])) {
  list($ok, $msg) = finalizarPedido((int)$_GET['reenviar']);
  $aviso = $ok ? 'OK: ' . $msg : 'ERROR: ' . $msg;
}
if (empty($_SESSION['tienda_admin'])) {
  if ($_SERVER['REQUEST_METHOD'] === 'POST') $aviso = 'Clave incorrecta';
  ?><!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Admin tienda</title></head>
  <body><form method="post"><input type="password" name="clave"><button>Entrar</button></form>
  <?php if (isset($aviso)) echo '<p>' . htmlspecialchars($aviso) . '</p>'; ?></body></html><?php exit;
}
$rows = db()->query('SELECT * FROM pedidos ORDER BY id DESC')->fetchAll(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Pedidos - Nexbit</title>
<style>body{font-family:Arial;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px 10px;font-size:13px;text-align:left}
.pagado{color:#14652c}.pendiente{color:#8f1d1d}code{font-size:11px}</style></head><body>
<h2>Pedidos</h2>
<?php if (isset($aviso)) echo '<p>' . htmlspecialchars($aviso) . '</p>'; ?>
<table><tr><th>#</th><th>Cliente</th><th>Email</th><th>Plan</th><th>Monto</th><th>Estado</th><th>Licencia</th><th>Creado</th><th></th></tr>
<?php foreach ($rows as $p): ?>
<tr><td><?= $p['id'] ?></td><td><?= htmlspecialchars($p['cliente_nombre']) ?></td><td><?= htmlspecialchars($p['cliente_email']) ?></td>
<td><?= $p['plan'] ?> (<?= $p['max_cajas'] ?>/<?= $p['max_usuarios'] ?>)</td><td>$<?= number_format($p['monto'], 0, ',', '.') ?></td>
<td class="<?= $p['estado'] ?>"><?= $p['estado'] ?></td>
<td><?= $p['licencia'] ? '<code>' . htmlspecialchars($p['licencia']) . '</code>' : '-' ?></td>
<td><?= $p['fecha_creado'] ?></td>
<td><?= $p['estado'] === 'pagado' ? '<a href="?reenviar=' . $p['id'] . '">Reenviar licencia</a>' : '' ?></td></tr>
<?php endforeach; ?>
</table></body></html>