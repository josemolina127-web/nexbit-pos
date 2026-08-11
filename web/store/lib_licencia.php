<?php
// Generacion de licencias Nexbit POS. Firma HMAC-SHA256 igual que
// web/tools/gen-license.js y web/api/index.php (verifyLicense).
function generarLicencia($plan, $maxCajas, $maxUsuarios, $cliente, $secret) {
  $payload = $plan . ':' . (int)$maxCajas . ':' . (int)$maxUsuarios . ':' . $cliente;
  $hmac = substr(hash_hmac('sha256', $payload, $secret), 0, 12);
  return $payload . ':' . $hmac;
}