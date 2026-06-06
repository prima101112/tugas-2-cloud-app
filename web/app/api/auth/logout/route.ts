import { NextResponse } from 'next/server'
import { SESSIONS, getAuthUser } from '@/lib/auth'

export async function POST(req: Request) {
  const user = getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) {
    SESSIONS.delete(auth.slice(7))
  }

  return NextResponse.json({ success: true })
}
