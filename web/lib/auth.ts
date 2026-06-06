import jwt from 'jsonwebtoken'

export const JWT_SECRET = 'mini-cloud-secret-key-2024'

export const USERS: Record<string, string> = {
  admin: '1234',
  alice: '1234',
  bob: '1234',
}

export const SESSIONS = new Map<string, string>() // token -> username

export function generateToken(username: string): string {
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' })
  SESSIONS.set(token, username)
  return token
}

export function verifyToken(token: string): { username: string } | null {
  try {
    if (!SESSIONS.has(token)) return null
    const decoded = jwt.verify(token, JWT_SECRET) as { username: string }
    return decoded
  } catch {
    SESSIONS.delete(token)
    return null
  }
}

export function getAuthUser(req: Request): { username: string } | null {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return verifyToken(auth.slice(7))
}
