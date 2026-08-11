<?php
require_once __DIR__ . '/store-funciones.php';
require_once __DIR__ . '/lib_flow.php';

$plan = $_POST['plan'] ?? '';
$nombre = trim($_POST['nombre'] ?? '');
$email = trim($_POST['email'] ?? '');
if (!isset($STORE_CFG['PLANES'][$plan])) { header('Location: index.php?err=Plan invalido'); exit; }
if ($nombre === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) { header('Location: index.php?err=Datos incompletos'); exit; }

list($maxCajas, $maxUsuarios, $monto, $desc) = $STORE_CFG['PLANES'][$plan];
try {
  $pdo = db();
  $st = $pdo->prepare('INSERT INTO pedidos (cliente_nombre, cliente_email, plan, max_cajas, max_usuarios, monto, estado, fecha_creado) VALUES (?,?,?,?,?,?,?,NOW())');
  $st->execute([$nombre, $email, $plan, $maxCajas, $maxUsuarios, $monto, 'pendiente']);
  $pedidoId = (int)$pdo->lastInsertId();
} catch (Throwable $e) { header('Location: index.php?err=Error de base de datos: revisa store-config.php'); exit; }

$order = 'NEX-' . date('Ymd') . '-' . $pedidoId;
list($flow, $err) = flow_crearPago($STORE_CFG, $order, $monto, $email, 'Nexbit POS - Plan ' . $plan . ' (' . $desc . ')');
if ($err) { header('Location: index.php?err=' . urlencode($err)); exit; }

$pdo->prepare('UPDATE pedidos SET flow_token = ?, flow_order = ? WHERE id = ?')->execute([$flow['token'], $order, $pedidoId]);
header('Location: ' . $flow['url']);
exit;