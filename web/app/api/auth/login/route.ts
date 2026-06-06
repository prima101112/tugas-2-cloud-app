import { NextResponse } from 'next/server'
import { USERS, generateToken } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
    }

    if (USERS[username] !== password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const token = generateToken(username)
    return NextResponse.json({ token, username })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
