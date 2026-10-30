import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'feed-build-'));
const filesToCopy = ['package.json', 'package-lock.json', 'index.html', 'tsconfig.json', 'vite.config.ts', 'src', 'public'];

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const executable = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : command;
    const spawnArgs = process.platform === 'win32' ? ['/d', '/c', [command, ...args].join(' ')] : args;
    const child = spawn(executable, spawnArgs, { cwd, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited with ${code}`)));
  });
}

try {
  console.log(`Building from temporary workspace: ${tempRoot}`);
  for (const entry of filesToCopy) {
    await fs.cp(path.join(projectRoot, entry), path.join(tempRoot, entry), { recursive: true, force: true });
  }

  await run('npm', ['ci'], tempRoot);
  await run('npx', ['vite', 'build'], tempRoot);

  const sourceDist = path.join(tempRoot, 'dist');
  const targetDist = path.join(projectRoot, 'dist');
  const html = await fs.readFile(path.join(sourceDist, 'index.html'), 'utf8');
  const assets = [...html.matchAll(/(?:src|href)="\/feed\/assets\/([^"?]+)"/g)].map((match) => match[1]);

  if (assets.length === 0 || !(await Promise.all(assets.map(async (asset) => {
    try {
      await fs.access(path.join(sourceDist, 'assets', asset));
      return true;
    } catch {
      return false;
    }
  }))).every(Boolean)) {
    throw new Error('Built Feed HTML references missing assets.');
  }

  await fs.mkdir(path.join(targetDist, 'assets'), { recursive: true });
  await fs.cp(path.join(sourceDist, 'assets'), path.join(targetDist, 'assets'), { recursive: true, force: true });
  await fs.copyFile(path.join(sourceDist, 'index.html'), path.join(targetDist, 'index.html'));
  console.log(`Copied built client to: ${targetDist}`);
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
}
