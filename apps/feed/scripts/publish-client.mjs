import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(projectRoot, 'dist');
const configPath = process.env.FEED_DEPLOY_CONFIG;

if (!configPath) {
  throw new Error('Set FEED_DEPLOY_CONFIG to the FTP deployment config before publishing Feed.');
}

if (!existsSync(distDir) || !existsSync(configPath)) {
  throw new Error('Feed dist or FTP deployment config is missing.');
}

const config = JSON.parse(readFileSync(configPath, 'utf8'));
const uploadHost = String(config.uploadHost || config.ftpHost || config.host || '').trim();
const username = String(config.username || '').trim();
const password = String(config.password || '');
const remoteRoot = String(config.remotePath || '').replace(/^\/+|\/+$/g, '');

if (String(config.protocol || 'ftp').toLowerCase() !== 'ftp' || !uploadHost || !username || !password || !remoteRoot) {
  throw new Error('FTP deployment config is incomplete or unsupported.');
}

function collectFiles(directory, relativePath = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    const relativeFilePath = relativePath ? path.posix.join(relativePath, entry.name) : entry.name;

    if (entry.isDirectory()) {
      return collectFiles(absolutePath, relativeFilePath);
    }

    return entry.isFile() ? [{ absolutePath, relativeFilePath }] : [];
  });
}

const files = collectFiles(distDir);
if (files.length === 0) {
  throw new Error('Feed dist is empty. Run npm run build first.');
}

for (const file of files) {
  const remotePath = [remoteRoot, 'feed', file.relativeFilePath]
    .map((segment) => segment.replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
  const target = `ftp://${uploadHost}/${remotePath}`;
  console.log(`Uploading feed/${file.relativeFilePath}`);
  execFileSync('curl.exe', [
    '--silent',
    '--show-error',
    '--fail',
    '--ftp-create-dirs',
    '-u',
    `${username}:${password}`,
    '-T',
    file.absolutePath,
    target,
  ], { stdio: 'inherit' });
}

console.log(`Published ${files.length} Feed client files.`);
