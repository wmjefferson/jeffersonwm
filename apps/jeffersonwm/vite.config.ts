import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import type { ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage } from 'node:http'

const dummyFileName = 'dummyjeffersonwm02'

function copyStaticRuntimeFilesToDist() {
  return {
    name: 'copy-static-runtime-files-to-dist',
    closeBundle() {
      const rootDummyPath = resolve(__dirname, dummyFileName)
      const faviconPath = resolve(__dirname, 'favicon.svg')
      const versionsPath = resolve(__dirname, 'versions.json')
      const distDir = resolve(__dirname, 'dist')
      const distDummyPath = resolve(distDir, dummyFileName)
      const distFaviconPath = resolve(distDir, 'favicon.svg')
      const distVersionsPath = resolve(distDir, 'versions.json')
      const legacyDistDummyPath = resolve(distDir, 'dummyjeffersonwm')
      const utilityPages = [
        resolve(distDir, 'account', 'index.html'),
        resolve(distDir, 'development', 'index.html'),
        resolve(distDir, 'project-activity', 'index.html'),
        resolve(distDir, 'status', 'index.html'),
      ]

      try {
        if (!existsSync(distDir)) {
          mkdirSync(distDir, { recursive: true })
        }
      } catch (error) {
        console.warn('[vite] Could not prepare dist folder for dummy copy.', error)
        return
      }

      try {
        if (existsSync(rootDummyPath)) {
          copyFileSync(rootDummyPath, distDummyPath)
        }

        if (existsSync(faviconPath)) {
          copyFileSync(faviconPath, distFaviconPath)
        }

        if (existsSync(versionsPath)) {
          copyFileSync(versionsPath, distVersionsPath)
        }

        if (existsSync(legacyDistDummyPath)) {
          rmSync(legacyDistDummyPath)
        }

        const assetsDir = resolve(distDir, 'assets')
        if (existsSync(assetsDir)) {
          const builtFaviconName = readdirSync(assetsDir).find((name) => /^favicon-.*\.svg$/i.test(name))

          if (builtFaviconName) {
            const utilityFaviconPath = `/jeffersonwm/assets/${builtFaviconName}`
            for (const pagePath of utilityPages) {
              if (!existsSync(pagePath)) {
                continue
              }

              const html = readFileSync(pagePath, 'utf8')
              const updated = html.replaceAll('/favicon.svg', utilityFaviconPath)
              if (updated !== html) {
                writeFileSync(pagePath, updated, 'utf8')
              }
            }
          }
        }
      } catch (error) {
        console.warn('[vite] Dist runtime file sync was skipped.', error)
      }
    },
  }
}

function prettyRootPagesInDev() {
  const pageRoutes = new Map([
    ['/account', '/account/index.html'],
    ['/account/', '/account/index.html'],
    ['/project-activity', '/project-activity/index.html'],
    ['/project-activity/', '/project-activity/index.html'],
    ['/status', '/status/index.html'],
    ['/status/', '/status/index.html'],
    ['/development', '/development/index.html'],
    ['/development/', '/development/index.html'],
  ])

  return {
    name: 'pretty-root-pages-in-dev',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req: IncomingMessage, _res, next) => {
        const pathName = req.url?.split('?')[0]
        const rewritePath = pathName ? pageRoutes.get(pathName) : undefined

        if (rewritePath && req.url && pathName) {
          req.url = req.url.replace(pathName, rewritePath)
        }

        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const widgetApiTarget = env.VITE_WIDGET_API_PROXY || 'http://127.0.0.1:8110'
  const isDev = mode === 'development'

  return {
    base: isDev ? '/' : '/jeffersonwm/',
    plugins: [react(), prettyRootPagesInDev(), copyStaticRuntimeFilesToDist()],
    server: {
      proxy: {
        '/api/widget': {
          target: widgetApiTarget,
          changeOrigin: true,
        },
        '/api/account': {
          target: widgetApiTarget,
          changeOrigin: true,
        },
        '/api/locations': {
          target: widgetApiTarget,
          changeOrigin: true,
        },
        '/api/project-activity': {
          target: widgetApiTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
