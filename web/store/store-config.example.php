<?php
// CONFIG DE LA TIENDA. Copia este archivo a store-config.php y pon tus datos.
// store-config.php NO se sube al repo (ver .gitignore).
return [
  'SANDBOX' => true, // true = sandbox.flow.cl (pruebas), false = produccion

  'FLOW_API_KEY' => 'PON_AQUI_TU_API_KEY_DE_FLOW',
  'FLOW_SECRET_KEY' => 'PON_AQUI_TU_SECRET_KEY_DE_FLOW',
  'FLOW_URL_RETORNO' => 'https://TUDOMINIO.cl/tienda/resultado.php',
  'FLOW_URL_CONFIRMACION' => 'https://TUDOMINIO.cl/tienda/webhook.php',

  // Planes: [max_cajas, max_usuarios, precio CLP, descripcion]
  'PLANES' => [
    'basic' => [1, 1, 29990, '1 caja · 1 usuario'],
    'pro' => [2, 5, 59990, '2 cajas · 5 usuarios'],
    'multi' => [4, 10, 89990, '4 cajas · 10 usuarios'],
  ],

  // Secreto de firmado de licencias (debe coincidir con el de web/api/index.php)
  'LICENSE_SECRET' => 'nxb7Hq3mP9xL2vRs',

  // BD de la tienda (crear BD y usuario en cPanel, luego poner los datos aqui)
  'DB_HOST' => 'localhost',
  'DB_NAME' => 'nexbit_tienda',
  'DB_USER' => 'PON_USUARIO_BD',
  'DB_PASS' => 'PON_CLAVE_BD',

  // Correo (SMTP del cPanel). Si SMTP_HOST esta vacio usa mail() del servidor.
  'MAIL_FROM' => 'licencias@TUDOMINIO.cl',
  'MAIL_FROM_NAME' => 'Nexbit POS - Licencias',
  'SMTP_HOST' => '',     // ej: mail.tudominio.cl
  'SMTP_PORT' => 465,    // 465 SSL / 587 STARTTLS
  'SMTP_USER' => '',
  'SMTP_PASS' => '',

  // Clave para entrar a /tienda/admin.php (lista de pedidos + reenviar)
  'ADMIN_CLAVE' => 'cambia-esta-clave',

  // SOLO PRUEBAS: true permite /tienda/simular.php (marca un pedido como pagado sin Flow)
  'HABILITAR_SIMULADOR' => true,

  // Opcional: guarda una copia de cada correo enviado en esta carpeta (depurando)
  'EMAIL_LOGS' => '',
];