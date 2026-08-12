<?php
// Webhook de WooCommerce: cuando un pedido queda PAGADO, genera la licencia
// Nexbit POS y la envia por correo automaticamente.
//
// Configuracion en WooCommerce: Ajustes > Avanzado > Webhooks > Anadir:
//   - Nombre:          Nexbit POS licencias
//   - Estado:          Activo
//   - Topic:           Order updated (pedido actualizado)
//   - Secret de entrega: palabra clave (la misma de store-config.php, WOO_WEBHOOK_SECRET)
//   - URL de entrega:  https://TUDOMINIO.cl/tienda/woo-webhook.php
//
// WooCommerce firma el payload con X-WC-Webhook-Signature (HMAC-SHA256);
// aqui se valida antes de tocar nada.
require_once __DIR__ . '/store-funciones.php';
header('Content-Type: application/json');

$raw = file_get_contents('php://input');
$firma = $_SERVER['HTTP_X_WC_WEBHOOK_SIGNATURE'] ?? '';
$secreto = $STORE_CFG['WOO_WEBHOOK_SECRET'] ?? '';
if ($secreto === '' || !hash_equals(base64_encode(hash_hmac('sha256', $raw, $secreto, true)), $firma)) {
  http_response_code(401);
  echo json_encode(['ok' => false, 'error' => 'firma invalida']);
  exit;
}

$pedido = json_decode($raw, true);
if (!$pedido || empty($pedido['id'])) { http_response_code(400); echo json_encode(['ok' => false, 'error' => 'payload invalido']); exit; }

$estado = $pedido['status'] ?? '';
$pagado = in_array($estado, ['processing', 'completed'], true);
if (!$pagado) { echo json_encode(['ok' => true, 'estado' => $estado, 'accion' => 'sin accion']); exit; }

$pdo = db();
$ex = one_Row($pdo, 'SELECT id, estado FROM pedidos WHERE woo_order_id = ?', [(int)$pedido['id']]);
if ($ex && $ex['estado'] === 'pagado') { echo json_encode(['ok' => true, 'msg' => 'ya procesado']); exit; } // idempotente

// Mapea los productos del pedido a un plan usando WOO_PRODUCTOS del config.
$plan = null;
foreach (($pedido['line_items'] ?? []) as $item) {
  $pid = (int)($item['product_id'] ?? 0);
  if (isset($STORE_CFG['WOO_PRODUCTOS'][$pid])) { $plan = $STORE_CFG['WOO_PRODUCTOS'][$pid]; break; }
}
if (!$plan) { echo json_encode(['ok' => false, 'error' => 'ningun producto del pedido es un plan Nexbit (revisa WOO_PRODUCTOS en store-config.php)']); exit; }

$nombre = trim(($pedido['billing']['first_name'] ?? '') . ' ' . ($pedido['billing']['last_name'] ?? ''));
if ($nombre === '') $nombre = $pedido['billing']['email'] ?? 'Cliente';

$st = $pdo->prepare('INSERT INTO pedidos (woo_order_id, cliente_nombre, cliente_email, plan, max_cajas, max_usuarios, monto, estado, fecha_creado) VALUES (?,?,?,?,?,?,?,?,NOW())');
$st->execute([(int)$pedido['id'], $nombre, $pedido['billing']['email'] ?? '', $plan[0], $plan[1], $plan[2], (int)(float)($pedido['total'] ?? 0), 'pendiente']);
$pedidoId = (int)$pdo->lastInsertId();

list($ok, $msg) = finalizarPedido($pedidoId);
if (!$ok) { http_response_code(500); echo json_encode(['ok' => false, 'error' => $msg]); exit; }
echo json_encode(['ok' => true, 'pedido' => $pedidoId, 'licencia' => 'enviada por correo']);
exit;