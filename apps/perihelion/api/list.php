<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$imagesDir = perihelion_image_root();

if (!is_dir($imagesDir)) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Images directory not found',
        'expected' => $imagesDir,
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

$requestedPath = isset($_GET['path']) ? (string) $_GET['path'] : '';
$requestedPath = perihelion_normalize_relative_path($requestedPath);

$currentDir = $imagesDir;
if ($requestedPath !== '') {
    $candidate = perihelion_join_image_path($requestedPath);
    if (!is_dir($candidate)) {
        http_response_code(404);
        echo json_encode([
            'error' => 'Folder not found',
            'requested' => $requestedPath,
        ], JSON_UNESCAPED_SLASHES);
        exit;
    }
    $currentDir = $candidate;
}

$renderableExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp'];
$videoExts = ['mp4', 'webm', 'mov', 'm4v', 'avi'];
$folders = [];
$files = [];
$imageCount = 0;
$otherCount = 0;

$items = scandir($currentDir);
if ($items === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to read directory'], JSON_UNESCAPED_SLASHES);
    exit;
}

foreach ($items as $item) {
    if ($item === '.' || $item === '..') {
        continue;
    }

    $fullPath = $currentDir . DIRECTORY_SEPARATOR . $item;
    $relativePath = ltrim(str_replace($imagesDir, '', $fullPath), DIRECTORY_SEPARATOR);
    $relativePath = str_replace(DIRECTORY_SEPARATOR, '/', $relativePath);

    if (is_dir($fullPath)) {
        $folders[] = [
            'name' => $item,
            'path' => $relativePath,
            'type' => 'directory',
            'modified' => @filemtime($fullPath) ?: 0,
        ];
        continue;
    }

    if (!is_file($fullPath)) {
        continue;
    }

    $ext = strtolower(pathinfo($item, PATHINFO_EXTENSION));
    $kind = 'other';

    if (in_array($ext, $renderableExts, true)) {
        $kind = 'image';
        $imageCount++;
    } elseif (in_array($ext, $videoExts, true)) {
        $kind = 'video';
        $otherCount++;
    } else {
        $otherCount++;
    }

    $files[] = [
        'name' => $item,
        'path' => $relativePath,
        'type' => 'file',
        'ext' => $ext !== '' ? '.' . $ext : '',
        'size' => @filesize($fullPath) ?: 0,
        'modified' => @filemtime($fullPath) ?: 0,
        'kind' => $kind,
        'url' => '/media/' . implode('/', array_map('rawurlencode', explode('/', $relativePath))),
    ];
}

usort($folders, static fn(array $a, array $b): int => strcasecmp($a['name'], $b['name']));
usort($files, static fn(array $a, array $b): int => strcasecmp($a['name'], $b['name']));

$breadcrumbs = [];
if ($requestedPath !== '') {
    $parts = explode('/', $requestedPath);
    $build = [];
    foreach ($parts as $part) {
        $build[] = $part;
        $breadcrumbs[] = [
            'name' => $part,
            'path' => implode('/', $build),
        ];
    }
}

echo json_encode([
    'root' => '',
    'current' => $requestedPath,
    'folders' => $folders,
    'files' => $files,
    'breadcrumbs' => $breadcrumbs,
    'counts' => [
        'folders' => count($folders),
        'files' => count($files),
        'images' => $imageCount,
        'other' => $otherCount,
    ],
], JSON_UNESCAPED_SLASHES);
