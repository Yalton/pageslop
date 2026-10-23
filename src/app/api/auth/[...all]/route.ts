import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/lib/auth/server'
import { redactAuthPath } from '@/lib/auth/log'

const handler = toNextJsHandler(auth)

export async function GET(req: Request) {
  console.log(`[auth] GET ${redactAuthPath(new URL(req.url))}`)
  return handler.GET!(req)
}

export async function POST(req: Request) {
  console.log(`[auth] POST ${redactAuthPath(new URL(req.url))}`)
  return handler.POST!(req)
}
