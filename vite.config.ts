import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { networkInterfaces } from 'node:os'
import { TTL_SECONDS, validateImage, validateSession } from './api/_lib/signStore.js'

interface LocalSignature {
  image: string
  expiresAt: number
}

function findLanIpv4(): string {
  const addresses = Object.values(networkInterfaces()).flatMap((entries) => entries || [])
  return addresses.find((entry) =>
    entry.family === 'IPv4' &&
    !entry.internal &&
    (
      entry.address.startsWith('10.') ||
      entry.address.startsWith('192.168.') ||
      entry.address.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(entry.address)
    ),
  )?.address || ''
}

function sendJson(res: ServerResponse, status: number, data: object): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 256 * 1024) throw new Error('request_too_large')
    chunks.push(buffer)
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

// 本機 QR 簽名由 Vite 自己暫存，避免 /api/sign 被 proxy 到另一個舊 dev server。
// 正式環境不會載入這個 middleware，仍使用 server.js 或 Vercel API。
function localSignatureApi(): Plugin {
  const sessions = new Map<string, LocalSignature>()

  return {
    name: 'local-signature-api',
    configureServer(server) {
      server.middlewares.use('/api/sign/network-info', (req, res, next) => {
        if (req.method !== 'GET') return next()
        const host = process.env.VITE_SIGN_PUBLIC_HOST || findLanIpv4()
        if (!host) return sendJson(res, 503, { error: '找不到可供手機連線的區網 IP' })
        sendJson(res, 200, { host })
      })

      server.middlewares.use('/api/sign/submit', (req, res, next) => {
        if (req.method !== 'POST') return next()

        void readJsonBody(req)
          .then((body) => {
            const { session, image } = (body || {}) as { session?: unknown; image?: unknown }
            const sessionError = validateSession(session)
            if (sessionError) return sendJson(res, 400, { error: sessionError })
            const imageError = validateImage(image)
            if (imageError) return sendJson(res, 400, { error: imageError })

            sessions.set(session as string, {
              image: image as string,
              expiresAt: Date.now() + TTL_SECONDS * 1000,
            })
            sendJson(res, 200, { ok: true })
          })
          .catch((error: unknown) => {
            const message = error instanceof Error && error.message === 'request_too_large'
              ? '簽名圖過大'
              : '請求格式錯誤'
            sendJson(res, 400, { error: message })
          })
      })

      server.middlewares.use('/api/sign/poll', (req, res, next) => {
        if (req.method !== 'GET') return next()

        const session = new URL(req.url || '/', 'http://localhost').searchParams.get('session')
        const sessionError = validateSession(session)
        if (sessionError) return sendJson(res, 400, { error: sessionError })

        const entry = sessions.get(session as string)
        if (!entry || entry.expiresAt < Date.now()) {
          sessions.delete(session as string)
          return sendJson(res, 200, { status: 'pending' })
        }

        sessions.delete(session as string)
        sendJson(res, 200, { status: 'done', image: entry.image })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [localSignatureApi(), react()],
  server: {
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
})
