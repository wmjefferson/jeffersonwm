import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const dummyFileName = 'dummyjeffersonwm02'

function copyStaticRuntimeFilesToDist() {
  return {
    name: 'copy-static-runtime-files-to-dist',
    closeBundle() {
      const rootDummyPath = resolve(__dirname, dummyFileName)
      const versionsPath = resolve(__dirname, 'versions.json')
      const distDir = resolve(__dirname, 'dist')
      const distDummyPath = resolve(distDir, dummyFileName)
      const distVersionsPath = resolve(distDir, 'versions.json')
      const legacyDistDummyPath = resolve(distDir, 'dummyjeffersonwm')

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

        if (existsSync(versionsPath)) {
          copyFileSync(versionsPath, distVersionsPath)
        }

        if (existsSync(legacyDistDummyPath)) {
          rmSync(legacyDistDummyPath)
        }
      } catch (error) {
        console.warn('[vite] Dist runtime file sync was skipped.', error)
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/jeffersonwm/',
  plugins: [react(), copyStaticRuntimeFilesToDist()],
})
