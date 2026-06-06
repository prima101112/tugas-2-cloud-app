import jwt from 'jsonwebtoken'

export const JWT_SECRET = 'mini-cloud-secret-key-2024'

export const USERS: Record<string, string> = {
  admin: '1234',
  alice: '1234',
  bob: '1234',
}

// Token denylist for logout (in-memory, cleared on server restart)
export const REVOKED = new Set<string>()

export function generateToken(username: string): string {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' })
}

export function verifyToken(token: string): { username: string } | null {
  try {
    if (REVOKED.has(token)) return null
    const decoded = jwt.verify(token, JWT_SECRET) as { username: string }
    return decoded
  } catch {
    return null
  }
}

export function revokeToken(token: string) {
  REVOKED.add(token)
}

export function getAuthUser(req: Request): { username: string } | null {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return verifyToken(auth.slice(7))
}
