import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const localPracticeOnly = {
  name: 'local-practice-only',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use(guardPractice)
  },
  configurePreviewServer(server: import('vite').PreviewServer) {
    server.middlewares.use(guardPractice)
  },
}

function guardPractice(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, next: () => void) {
  if (!req.url?.startsWith('/api/practice/')) return next()
  const address = req.socket.remoteAddress
  const host = req.headers.host?.split(':')[0]
  const origin = req.headers.origin
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address ?? '') || !['localhost', '127.0.0.1'].includes(host ?? '') || (origin && origin !== `http://${req.headers.host}` && origin !== `https://${req.headers.host}`)) {
    res.writeHead(403).end('Local access only')
    return
  }
  next()
}

const proxy = { '/api/practice': { target: 'http://127.0.0.1:8765', changeOrigin: true } }

export default defineConfig({
  plugins: [vue(), tailwindcss(), localPracticeOnly],
  server: { proxy },
  preview: { proxy },
})
