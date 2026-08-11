<?php
// SOLO PRUEBAS: marca un pedido como pagado sin Flow, para ver el correo
// y la licencia antes de activar pagos reales. Desactivar en produccion
// (HABILITAR_SIMULADOR=false en store-config.php).
require_once __DIR__ . '/store-funciones.php';
header('Content-Type: application/json');
if (empty($STORE_CFG['HABILITAR_SIMULADOR'])) { http_response_code(403); echo json_encode(['ok' => false, 'error' => 'simulador desactivado']); exit; }
$id = (int)($_GET['id'] ?? 0);
if (!$id) { echo json_encode(['ok' => false, 'error' => '?id=PEDIDO_ID']); exit; }
list($ok, $msg, $pedido) = finalizarPedido($id);
echo json_encode(['ok' => $ok, 'msg' => $msg, 'licencia' => $pedido['licencia'] ?? null]);
exit;