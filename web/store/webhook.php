<?php
// Webhook de Flow: confirma el pago en su servidor. La URL va configurada
// en el comercio de Flow (urlConfirmation). No genera HTML: responde JSON.
require_once __DIR__ . '/store-funciones.php';
require_once __DIR__ . '/lib_flow.php';
header('Content-Type: application/json');

$body = file_get_contents('php://input');
$json = json_decode($body, true);
$token = $json['token'] ?? ($_POST['token'] ?? '');
if ($token === '') { http_response_code(400); echo json_encode(['ok' => false, 'error' => 'sin token']); exit; }

$pdo = db();
$pedido = pedidoPorToken($pdo, $token);
if (!$pedido) { http_response_code(404); echo json_encode(['ok' => false, 'error' => 'pedido no encontrado']); exit; }

list($estado, $err) = flow_estadoPago($STORE_CFG, $token);
if ($err) { http_response_code(502); echo json_encode(['ok' => false, 'error' => $err]); exit; }
// estado: 2 = pagado. Nunca confiar en el JSON del webhook: esto es de Flow.
if ((int)$estado['status'] !== 2) { echo json_encode(['ok' => true, 'estado' => (int)$estado['status'], 'accion' => 'sin accion']); exit; }
if ((int)$estado['amount'] !== (int)$pedido['monto']) { http_response_code(400); echo json_encode(['ok' => false, 'error' => 'monto no coincide']); exit; }

list($ok, $msg) = finalizarPedido($pedido['id']);
echo json_encode(['ok' => $ok, 'msg' => $msg]);
exit;