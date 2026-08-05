import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

export function readDeployConfig(configPath) {
  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf8'));
    const remotePath = String(parsed.remotePath || '').trim();
    const uploadHost = String(parsed.uploadHost || parsed.ftpHost || parsed.host || '').trim();

    if (!uploadHost || !parsed.username || !parsed.password || !remotePath) {
      return null;
    }

    return {
      host: String(parsed.host).trim(),
      uploadHost,
      username: String(parsed.username).trim(),
      password: String(parsed.password),
      remotePath,
      protocol: String(parsed.protocol || 'ftp').trim().toLowerCase(),
    };
  } catch (_error) {
    return null;
  }
}

export function buildFtpTargetPath(remotePath, relativePath = '') {
  const pieces = [remotePath, relativePath]
    .filter(Boolean)
    .map(value => String(value).replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .flatMap(value => value.split('/').filter(Boolean));

  return `/${pieces.map(segment => encodeURIComponent(segment)).join('/')}`;
}

export function uploadFileViaFtp(config, localFilePath, remoteRelativePath = '') {
  const remoteTarget = buildFtpTargetPath(config.remotePath, remoteRelativePath);
  const ftpUrl = `ftp://${config.uploadHost}${remoteTarget}`;

  const curlResult = spawnSync('curl.exe', [
    '--silent',
    '--show-error',
    '--fail',
    '--ftp-create-dirs',
    '-u',
    `${config.username}:${config.password}`,
    '-T',
    localFilePath,
    ftpUrl,
  ], {
    stdio: 'inherit',
  });

  if (curlResult.status !== 0) {
    throw new Error(`FTP upload failed for ${ftpUrl}`);
  }
}

export function collectFilesRecursively(rootDir) {
  const results = [];

  const visit = (currentDir, relativeRoot = '') => {
    const entries = readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = relativeRoot ? path.posix.join(relativeRoot, entry.name) : entry.name;

      if (entry.isDirectory()) {
        visit(absolutePath, relativePath);
      } else if (entry.isFile()) {
        results.push({
          absolutePath,
          relativePath,
          size: statSync(absolutePath).size,
        });
      }
    }
  };

  visit(rootDir);
  return results;
}
