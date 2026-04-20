<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$baseDir = dirname(__DIR__);
$imagesDir = $baseDir . '/images';

$path = isset($_GET['path']) ? (string) $_GET['path'] : '';
$path = str_replace("\0", '', $path);
$path = str_replace('\\', '/', $path);
$path = preg_replace('#/+#', '/', $path);
$path = trim($path);
$path = trim($path, '/');
$path = str_replace('..', '', $path);

$targetDir = $imagesDir . ($path !== '' ? '/' . $path : '');

if (!is_dir($imagesDir)) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Images directory not found',
        'images' => [],
        'directories' => [],
        'totalPages' => 1,
        'total' => 0,
        'debug' => [
            'imagesDir' => $imagesDir,
            'targetDir' => $targetDir,
            'requestedPath' => $path,
        ],
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

if (!is_dir($targetDir)) {
    echo json_encode([
        'images' => [],
        'directories' => [],
        'totalPages' => 1,
        'total' => 0,
        'debug' => [
            'imagesDir' => $imagesDir,
            'targetDir' => $targetDir,
            'requestedPath' => $path,
            'reason' => 'Target directory does not exist',
        ],
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

$entries = scandir($targetDir);
if ($entries === false) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to read directory',
        'images' => [],
        'directories' => [],
        'totalPages' => 1,
        'total' => 0,
        'debug' => [
            'imagesDir' => $imagesDir,
            'targetDir' => $targetDir,
            'requestedPath' => $path,
        ],
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

$entries = array_values(array_diff($entries, ['.', '..']));
$files = [];
$dirs = [];

foreach ($entries as $entry) {
    $fullPath = $targetDir . '/' . $entry;

    if (is_dir($fullPath)) {
        $relativeDir = ($path !== '' ? $path . '/' : '') . $entry;
        $relativeDir = str_replace('\\', '/', $relativeDir);
        $dirs[] = $relativeDir;
        continue;
    }

    if (!is_file($fullPath)) {
        continue;
    }

    $relative = ($path !== '' ? $path . '/' : '') . $entry;
    $relative = str_replace('\\', '/', $relative);
    $files[] = $relative;
}

sort($dirs, SORT_NATURAL | SORT_FLAG_CASE);
sort($files, SORT_NATURAL | SORT_FLAG_CASE);

$total = count($files);
$totalPages = 1;

$page = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
$limit = isset($_GET['limit']) ? max(1, (int) $_GET['limit']) : max(1, $total);

$response = [
    'images' => $files,
    'directories' => $dirs,
    'totalPages' => $totalPages,
    'total' => $total,
    'debug' => [
        'imagesDir' => $imagesDir,
        'targetDir' => $targetDir,
        'requestedPath' => $path,
        'entryCount' => count($entries),
        'page' => $page,
        'limit' => $limit,
    ],
];

echo json_encode($response, JSON_UNESCAPED_SLASHES);