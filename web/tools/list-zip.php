<?php
// listado de entradas de un zip tal como las vera PHP ZipArchive (cPanel)
$z = new ZipArchive();
if ($z->open($argv[1]) !== true) { fwrite(STDERR, "no abre: " . $argv[1] . PHP_EOL); exit(1); }
for ($i = 0; $i < $z->numFiles; $i++) echo $z->getNameIndex($i), PHP_EOL;