<?php
// Cliente Flow.cl v3 (pago API / payment link). Firma oficial:
// sha256(secretKey + "k1=v1&k2=v2" ordenado alfabeticamente, sin apiKey ni s).
function flow_base($cfg) { return $cfg['SANDBOX'] ? 'https://sandbox.flow.cl/api/v3/' : 'https://www.flow.cl/api/v3/'; }

function flow_firma($params, $secretKey) {
  unset($params['apiKey'], $params['s']);
  ksort($params);
  $cadena = '';
  foreach ($params as $k => $v) $cadena .= $k . '=' . $v . '&';
  $cadena = rtrim($cadena, '&');
  return hash('sha256', $secretKey . $cadena);
}

// Crea un pago: devuelve ['url'=>...] para redirigir al cliente.
function flow_crearPago($cfg, $commerceOrder, $monto, $email, $asunto) {
  $params = [
    'apiKey' => $cfg['FLOW_API_KEY'],
    'commerceOrder' => $commerceOrder,
    'subject' => $asunto,
    'currency' => 'CLP',
    'amount' => (int)$monto,
    'email' => $email,
    'urlConfirmation' => $cfg['FLOW_URL_CONFIRMACION'],
    'urlReturn' => $cfg['FLOW_URL_RETORNO'],
  ];
  $params['s'] = flow_firma($params, $cfg['FLOW_SECRET_KEY']);
  $ctx = stream_context_create(['http' => ['method' => 'POST', 'header' => "Content-Type: application/x-www-form-urlencoded\r\n", 'content' => http_build_query($params), 'timeout' => 60]]);
  $raw = @file_get_contents(flow_base($cfg) . 'payment/create', false, $ctx);
  if ($raw === false) return [null, 'No se pudo conectar con Flow'];
  $r = json_decode($raw, true);
  if (isset($r['code'])) return [null, 'Flow: ' . $r['message'] . ' (' . $r['code'] . ')'];
  return [$r, null];
}

// Consulta el estado real de un pago por token (fuente de verdad del webhook).
function flow_estadoPago($cfg, $token) {
  $params = ['apiKey' => $cfg['FLOW_API_KEY'], 'token' => $token];
  $params['s'] = flow_firma($params, $cfg['FLOW_SECRET_KEY']);
  $u = flow_base($cfg) . 'payment/getStatus?' . http_build_query($params);
  $raw = @file_get_contents($u, false, stream_context_create(['http' => ['timeout' => 60]]));
  if ($raw === false) return [null, 'No se pudo consultar a Flow'];
  $r = json_decode($raw, true);
  if (isset($r['code'])) return [null, 'Flow: ' . $r['message'] . ' (' . $r['code'] . ')'];
  return [$r, null];
}
// Estados Flow: 1 pendiente, 2 pagado, 3 rechazado, 4 anulado.