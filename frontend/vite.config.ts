import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function normalizeBasePath(value: string | undefined): string {
  if (!value || value.trim().length === 0 || value.trim() === '/') {
    return '/'
  }
  let normalized = value.trim()
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`
  }
  if (!normalized.endsWith('/')) {
    normalized = `${normalized}/`
  }
  return normalized
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const appBasePath = normalizeBasePath(env.VITE_APP_BASE_PATH)

  return {
    base: appBasePath,
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        // Opcional: use VITE com baseURL vazio e chame /api/... se preferir; por padrão o cliente usa VITE_API_BASE_URL completa
        '/api': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
