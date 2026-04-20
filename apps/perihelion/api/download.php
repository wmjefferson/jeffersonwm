<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

$imagesDir = perihelion_image_root();

$data = json_decode(file_get_contents('php://input'), true);
$files = $data['files'] ?? [];

$zipName = 'selected-images.zip';
$tmpZip = tempnam(sys_get_temp_dir(), 'zip');

$zip = new ZipArchive();
if ($zip->open($tmpZip, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
  http_response_code(500);
  echo 'Could not create zip';
  exit;
}

foreach ($files as $file) {
  $original = perihelion_normalize_relative_path((string) ($file['original'] ?? ''));
  $newName = trim($file['newName'] ?? basename($original));

  $fullPath = perihelion_join_image_path($original);
  if (is_file($fullPath)) {
    $zip->addFile($fullPath, $newName);
  }
}

$zip->close();

header('Content-Type: application/zip');
header('Content-Disposition: attachment; filename="' . $zipName . '"');
header('Content-Length: ' . filesize($tmpZip));
readfile($tmpZip);
unlink($tmpZip);
