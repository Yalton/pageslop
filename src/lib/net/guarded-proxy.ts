/**
 * Loopback-only HTTP forward proxy that applies the SSRF policy to every
 * connection Chromium makes (pages, subresources, redirects, WebSockets,
 * service workers). The proxy resolves the host itself, refuses blocked
 * addresses, and connects to the vetted IP, so Chromium never resolves or
 * connects to anything on its own (no DNS rebinding window).
 *
 * Plain http:// requests arrive in absolute form and are forwarded;
 * https:// and ws(s):// arrive as CONNECT tunnels.
 */
import http from 'node:http'
import net from 'node:net'
import { assertUrlAllowed, hostnameOf, type Resolver, resolveHost } from './ssrf-guard'

export interface GuardedProxy {
  port: number
  close(): Promise<void>
}

const HOP_BY_HOP = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]

async function vet(target: string, resolver?: Resolver): Promise<{ ip: string; port: number; url: URL }> {
  const url = assertUrlAllowed(target)
  const [first] = await resolveHost(hostnameOf(url), resolver)
  const port = Number(url.port) || (url.protocol === 'https:' ? 443 : 80)
  return { ip: first.address, port, url }
}

export async function startGuardedProxy(options: { resolve?: Resolver } = {}): Promise<GuardedProxy> {
  const sockets = new Set<net.Socket>()
  const track = (s: net.Socket) => {
    sockets.add(s)
    s.on('close', () => sockets.delete(s))
  }

  const server = http.createServer(async (req, res) => {
    try {
      const { ip, port, url } = await vet(req.url ?? '', options.resolve)
      if (url.protocol !== 'http:') throw new Error('absolute-form proxying is http only')
      const headers = { ...req.headers }
      for (const h of HOP_BY_HOP) delete headers[h]
      const upstream = http.request(
        { host: ip, port, method: req.method, path: `${url.pathname}${url.search}`, headers, setHost: false },
        (up) => {
          for (const h of HOP_BY_HOP) delete up.headers[h]
          res.writeHead(up.statusCode ?? 502, up.headers)
          up.pipe(res)
        },
      )
      upstream.on('socket', track)
      upstream.on('error', () => {
        if (!res.headersSent) res.writeHead(502)
        res.end()
      })
      req.pipe(upstream)
    } catch {
      res.writeHead(403, { 'content-type': 'text/plain' })
      res.end('Blocked by SSRF policy')
    }
  })

  server.on('connection', track)

  server.on('connect', async (req, clientSocket: net.Socket, head: Buffer) => {
    track(clientSocket)
    clientSocket.on('error', () => {})
    try {
      // req.url is "host:port"; validate it as an https URL so the port rule applies.
      const { ip, port } = await vet(`https://${req.url ?? ''}/`, options.resolve)
      const upstream = net.connect(port, ip)
      track(upstream)
      upstream.on('connect', () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
        if (head.length) upstream.write(head)
        upstream.pipe(clientSocket)
        clientSocket.pipe(upstream)
      })
      upstream.on('error', () => {
        if (clientSocket.writable) clientSocket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n')
        clientSocket.destroy()
      })
      clientSocket.on('close', () => upstream.destroy())
    } catch {
      clientSocket.end('HTTP/1.1 403 Forbidden\r\n\r\n')
    }
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const { port } = server.address() as net.AddressInfo

  return {
    port,
    close: () =>
      new Promise<void>((resolve) => {
        for (const s of sockets) s.destroy()
        server.close(() => resolve())
      }),
  }
}
