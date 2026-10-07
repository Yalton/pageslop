import http from 'node:http'
import net from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type GuardedProxy, startGuardedProxy } from '@/lib/net/guarded-proxy'

let proxy: GuardedProxy

beforeAll(async () => {
  proxy = await startGuardedProxy({
    resolve: async (host) => {
      if (host === 'evil.example') return [{ address: '192.168.50.1', family: 4 }]
      throw new Error(`ENOTFOUND ${host}`)
    },
  })
})

afterAll(() => proxy.close())

function proxiedGet(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: proxy.port, method: 'GET', path: url }, (res) => {
      res.resume()
      resolve(res.statusCode ?? 0)
    })
    req.on('error', reject)
    req.end()
  })
}

function connect(target: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const sock = net.connect(proxy.port, '127.0.0.1', () => {
      sock.write(`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n\r\n`)
    })
    let data = ''
    sock.on('data', (d) => {
      data += d.toString()
      if (data.includes('\r\n\r\n')) {
        sock.destroy()
        resolve(data.split('\r\n')[0])
      }
    })
    sock.on('end', () => resolve(data.split('\r\n')[0]))
    sock.on('error', reject)
  })
}

describe('guarded proxy', () => {
  it.each([
    'http://127.0.0.1/',
    'http://192.168.50.1/',
    'http://[::1]/',
    'http://2130706433/',
    'http://evil.example/',
    'http://example.com:8080/',
  ])('refuses plain-HTTP request to %s', async (url) => {
    expect(await proxiedGet(url)).toBe(403)
  })

  it.each(['127.0.0.1:443', '192.168.50.78:81', '[::1]:443', 'evil.example:443', '169.254.169.254:80'])(
    'refuses CONNECT to %s',
    async (target) => {
      expect(await connect(target)).toMatch(/^HTTP\/1\.1 403/)
    },
  )
})
