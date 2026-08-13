<?php
/**
 * Plugin Name: Nexbit POS - Licencias
 * Description: Genera y envia automaticamente la licencia Nexbit POS cuando un pedido de WooCommerce queda pagado. Incluye historial de pedidos con sus licencias.
 * Version: 1.0.0
 * Author: Nexbit
 * Requires at least: 5.8
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) exit;

define('NPL_VERSION', '1.0.0');
define('NPL_TABLA', 'nexbit_pedidos');

// ---- activacion: crea la tabla de pedidos (una sola, dentro de la BD de WordPress) ----
register_activation_hook(__FILE__, 'npl_instalar');
function npl_instalar() {
  global $wpdb;
  $tabla = $wpdb->prefix . NPL_TABLA;
  $wpdb->query("CREATE TABLE IF NOT EXISTS `$tabla` (
    id INT AUTO_INCREMENT PRIMARY KEY,
    woo_order_id INT NOT NULL,
    cliente_nombre VARCHAR(120) NOT NULL,
    cliente_email VARCHAR(120) NOT NULL,
    plan VARCHAR(20) NOT NULL,
    tipo VARCHAR(10) NOT NULL DEFAULT 'anual',
    max_cajas INT NOT NULL,
    max_usuarios INT NOT NULL,
    monto DECIMAL(12,2) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    licencia VARCHAR(120) NULL,
    fecha_creado DATETIME NOT NULL,
    fecha_pagado DATETIME NULL,
    UNIQUE KEY woo_order_id (woo_order_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

// ---- migra una tabla creada por una version anterior (agrega columnas que falten) ----
add_action('admin_init', 'npl_migrar');
function npl_migrar() {
  global $wpdb;
  $tabla = $wpdb->prefix . NPL_TABLA;
  $col = $wpdb->get_var("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '$tabla' AND COLUMN_NAME = 'tipo'");
  if (!$col) $wpdb->query("ALTER TABLE `$tabla` ADD COLUMN tipo VARCHAR(10) NOT NULL DEFAULT 'anual' AFTER plan");
}

// ---- config (opciones de WordPress; las editas en el menu del plugin) ----
function npl_opciones() {
  $def = [
    'license_secret' => 'nxb7Hq3mP9xL2vRs',
    'productos' => [],
    'mail_from' => '',
    'exe_archivo' => '',
    'smtp_host' => '',
    'smtp_port' => 465,
    'smtp_cifrado' => 'ssl',
    'smtp_usuario' => '',
    'smtp_clave' => '',
  ];
  return wp_parse_args(get_option('npl_config', []), $def);
}

// ---- las 6 licencias (clave => [nombre, plan, cajas, usuarios, vigencia]) ----
function npl_productos() {
  return [
    'basico_anual' => ['Básico anual', 'basic', 1, 1, 'anual'],
    'basico_vida'  => ['Básico de por vida', 'basic', 1, 1, 'vitalicia'],
    'pro_anual'    => ['Pro anual', 'pro', 2, 5, 'anual'],
    'pro_vida'     => ['Pro de por vida', 'pro', 2, 5, 'vitalicia'],
    'multi_anual'  => ['Multi caja anual', 'multi', 4, 10, 'anual'],
    'multi_vida'   => ['Multi caja de por vida', 'multi', 4, 10, 'vitalicia'],
  ];
}

// ---- generacion de licencia (misma firma que web/tools/gen-license.js) ----
function npl_generar_licencia($plan, $cajas, $usuarios, $cliente, $secret) {
  $payload = $plan . ':' . (int)$cajas . ':' . (int)$usuarios . ':' . $cliente;
  return $payload . ':' . substr(hash_hmac('sha256', $payload, $secret), 0, 12);
}

// ---- busca a que licencia pertenece un ID de producto de WooCommerce ----
function npl_plan_de_producto($product_id, $config) {
  $ids = $config['productos'] ?? [];
  foreach (npl_productos() as $tipo => $info) {
    if (!empty($ids[$tipo]) && (int)$ids[$tipo] === (int)$product_id) {
      return [$info[1], $info[2], $info[3], $info[4]];
    }
  }
  return null;
}

// ---- correo de la licencia (wp_mail: usa el SMTP de tu WordPress) ----
// Para basic/pro adjunta el instalador (.exe) si existe en la carpeta del plugin; si el adjunto es demasiado grande para el servidor, reintenta sin el.
function npl_enviar_correo($para, $nombre, $licencia, $plan, $cajas, $usuarios, $tipo) {
  $vigencia = $tipo === 'vitalicia' ? 'De por vida' : 'Anual (renovable)';
  $asunto = 'Tu licencia Nexbit POS';
  $html = '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #eee;border-radius:12px;overflow:hidden">
    <div style="background:#1c1c1e;color:#fff;padding:20px 24px"><b style="color:#FF4B00">Nexbit</b> POS · Licencia</div>
    <div style="padding:24px">
    <p>Hola ' . esc_html($nombre) . ', gracias por tu compra. Tu licencia de Nexbit POS:</p>
    <p style="background:#f6f6f7;border:1px dashed #ccc;border-radius:8px;padding:14px;font-family:monospace;font-size:14px">' . esc_html($licencia) . '</p>
    <p><b>Plan:</b> ' . esc_html($plan) . ' · ' . (int)$cajas . ' cajas · ' . (int)$usuarios . ' usuarios · ' . esc_html($vigencia) . '</p>
    <p><b>Cómo instalar y activar tu licencia:</b></p>
    <ol style="padding-left:20px;line-height:1.8">
    <li>Descarga el instalador desde el enlace del correo de "pedido completado" o en <b>Mi Cuenta → Descargas</b> (el archivo viene comprimido en ZIP: descomprímelo y ejecuta <b>Nexbit-POS-Setup.exe</b>).</li>
    <li>Instala y abre <b>Nexbit POS</b>.</li>
    <li>Ve a <b>Config → Licencia</b> (en la instalación web: paso "Licencia" del instalador).</li>
    <li>Pega el código de abajo y pulsa <b>Activar</b>.</li>
    </ol>
    <p>El mismo código lo tienes siempre en <b>Mi Cuenta → Pedidos</b> (ver pedido) para volver a activarlo si cambias de equipo.</p>
    <p style="color:#777;font-size:12px">Nexbit POS — punto de venta para tu negocio.</p>
    </div></div>';
  $headers = ['Content-Type: text/html; charset=UTF-8'];
  $cfg = npl_opciones();
  if (!empty($cfg['mail_from'])) $headers[] = 'From: ' . $cfg['mail_from'];

  $adjunto = '';
  if ($plan !== 'multi' && !empty($cfg['exe_archivo'])) {
    $ruta = dirname(__FILE__) . '/' . basename($cfg['exe_archivo']);
    if (is_file($ruta)) $adjunto = $ruta;
  }
  if ($adjunto !== '') {
    $ok = wp_mail($para, $asunto, $html, $headers, [$adjunto]);
    if (!$ok) $ok = wp_mail($para, $asunto, $html, $headers, []);
    return $ok;
  }
  return wp_mail($para, $asunto, $html, $headers, []);
}

// ---- envia todo el correo de WordPress por SMTP (PHPMailer ya viene con WordPress) ----
add_action('phpmailer_init', 'npl_smtp');
function npl_smtp($pm) {
  $cfg = npl_opciones();
  if (empty($cfg['smtp_host']) || empty($cfg['smtp_usuario'])) return;
  $pm->isSMTP();
  $pm->Host = $cfg['smtp_host'];
  $pm->Port = (int)($cfg['smtp_port'] ?: 465);
  $pm->SMTPAuth = true;
  $pm->Username = $cfg['smtp_usuario'];
  $pm->Password = $cfg['smtp_clave'];
  $pm->SMTPSecure = in_array($cfg['smtp_cifrado'], ['ssl', 'tls']) ? $cfg['smtp_cifrado'] : '';
  $from = $cfg['mail_from'] !== '' ? $cfg['mail_from'] : $cfg['smtp_usuario'];
  if ($from) $pm->From = $from;
  $pm->FromName = 'Nexbit POS';
}

// ---- procesa un pedido pagado (se llama desde WooCommerce; idempotente) ----
function npl_procesar_pedido($order_id) {
  global $wpdb;
  $order = wc_get_order((int)$order_id);
  if (!$order) return;
  $config = npl_opciones();

  $plan = null;
  foreach ($order->get_items() as $item) {
    $plan = npl_plan_de_producto((int)$item->get_product_id(), $config);
    if ($plan) break;
  }
  if (!$plan) return; // el pedido no incluye un plan Nexbit: no es asunto nuestro

  $tabla = $wpdb->prefix . NPL_TABLA;
  $email = $order->get_billing_email();
  $nombre = trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name());
  if ($nombre === '') $nombre = $email;

  $existe = $wpdb->get_var($wpdb->prepare("SELECT id FROM `$tabla` WHERE woo_order_id = %d", (int)$order_id));
  if ($existe) {
    // reenvio manual o evento repetido: si ya tiene licencia no duplicar correo
    return;
  }

  list($planCode, $cajas, $usuarios, $tipo) = $plan;
  $lic = npl_generar_licencia($planCode, $cajas, $usuarios, strtoupper(str_replace(' ', '_', $nombre)), $config['license_secret']);
  $wpdb->insert($tabla, [
    'woo_order_id' => (int)$order_id,
    'cliente_nombre' => $nombre,
    'cliente_email' => $email,
    'plan' => $planCode,
    'tipo' => $tipo,
    'max_cajas' => $cajas,
    'max_usuarios' => $usuarios,
    'monto' => $order->get_total(),
    'estado' => 'pagado',
    'licencia' => $lic,
    'fecha_creado' => current_time('mysql'),
    'fecha_pagado' => current_time('mysql'),
  ]);

  if (!npl_enviar_correo($email, $nombre, $lic, $planCode, $cajas, $usuarios, $tipo)) {
    // el correo fallo: se marca en el historial para reenviar desde el admin
    $wpdb->update($tabla, ['estado' => 'correo_fallo'], ['id' => $wpdb->insert_id]);
  }
}
add_action('woocommerce_payment_complete', 'npl_procesar_pedido', 20);
add_action('woocommerce_order_status_completed', 'npl_procesar_pedido', 20);

// ---- reenvio manual de licencia desde el historial ----
function npl_reenviar($id) {
  global $wpdb;
  $tabla = $wpdb->prefix . NPL_TABLA;
  $p = $wpdb->get_row($wpdb->prepare("SELECT * FROM `$tabla` WHERE id = %d", (int)$id));
  if (!$p || empty($p->licencia)) return 'Pedido no encontrado o sin licencia';
  $ok = npl_enviar_correo($p->cliente_email, $p->cliente_nombre, $p->licencia, $p->plan, $p->max_cajas, $p->max_usuarios, $p->tipo);
  $wpdb->update($tabla, ['estado' => $ok ? 'pagado' : 'correo_fallo'], ['id' => (int)$id]);
  return $ok ? 'Licencia reenviada a ' . $p->cliente_email : 'El correo fallo de nuevo';
}

// ---- permite .exe como archivo descargable de WooCommerce ----
add_filter('woocommerce_downloadable_file_types', function ($tipos) {
  $tipos['exe'] = 'application/octet-stream';
  return $tipos;
});

// ---- incluye la licencia dentro de los correos que envía WooCommerce al cliente ----
add_action('woocommerce_email_after_order_table', 'npl_licencia_en_correo_woo', 10, 4);
function npl_licencia_en_correo_woo($order, $sent_to_admin, $plain_text, $email) {
  global $wpdb;
  $tabla = $wpdb->prefix . NPL_TABLA;
  $p = $wpdb->get_row($wpdb->prepare("SELECT * FROM `$tabla` WHERE woo_order_id = %d", (int)$order->get_id()));
  if (!$p || empty($p->licencia)) return;
  $vigencia = $p->tipo === 'vitalicia' ? 'De por vida' : 'Anual (renovable)';
  if ($plain_text) {
    echo "\nTU LICENCIA NEXBIT POS:\n" . $p->licencia . "\nPlan " . $p->plan . ' (' . (int)$p->max_cajas . ' cajas, ' . (int)$p->max_usuarios . " usuarios) - " . $vigencia . "\n";
  } else {
    echo '<h2 style="color:#96588a;display:block;font-family:inherit;font-size:22px;font-weight:bold;margin:40px 0 10px">Tu licencia Nexbit POS</h2>
      <p style="background:#f6f6f7;border:1px dashed #ccc;border-radius:8px;padding:14px;font-family:monospace;font-size:14px">' . esc_html($p->licencia) . '</p>
      <p>Plan ' . esc_html($p->plan) . ' · ' . (int)$p->max_cajas . ' cajas · ' . (int)$p->max_usuarios . ' usuarios · ' . esc_html($vigencia) . '</p>';
  }
}

// ---- muestra la licencia al cliente en "Mi cuenta" → detalle del pedido ----
add_action('woocommerce_order_details_after_order_table', 'npl_licencia_en_mi_cuenta');
function npl_licencia_en_mi_cuenta($order) {
  global $wpdb;
  $tabla = $wpdb->prefix . NPL_TABLA;
  $p = $wpdb->get_row($wpdb->prepare("SELECT * FROM `$tabla` WHERE woo_order_id = %d", (int)$order->get_id()));
  if (!$p || empty($p->licencia)) return;
  $vigencia = $p->tipo === 'vitalicia' ? 'De por vida' : 'Anual (renovable)';
  echo '<h2 style="margin-top:40px">Tu licencia Nexbit POS</h2>
    <p style="background:#f6f6f7;border:1px dashed #ccc;border-radius:8px;padding:14px;font-family:monospace;font-size:14px;max-width:480px">' . esc_html($p->licencia) . '</p>
    <p style="color:#777">Plan ' . esc_html($p->plan) . ' · ' . (int)$p->max_cajas . ' cajas · ' . (int)$p->max_usuarios . ' usuarios · ' . esc_html($vigencia) . '</p>';
}

// ---- menu de administracion: historial + config ----
add_action('admin_menu', function () {
  add_menu_page('Nexbit Licencias', 'Nexbit Licencias', 'manage_options', 'nexbit-licencias', 'npl_pagina_historial', 'dashicons-cart', 58);
  add_submenu_page('nexbit-licencias', 'Nexbit Licencias - Configuracion', 'Configuracion', 'manage_options', 'nexbit-licencias-config', 'npl_pagina_config');
});

function npl_pagina_historial() {
  if (!current_user_can('manage_options')) wp_die('Sin permisos');
  global $wpdb;
  $tabla = $wpdb->prefix . NPL_TABLA;

  if (isset($_GET['reenviar']) && wp_verify_nonce($_GET['_wpnonce'], 'npl_reenviar_' . (int)$_GET['reenviar'])) {
    $aviso = npl_reenviar((int)$_GET['reenviar']);
  }
  $busqueda = isset($_GET['s']) ? sanitize_text_field(wp_unslash($_GET['s'])) : '';
  $where = $busqueda !== '' ? $wpdb->prepare('WHERE cliente_nombre LIKE %s OR cliente_email LIKE %s OR licencia LIKE %s', "%$busqueda%", "%$busqueda%", "%$busqueda%") : '';
  $rows = $wpdb->get_results("SELECT * FROM `$tabla` $where ORDER BY id DESC LIMIT 200");
  ?>
  <div class="wrap">
    <h1>Nexbit POS - Historial de pedidos y licencias</h1>
    <?php if (isset($aviso)) echo '<div class="notice notice-success is-dismissible"><p>' . esc_html($aviso) . '</p></div>'; ?>
    <form method="get" style="margin:12px 0">
      <input type="hidden" name="page" value="nexbit-licencias">
      <input type="search" name="s" value="<?php echo esc_attr($busqueda); ?>" placeholder="Buscar por cliente, correo o licencia..." style="min-width:320px">
      <button class="button">Buscar</button>
    </form>
    <table class="widefat striped">
      <thead><tr><th>#</th><th>Pedido Woo</th><th>Cliente</th><th>Email</th><th>Plan</th><th>Vigencia</th><th>Monto</th><th>Estado</th><th>Licencia</th><th>Pagado</th><th></th></tr></thead>
      <tbody>
      <?php foreach ($rows as $p): ?>
        <tr>
          <td><?php echo (int)$p->id; ?></td>
          <td><a href="<?php echo esc_url(admin_url('post.php?post=' . (int)$p->woo_order_id . '&action=edit')); ?>"><?php echo (int)$p->woo_order_id; ?></a></td>
          <td><?php echo esc_html($p->cliente_nombre); ?></td>
          <td><?php echo esc_html($p->cliente_email); ?></td>
          <td><?php echo esc_html($p->plan . ' (' . (int)$p->max_cajas . '/' . (int)$p->max_usuarios . ')'); ?></td>
          <td><?php echo $p->tipo === 'vitalicia' ? '<span style="color:#1a7f37">De por vida</span>' : 'Anual'; ?></td>
          <td>$<?php echo number_format((float)$p->monto, 0, ',', '.'); ?></td>
          <td><?php echo esc_html($p->estado); ?></td>
          <td><code><?php echo esc_html($p->licencia); ?></code></td>
          <td><?php echo esc_html($p->fecha_pagado); ?></td>
          <td><a class="button button-small" href="<?php echo wp_nonce_url(admin_url('admin.php?page=nexbit-licencias&reenviar=' . (int)$p->id), 'npl_reenviar_' . (int)$p->id); ?>">Reenviar licencia</a></td>
        </tr>
      <?php endforeach; ?>
      <?php if (!$rows): ?><tr><td colspan="11">Sin pedidos todavía. Cuando un pedido de WooCommerce con un producto Nexbit quede pagado, aparece aquí.</td></tr><?php endif; ?>
      </tbody>
    </table>
  </div>
  <?php
}

function npl_pagina_config() {
  if (!current_user_can('manage_options')) wp_die('Sin permisos');
  if (isset($_POST['guardar'])) {
    check_admin_referer('npl_config');
    $productos = [];
    foreach (array_keys(npl_productos()) as $tipo) {
      $productos[$tipo] = absint($_POST['productos'][$tipo] ?? 0);
    }
    update_option('npl_config', [
      'license_secret' => sanitize_text_field(wp_unslash($_POST['license_secret'] ?? '')),
      'productos' => $productos,
      'mail_from' => sanitize_email(wp_unslash($_POST['mail_from'] ?? '')),
      'exe_archivo' => sanitize_file_name(wp_unslash($_POST['exe_archivo'] ?? '')),
      'smtp_host' => sanitize_text_field(wp_unslash($_POST['smtp_host'] ?? '')),
      'smtp_port' => absint($_POST['smtp_port'] ?? 465),
      'smtp_cifrado' => in_array($_POST['smtp_cifrado'] ?? '', ['ssl', 'tls', 'ninguno']) ? ($_POST['smtp_cifrado'] == 'ninguno' ? '' : $_POST['smtp_cifrado']) : 'ssl',
      'smtp_usuario' => sanitize_email(wp_unslash($_POST['smtp_usuario'] ?? '')),
      'smtp_clave' => sanitize_text_field(wp_unslash($_POST['smtp_clave'] ?? '')),
    ]);
    echo '<div class="notice notice-success is-dismissible"><p>Configuración guardada.</p></div>';
    if (isset($_POST['probar'])) {
      $ok = wp_mail(get_option('admin_email'), 'Prueba de correo Nexbit POS', '<p>Si recibes esto, el SMTP quedó bien configurado.</p>', ['Content-Type: text/html; charset=UTF-8']);
      echo '<div class="notice ' . ($ok ? 'notice-success' : 'notice-error') . ' is-dismissible"><p>' . ($ok ? 'Correo de prueba enviado a ' . esc_html(get_option('admin_email')) : 'El correo de prueba FALLÓ. Revisa servidor, puerto, cifrado, usuario y contraseña.') . '</p></div>';
    }
  }
  $c = npl_opciones();
  ?>
  <div class="wrap">
    <h1>Nexbit POS - Configuración</h1>
    <form method="post">
      <?php wp_nonce_field('npl_config'); ?>
      <table class="form-table">
        <tr>
          <th><label>Licencias y sus productos</label></th>
          <td>
            <p class="description" style="margin-top:0">Escribe el ID de cada producto de tu tienda (WooCommerce → Productos → columna ID). Los que dejes en 0 quedan desactivados.</p>
            <table class="widefat striped" style="max-width:560px">
              <thead><tr><th>Licencia</th><th style="width:140px">ID del producto</th></tr></thead>
              <tbody>
              <?php foreach (npl_productos() as $tipo => $info): ?>
                <tr>
                  <td><strong><?php echo esc_html($info[0]); ?></strong><br><span style="color:#777"><?php echo esc_html($info[1] . ' · ' . (int)$info[2] . ' cajas · ' . (int)$info[3] . ' usuarios · ' . ($info[4] === 'vitalicia' ? 'de por vida' : 'anual')); ?></span></td>
                  <td><input type="number" name="productos[<?php echo esc_attr($tipo); ?>]" value="<?php echo (int)($c['productos'][$tipo] ?? 0); ?>" style="width:100%"></td>
                </tr>
              <?php endforeach; ?>
              </tbody>
<tr>
          <th><label>Correo SMTP (recomendado)</label></th>
          <td>
            <table class="widefat striped" style="max-width:560px">
              <tr><td style="width:160px">Servidor SMTP</td><td><input name="smtp_host" value="<?php echo esc_attr($c['smtp_host']); ?>" style="width:100%" placeholder="mail.atga.cl"></td></tr>
              <tr><td>Puerto</td><td><input name="smtp_port" type="number" value="<?php echo (int)$c['smtp_port']; ?>" style="width:100%" placeholder="465"></td></tr>
              <tr><td>Cifrado</td><td><select name="smtp_cifrado" style="width:100%">
                <option value="ssl" <?php selected($c['smtp_cifrado'], 'ssl'); ?>>SSL (puerto 465)</option>
                <option value="tls" <?php selected($c['smtp_cifrado'], 'tls'); ?>>TLS (puerto 587)</option>
                <option value="ninguno" <?php selected($c['smtp_cifrado'], ''); ?>>Sin cifrado (25)</option>
              </select></td></tr>
              <tr><td>Usuario</td><td><input name="smtp_usuario" value="<?php echo esc_attr($c['smtp_usuario']); ?>" style="width:100%" placeholder="licencias@atga.cl"></td></tr>
              <tr><td>Contraseña</td><td><input name="smtp_clave" type="password" value="<?php echo esc_attr($c['smtp_clave']); ?>" style="width:100%"></td></tr>
            </table>
            <p class="description">Sacá estos datos de cPanel → <b>Email Accounts</b> → botón <b>"Configurar cliente"</b> de tu buzón (o "Configuración manual"). Con esto, <b>todos</b> los correos de WordPress (los de WooCommerce incluidos) salen por tu buzón real y llegan.<br>
            Si dejas el servidor vacío, se sigue usando mail() de PHP (el que falla).</p>
          </td>
        </tr>
        <tr>
          <th><label>Probar correo</label></th>
          <td><button class="button" name="probar" value="1">Guardar y enviar correo de prueba</button>
            <p class="description">Manda un correo de prueba a <b><?php echo esc_html(get_option('admin_email')); ?></b> (el correo del administrador). Si llega, todo funciona.</p></td>
        </tr>
      </table>
          </td>
        </tr>
        <tr>
          <th><label>Secreto de licencias</label></th>
          <td><input name="license_secret" value="<?php echo esc_attr($c['license_secret']); ?>" style="width:320px" class="regular-text"><p class="description">Debe coincidir con el secreto de firmado de la app (web/api/index.php). No lo compartas.</p></td>
        </tr>
        <tr>
          <th><label>Correo remitente</label></th>
          <td><input name="mail_from" value="<?php echo esc_attr($c['mail_from']); ?>" style="width:320px" class="regular-text"><p class="description">Opcional. Si lo dejas vacío usa el correo del sitio. Los envíos usan wp_mail (SMTP de tu WordPress).</p></td>
        </tr>
        <tr>
          <th><label>Instalador para adjuntar</label></th>
          <td>
            <input name="exe_archivo" value="<?php echo esc_attr($c['exe_archivo']); ?>" style="width:320px" class="regular-text" placeholder="nexbit-pos-setup.exe">
            <p class="description">Nombre del .exe que adjuntarás en el correo de Básico y Pro (los Multi no lo llevan). Debe estar subido en la carpeta del plugin: <code>wp-content/plugins/nexbit-pos-licencias/</code><br>
            <b>Ojo:</b> si el .exe pesa más de ~20 MB muchos servidores de hosting no lo envían (el correo falla y el pedido queda marcado <code>correo_fallo</code> para reenviarlo). Si pesa más, lo recomendable es marcarlo como "Producto descargable" en WooCommerce (se envía un enlace de descarga y aparece en Mi Cuenta → Descargas) y dejar este campo vacío.</p>
          </td>
        </tr>
      </table>
      <button class="button button-primary" name="guardar" value="1">Guardar</button>
    </form>
  </div>
  <?php
}