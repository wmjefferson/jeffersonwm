<?php
declare(strict_types=1);

function perihelion_image_root(): string
{
    $configured = getenv('PERIHELION_IMAGES_DIR');
    if (is_string($configured) && trim($configured) !== '') {
        return rtrim($configured, "\\/");
    }

    return 'E:\\images';
}

function perihelion_normalize_relative_path(string $path): string
{
    $path = str_replace("\0", '', $path);
    $path = str_replace('\\', '/', $path);
    $path = preg_replace('#/+#', '/', $path) ?? '';
    $path = trim($path, '/');
    return str_replace('..', '', $path);
}

function perihelion_join_image_path(string $relativePath): string
{
    $root = perihelion_image_root();
    if ($relativePath === '') {
        return $root;
    }

    return $root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);
}
