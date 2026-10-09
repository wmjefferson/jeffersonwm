import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = path.join(repoRoot, 'apps', 'iwenttocity')
const asoPublishScript = path.join(repoRoot, 'scripts', 'publish-aso.mjs')
const serverRootTarget =
  process.env.IWENTTOCITY_SERVER_DIR || '\\\\JEFFERSHIZZLE-D\\Dotcoms E\\iwenttocity'
const backendTarget = path.join(serverRootTarget, 'backend')

const backendCopies = [
  '.env.example',
  '.gitignore',
  'dist',
  'index.html',
  'package-lock.json',
  'package.json',
  'public',
  'server.ts',
  'src',
  'tsconfig.app.json',
  'tsconfig.json',
  'tsconfig.node.json',
  'vite.config.ts',
]

const replaceBeforeCopy = ['dist', 'public', 'src']

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (!value.startsWith('--')) {
      continue
    }

    const key = value.slice(2)
    const next = argv[index + 1]
    if (!next || next.startsWith('--')) {
      args[key] = true
      continue
    }

    args[key] = next
    index += 1
  }

  return args
}

function runFrontendPublish({ skipBuild = false } = {}) {
  const publishArgs = [asoPublishScript, '--app', 'iwenttocity']
  if (skipBuild) {
    publishArgs.push('--skip-build')
  }

  const result = spawnSync('node', publishArgs, {
    cwd: repoRoot,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    throw new Error(`Frontend publish failed with exit code ${result.status ?? 1}`)
  }
}

function copyIfPresent(sourcePath, targetPath) {
  if (!existsSync(sourcePath)) {
    return
  }

  cpSync(sourcePath, targetPath, { recursive: true, force: true, dereference: true })
}

function syncBackendSource() {
  if (!existsSync(appRoot)) {
    throw new Error(`Missing I Went to City source folder: ${appRoot}`)
  }

  mkdirSync(backendTarget, { recursive: true })

  for (const relativePath of replaceBeforeCopy) {
    const targetPath = path.join(backendTarget, relativePath)
    if (existsSync(targetPath)) {
      rmSync(targetPath, { recursive: true, force: true })
    }
  }

  for (const relativePath of backendCopies) {
    copyIfPresent(path.join(appRoot, relativePath), path.join(backendTarget, relativePath))
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!args['backend-only']) {
    console.log('Publishing I Went to City frontend to ASO...')
    runFrontendPublish({ skipBuild: Boolean(args['skip-build']) })
  }

  console.log(`Syncing I Went to City backend/source to ${backendTarget}...`)
  syncBackendSource()

  console.log('I Went to City publish complete.')
}

main()
