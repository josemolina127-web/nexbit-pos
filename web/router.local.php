<?php
// SOLO PRUEBA LOCAL: php -S 127.0.0.1:8787 -t dist-web dist-web/router.local.php
// Sirve dist-web/ (UI) y redirige /api/* al backend real (web/api/index.php).
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (str_starts_with($path, '/api/')) {
  $_SERVER['SCRIPT_NAME'] = '/api/index.php';
  require __DIR__ . '/../web/api/index.php';
  return true;
}
return false; // el resto (index.html y assets) lo sirve php -S desde el docroot