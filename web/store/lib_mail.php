<?php
// Envio de correo. Usa PHPMailer si esta instalado en la carpeta (PHPMailer/),
// si no SMTP directo nativo y, como ultimo recurso, mail() del servidor.
function enviarCorreo($cfg, $para, $asunto, $html, $texto) {
  $logs = $cfg['EMAIL_LOGS'] ?? '';
  if ($logs !== '') {
    if (!is_dir($logs)) @mkdir($logs, 0777, true);
    @file_put_contents($logs . '/correo-' . date('Ymd-His') . '-' . substr(md5($para), 0, 6) . '.html', $html);
  }
  $desde = [$cfg['MAIL_FROM'], $cfg['MAIL_FROM_NAME']];

  if (class_exists('PHPMailer\PHPMailer\PHPMailer')) {
    $m = new PHPMailer\PHPMailer\PHPMailer(true);
    try {
      if ($cfg['SMTP_HOST']) {
        $m->isSMTP();
        $m->Host = $cfg['SMTP_HOST'];
        $m->Port = (int)$cfg['SMTP_PORT'];
        $m->SMTPAuth = true;
        $m->Username = $cfg['SMTP_USER'];
        $m->Password = $cfg['SMTP_PASS'];
        $m->SMTPSecure = $cfg['SMTP_PORT'] == 587 ? PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS : PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
        $m->CharSet = 'UTF-8';
      }
      $m->setFrom($desde[0], $desde[1]);
      $m->addAddress($para);
      $m->Subject = $asunto;
      $m->isHTML(true);
      $m->Body = $html;
      $m->AltBody = $texto;
      $m->send();
      return [true, null];
    } catch (Throwable $e) { return [false, 'PHPMailer: ' . $e->getMessage()]; }
  }

  if ($cfg['SMTP_HOST']) {
    $conn = @stream_socket_client(($cfg['SMTP_PORT'] == 587 ? 'tcp://' : 'ssl://') . $cfg['SMTP_HOST'] . ':' . $cfg['SMTP_PORT'], $errno, $errstr, 15);
    if ($conn === false) return [false, 'SMTP directo: ' . $errstr];
    $f = function ($cmd = null) use ($conn) { if ($cmd !== null) fwrite($conn, $cmd . "\r\n"); return fgets($conn); };
    $f('EHLO localhost');
    $f('AUTH LOGIN');
    $f(base64_encode($cfg['SMTP_USER']));
    $f(base64_encode($cfg['SMTP_PASS']));
    $f('MAIL FROM:<' . $desde[0] . '>');
    $f('RCPT TO:<' . $para . '>');
    $f('DATA');
    fwrite($conn, "Content-Type: text/html; charset=UTF-8\r\nFrom: " . $desde[0] . "\r\nTo: " . $para . "\r\nSubject: " . mb_encode_mimeheader($asunto) . "\r\n\r\n" . $html . "\r\n.\r\n");
    $f('QUIT');
    fclose($conn);
    return [true, null];
  }

  $ok = @mail($para, '=?UTF-8?B?' . base64_encode($asunto) . '?=', $html, "Content-Type: text/html; charset=UTF-8\r\nFrom: " . $desde[0] . "\r\nReply-To: " . $desde[0]);
  return [$ok, $ok ? null : 'mail() fallo'];
}