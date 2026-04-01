import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { URL } from 'node:url'
import { WebSocket, WebSocketServer } from 'ws'

const PORT = Number.parseInt(process.env.PORT ?? '3000', 10)
const HOST = process.env.HOST ?? '127.0.0.1'
const WS_PATH = process.env.WS_PATH ?? '/ws'
const GATEWAY_WS_URL = process.env.GATEWAY_WS_URL ?? 'ws://127.0.0.1:18789'
const DIST_DIR = process.env.DIST_DIR ?? path.join(process.cwd(), 'dist')

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8'
    case '.js':
      return 'text/javascript; charset=utf-8'
    case '.css':
      return 'text/css; charset=utf-8'
    case '.svg':
      return 'image/svg+xml'
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.ico':
      return 'image/x-icon'
    case '.json':
      return 'application/json; charset=utf-8'
    case '.txt':
      return 'text/plain; charset=utf-8'
    case '.woff':
      return 'font/woff'
    case '.woff2':
      return 'font/woff2'
    default:
      return 'application/octet-stream'
  }
}

function tryServeFile(res, filePath) {
  try {
    const stat = fs.statSync(filePath)
    if (!stat.isFile()) return false

    res.writeHead(200, {
      'content-type': contentTypeFor(filePath),
      'content-length': stat.size,
      'cache-control': filePath.includes(`${path.sep}assets${path.sep}`)
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    })
    fs.createReadStream(filePath).pipe(res)
    return true
  } catch {
    return false
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }

  if (url.pathname === WS_PATH) {
    // Upgrade route handled by WebSocketServer.
    res.writeHead(426, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Upgrade Required')
    return
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Method not allowed')
    return
  }

  const decodedPathname = decodeURIComponent(url.pathname)
  const rel = decodedPathname.startsWith('/') ? decodedPathname.slice(1) : decodedPathname
  const safeRel = rel.replace(/^(\.\.(\/|\\|$))+/, '')
  const candidate = path.join(DIST_DIR, safeRel)

  if (safeRel && tryServeFile(res, candidate)) return
  if (tryServeFile(res, path.join(DIST_DIR, 'index.html'))) return

  res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
  res.end(`dist introuvable: ${DIST_DIR}. Lance d'abord "npm run build".`)
})

const wss = new WebSocketServer({ server, path: WS_PATH })

wss.on('connection', (clientWs) => {
  const gatewayWs = new WebSocket(GATEWAY_WS_URL)

  const safeClose = (ws) => {
    try {
      ws.close()
    } catch {
      // ignore
    }
  }

  clientWs.on('message', (data, isBinary) => {
    if (gatewayWs.readyState === WebSocket.OPEN) gatewayWs.send(data, { binary: isBinary })
  })

  gatewayWs.on('message', (data, isBinary) => {
    if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data, { binary: isBinary })
  })

  const onClientClose = () => safeClose(gatewayWs)
  const onGatewayClose = () => safeClose(clientWs)

  clientWs.on('close', onClientClose)
  clientWs.on('error', onClientClose)
  gatewayWs.on('close', onGatewayClose)
  gatewayWs.on('error', onGatewayClose)
})

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[director-backoffice] listening on http://${HOST}:${PORT} (dist: ${DIST_DIR}, ws: ${WS_PATH} -> ${GATEWAY_WS_URL})`,
  )
})
