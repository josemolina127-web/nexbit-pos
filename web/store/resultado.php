<?php
// Pagina donde Flow devuelve al cliente tras pagar.
require_once __DIR__ . '/store-funciones.php';
$token = $_GET['token'] ?? '';
$pedido = $token ? pedidoPorToken(db(), $token) : null;
?>
<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Pago Nexbit POS</title>
<style>body{font-family:Arial,Sans-Serif;background:#f4f4f5;display:flex;justify-content:center;padding-top:60px}
.card{background:#fff;border-radius:12px;padding:28px;max-width:420px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
.btn{display:inline-block;background:#FF4B00;color:#fff;border-radius:8px;padding:10px 16px;text-decoration:none;margin-top:12px}</style></head>
<body><div class="card">
<?php if (!$pedido): ?>
  <h3>Pago en proceso</h3><p>Recibirás la licencia por correo cuando Flow confirme el pago.</p>
<?php elseif ($pedido['estado'] === 'pagado'): ?>
  <h3>✓ Pago confirmado</h3>
  <p>Gracias, <?= htmlspecialchars($pedido['cliente_nombre']) ?>. Revisa tu correo (<b><?= htmlspecialchars($pedido['cliente_email']) ?></b>): la licencia ya está en camino.</p>
  <a class="btn" href="index.php">Volver</a>
<?php else: ?>
  <h3>Pago pendiente o rechazado</h3>
  <p>El pago no se ha confirmado todavía. Si ya pagaste, la licencia llegará por correo en unos minutos. ¿Problemas? Escríbenos.</p>
  <a class="btn" href="index.php">Volver</a>
<?php endif; ?>
</div></body></html>