import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collectFilesRecursively, readDeployConfig, uploadFileViaFtp } from './ftp-upload.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dotcomsRoot = path.resolve(repoRoot, '..');
const deployConfigPath = path.join(repoRoot, '.vscode', 'sftp.json');

const appRegistry = {
  aphelion: app('Aphelion', 'aphelion', 'aphelion'),
  battalion: app('Battalion', 'battalion', 'battalion'),
  bullion: app('Bullion', 'bullion', 'bullion'),
  clionidae: standaloneApp('Clionidae', 'clionidae', 'clionidae'),
  clio: standaloneApp('Clionidae', 'clionidae', 'clionidae'),
  feed: app('Feed', 'feed', 'feed'),
  jeffersonwm: app('JeffersonWM', 'jeffersonwm', 'jeffersonwm'),
  jeffwm: app('JeffersonWM', 'jeffersonwm', 'jeffersonwm'),
  lionship: app('Lionship', 'lionship', 'lionship'),
  perihelion: app('Perihelion', 'perihelion', 'perihelion'),
  peri: app('Perihelion', 'perihelion', 'perihelion'),
  tourbillion: app('Tourbillion', 'tourbillion', 'tourbillion'),
  tourb: app('Tourbillion', 'tourbillion', 'tourbillion'),
};

function app(label, slug, remotePath) {
  const cwd = path.join(repoRoot, 'apps', slug);
  return createAppConfig(label, slug, remotePath, cwd);
}

function standaloneApp(label, folderName, remotePath) {
  const cwd = path.join(dotcomsRoot, folderName);
  return createAppConfig(label, folderName, remotePath, cwd);
}

function createAppConfig(label, slug, remotePath, cwd) {
  return {
    label,
    slug,
    cwd,
    remotePath,
    packagePath: path.join(cwd, 'package.json'),
    distDir: path.join(cwd, 'dist'),
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      continue;
    }
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function runBuild(appConfig) {
  console.log(`Building ${appConfig.label}...`);
  if (process.platform === 'win32') {
    return spawnSync('cmd.exe', ['/d', '/s', '/c', 'npm run build'], {
      cwd: appConfig.cwd,
      stdio: 'inherit',
    });
  }

  return spawnSync('npm', ['run', 'build'], {
    cwd: appConfig.cwd,
    stdio: 'inherit',
  });
}

function ensureDeployConfig() {
  const deployConfig = readDeployConfig(deployConfigPath);
  if (!deployConfig) {
    throw new Error('No FTP deploy config found. Set uploadHost, username, password, and remotePath in .vscode/sftp.json.');
  }

  if (deployConfig.protocol !== 'ftp') {
    throw new Error(`Unsupported protocol "${deployConfig.protocol}" in deploy config. Only ftp is supported.`);
  }

  return deployConfig;
}

function publishDist(appConfig, deployConfig) {
  if (!existsSync(appConfig.distDir)) {
    throw new Error(`Missing dist directory: ${appConfig.distDir}. Build the app first or let this script build it.`);
  }

  const files = collectFilesRecursively(appConfig.distDir);
  if (files.length === 0) {
    console.warn(`No files found in ${appConfig.distDir}.`);
    return;
  }

  console.log(`Uploading ${files.length} file(s) for ${appConfig.label}...`);
  for (const file of files) {
    const appRelativePath = appConfig.remotePath
      ? path.posix.join(appConfig.remotePath, file.relativePath)
      : file.relativePath;
    uploadFileViaFtp(deployConfig, file.absolutePath, appRelativePath);
  }
}

function isJeffersonwmRootSupportFile(relativePath) {
  return (
    relativePath === '.htaccess' ||
    relativePath === 'versions.json' ||
    relativePath.startsWith('status/') ||
    relativePath.startsWith('development/') ||
    /^map\d+\.(?:png|jpe?g|webp)$/i.test(relativePath) ||
    /^bookmark-preview\.(?:png|jpe?g|webp)$/i.test(relativePath)
  );
}

function publishJeffersonwmRootSupport(appConfig, deployConfig) {
  if (appConfig.slug !== 'jeffersonwm') {
    return;
  }

  const rootSupportFiles = collectFilesRecursively(appConfig.distDir).filter((file) =>
    isJeffersonwmRootSupportFile(file.relativePath),
  );

  if (rootSupportFiles.length === 0) {
    return;
  }

  console.log(`Uploading ${rootSupportFiles.length} JeffersonWM root support file(s)...`);
  for (const file of rootSupportFiles) {
    uploadFileViaFtp(deployConfig, file.absolutePath, file.relativePath);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const appName = String(args.app || '').toLowerCase();
  const appConfig = appRegistry[appName];

  if (!appConfig) {
    console.error(`Unknown app "${appName}". Use one of: ${Object.keys(appRegistry).sort().join(', ')}`);
    process.exit(1);
  }

  if (!existsSync(appConfig.packagePath)) {
    console.error(`Missing package.json for ${appName}: ${appConfig.packagePath}`);
    process.exit(1);
  }

  if (!args['skip-build']) {
    const buildResult = runBuild(appConfig);
    if (buildResult.status !== 0) {
      process.exit(buildResult.status || 1);
    }
  }

  const deployConfig = ensureDeployConfig();
  if (deployConfig.uploadHost === deployConfig.host) {
    console.warn('Using the public host as the FTP upload host. If Cloudflare is proxying that domain, uploads can fail.');
    console.warn('For the most reliable setup, point "uploadHost" at a DNS-only origin hostname such as ftp.<domain> or origin.<domain>.');
  }

  publishDist(appConfig, deployConfig);
  publishJeffersonwmRootSupport(appConfig, deployConfig);
  console.log(`Published ${appConfig.label} to ${appConfig.remotePath || '.'}`);
}

main();
