<?php
require_once __DIR__ . '/store-funciones.php';
$planes = $STORE_CFG['PLANES'];
$err = $_GET['err'] ?? '';
$ok = $_GET['ok'] ?? '';
?>
<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>Nexbit POS - Comprar licencia</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body{margin:0;font-family:Arial,sans-serif;background:#f4f4f5;color:#1c1c1e}
  header{background:#1c1c1e;color:#fff;padding:18px 24px}<b>Nexbit</b> <span style="color:#FF4B00">POS</span>
  .wrap{max-width:960px;margin:24px auto;padding:0 16px}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-top:16px}
  .card{background:#fff;border-radius:12px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
  .card h3{margin:0 0 4px}.card .precio{font-size:24px;font-weight:700;color:#FF4B00;margin:8px 0}
  .card ul{margin:8px 0 16px;padding-left:18px;color:#555;font-size:14px}
  .btn{display:inline-block;background:#FF4B00;color:#fff;border:none;border-radius:8px;padding:10px 16px;font-size:14px;cursor:pointer;text-decoration:none}
  input{width:100%;padding:9px 10px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box;margin-top:4px}
  .aviso{max-width:960px;margin:16px auto;padding:10px 14px;border-radius:8px}
  .aviso.ok{background:#e7f6ec;color:#14652c}.aviso.err{background:#fdeaea;color:#8f1d1d}
</style></head>
<body>
<header>&nbsp;<b>Nexbit</b> <span style="color:#FF4B00">POS</span> · Licencias web</header>
<div class="wrap">
  <h2>Elige tu plan</h2>
  <p style="color:#666">Pago seguro con Flow. Al confirmar recibes el código de licencia por correo.</p>
  <?php if ($ok): ?><div class="aviso ok"><?= htmlspecialchars($ok) ?></div><?php endif; ?>
  <?php if ($err): ?><div class="aviso err"><?= htmlspecialchars($err) ?></div><?php endif; ?>
  <div class="cards">
    <?php foreach ($planes as $id => $p): list($cajas, $usuarios, $precio, $desc) = $p; ?>
    <div class="card">
      <h3><?= $id ?></h3>
      <div class="precio">$<?= number_format($precio, 0, ',', '.') ?></div>
      <ul><li><?= $desc ?></li></ul>
      <form method="post" action="pagar.php">
        <input type="hidden" name="plan" value="<?= $id ?>">
        <input name="nombre" placeholder="Tu nombre" required>
        <input type="email" name="email" placeholder="Correo (te llega la licencia)" required style="margin-top:8px">
        <button class="btn" style="margin-top:12px;width:100%">Pagar con Flow</button>
      </form>
    </div>
    <?php endforeach; ?>
  </div>
</div>
</body></html>