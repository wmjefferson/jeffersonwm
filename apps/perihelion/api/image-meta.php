<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

$file = isset($_GET['file']) ? trim($_GET['file']) : '';
$file = perihelion_normalize_relative_path($file);
$fullPath = perihelion_join_image_path($file);

if (!$file || !file_exists($fullPath) || !is_file($fullPath)) {
  echo json_encode(['error' => 'File not found']);
  exit;
}

$size = filesize($fullPath);
$info = @getimagesize($fullPath);

echo json_encode([
  'type' => mime_content_type($fullPath),
  'size' => $size,
  'width' => $info ? $info[0] : null,
  'height' => $info ? $info[1] : null,
]);
