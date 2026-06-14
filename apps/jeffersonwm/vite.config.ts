import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const dummyFileName = 'dummyjeffersonwm02'

function copyRootDummyToDist() {
  return {
    name: 'copy-root-dummy-to-dist',
    closeBundle() {
      const rootDummyPath = resolve(__dirname, dummyFileName)
      const distDir = resolve(__dirname, 'dist')
      const distDummyPath = resolve(distDir, dummyFileName)
      const legacyDistDummyPath = resolve(distDir, 'dummyjeffersonwm')

      mkdirSync(distDir, { recursive: true })

      if (existsSync(rootDummyPath)) {
        copyFileSync(rootDummyPath, distDummyPath)
      }

      if (existsSync(legacyDistDummyPath)) {
        rmSync(legacyDistDummyPath)
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/jeffersonwm/',
  plugins: [react(), copyRootDummyToDist()],
})
