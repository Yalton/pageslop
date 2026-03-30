import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { NextRequest, NextResponse } from 'next/server'

const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || join(process.cwd(), 'data', 'screenshots')

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  // Sanitize: only allow UUID-like IDs
  if (!/^[a-f0-9-]{36}$/.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const filePath = join(SCREENSHOT_DIR, `${id}.webp`)

  try {
    const data = await readFile(filePath)
    return new NextResponse(data, {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
