import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/lib/auth/server'

const handler = toNextJsHandler(auth)

export async function GET(req: Request) {
  const url = new URL(req.url)
  console.log(`[auth] GET ${url.pathname}${url.search}`)
  return handler.GET!(req)
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  console.log(`[auth] POST ${url.pathname}`)
  return handler.POST!(req)
}
