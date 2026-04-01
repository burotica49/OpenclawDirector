import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

function parseAllowedHosts(raw?: string): true | string[] | undefined {
  const v = raw?.trim()
  if (!v) return undefined
  if (v === '*') return true
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const allowedHosts =
    parseAllowedHosts(env.ALLOWED_HOSTS) ??
    parseAllowedHosts(env.VITE_ALLOWED_HOSTS)

  return {
    plugins: [react()],
    server: {
      port: 5173,
      allowedHosts,
    },
    preview: {
      allowedHosts,
    },
  }
})
