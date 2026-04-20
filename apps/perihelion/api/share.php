<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$baseDir  = dirname(__DIR__);
$shareDir = $baseDir . '/shares';

if (!is_dir($shareDir)) {
    mkdir($shareDir, 0775, true);
}

// Generate 4-char LIMITED MIXED CASE 178,365
function random_id($length = 4) {
    $chars = 'abcdefghkmnpqrstuvwxyzABCDEFGHKMNPQRSTUVWXYZ';
    $id = '';
    for ($i = 0; $i < $length; $i++) {
        $id .= $chars[rand(0, strlen($chars) - 1)];
    }
    return $id;
}

// Always random 4-char ID, ignores title completely
function make_slug($title, $randomSuffix = true) {
    return random_id();  // Just 4-char mixed case every time
}

// GET: load share
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $id = isset($_GET['id']) ? trim($_GET['id']) : '';
    $id = str_replace(['..', '/', '\\'], '', $id);

    if ($id === '') {
        echo json_encode(['error' => 'Missing id']);
        exit;
    }

    $file = $shareDir . '/' . $id . '.json';
    if (!is_file($file)) {
        echo json_encode(['error' => 'Share not found']);
        exit;
    }

    $json = file_get_contents($file);
    $data = json_decode($json, true);
    if (!is_array($data)) {
        echo json_encode(['error' => 'Invalid share data']);
        exit;
    }

    echo json_encode($data);
    exit;
}

// POST: create share
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $files = $input['images'] ?? [];
    $title = isset($input['title']) ? trim($input['title']) : '';

    if (!is_array($files) || count($files) === 0) {
        echo json_encode(['error' => 'No images provided']);
        exit;
    }

    $id   = make_slug($title, true); // includes 8 random chars
    $path = $shareDir . '/' . $id . '.json';

    // Avoid collisions
    $id = make_slug($title);  // Will always be 4-char random

    $path = $shareDir . '/' . $id . '.json';
    while (file_exists($path)) {
        $id = random_id();  // Retry 4-char on collision
        $path = $shareDir . '/' . $id . '.json';
    }

    $payload = [
        'id'     => $id,
        'title'  => $title,
        'images' => array_values($files),
        'created_at' => date('c'),
    ];

    file_put_contents($path, json_encode($payload));

    echo json_encode(['id' => $id]);
    exit;
}

// Other methods
http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);