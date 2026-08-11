<?php
require_once __DIR__ . '/lib_licencia.php';
require_once __DIR__ . '/lib_mail.php';
if (!isset($STORE_CFG)) $STORE_CFG = require __DIR__ . '/store-config.php';

function db() {
  static $pdo = null;
  if ($pdo === null) {
    global $STORE_CFG;
    $pdo = new PDO('mysql:host=' . $STORE_CFG['DB_HOST'] . ';dbname=' . $STORE_CFG['DB_NAME'] . ';charset=utf8mb4', $STORE_CFG['DB_USER'], $STORE_CFG['DB_PASS'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    dbAsegurarTabla($pdo);
  }
  return $pdo;
}
function dbAsegurarTabla($pdo) {
  $pdo->exec("CREATE TABLE IF NOT EXISTS pedidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    flow_token VARCHAR(80) NULL,
    flow_order VARCHAR(40) NULL,
    cliente_nombre VARCHAR(120) NOT NULL,
    cliente_email VARCHAR(120) NOT NULL,
    plan VARCHAR(20) NOT NULL,
    max_cajas INT NOT NULL,
    max_usuarios INT NOT NULL,
    monto INT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    licencia VARCHAR(120) NULL,
    fecha_creado DATETIME NOT NULL,
    fecha_pagado DATETIME NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}
function pedidoPorToken($pdo, $token) { return one_Row($pdo, 'SELECT * FROM pedidos WHERE flow_token = ?', [$token]); }
function pedidoPorId($pdo, $id) { return one_Row($pdo, 'SELECT * FROM pedidos WHERE id = ?', [$id]); }
function one_Row($pdo, $sql, $p = []) { $st = $pdo->prepare($sql); $st->execute($p); $r = $st->fetch(PDO::FETCH_ASSOC); return $r ?: null; }

// Marca un pedido como pagado (una sola vez), genera y envia la licencia.
// Devuelve [ok, mensaje, pedido].
function finalizarPedido($pedidoId) {
  global $STORE_CFG;
  $pdo = db();
  $pedido = pedidoPorId($pdo, $pedidoId);
  if (!$pedido) return [false, 'Pedido no existe'];
  if ($pedido['estado'] === 'pagado' && $pedido['licencia']) return [true, 'Ya estaba pagado', $pedido]; // idempotente

  $lic = generarLicencia($pedido['plan'], $pedido['max_cajas'], $pedido['max_usuarios'], str_replace(' ', '_', strtoupper($pedido['cliente_nombre'])), $STORE_CFG['LICENSE_SECRET']);
  $st = $pdo->prepare('UPDATE pedidos SET estado = ?, licencia = ?, fecha_pagado = NOW() WHERE id = ?');
  $st->execute(['pagado', $lic, $pedidoId]);
  $pedido = pedidoPorId($pdo, $pedidoId);

  $cliente = $pedido['cliente_nombre'];
  $html = '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #eee;border-radius:12px;overflow:hidden">
    <div style="background:#1c1c1e;color:#fff;padding:20px 24px"><b style="color:#FF4B00">Nexbit</b> POS · Licencia</div>
    <div style="padding:24px">
    <p>Hola ' . htmlspecialchars($cliente) . ', gracias por tu compra. Tu licencia de Nexbit POS (web):</p>
    <p style="background:#f6f6f7;border:1px dashed #ccc;border-radius:8px;padding:14px;font-family:monospace;font-size:14px">' . $lic . '</p>
    <p><b>Plan:</b> ' . $pedido['plan'] . ' · ' . $pedido['max_cajas'] . ' cajas · ' . $pedido['max_usuarios'] . ' usuarios</p>
    <p><b>Cómo activar:</b> abre la app en tu servidor, completa el instalador y pega este código en el paso "Licencia". Si compraste la app de escritorio, en Config → Licencia.</p>
    <p style="color:#777;font-size:12px">Nexbit POS — punto de venta para tu negocio.</p>
    </div></div>';
  $txt = "Hola $cliente, tu licencia Nexbit POS: $lic\nPlan: {$pedido['plan']} ({$pedido['max_cajas']} cajas, {$pedido['max_usuarios']} usuarios).\nActiva la app y pega el codigo en el paso Licencia del instalador.";
  list($okMail, $err) = enviarCorreo($STORE_CFG, $pedido['cliente_email'], 'Tu licencia Nexbit POS', $html, $txt);
  if (!$okMail) return [false, 'Licencia generada pero el correo fallo: ' . $err, $pedido];
  return [true, 'Pagado, licencia enviada por correo', $pedido];
}