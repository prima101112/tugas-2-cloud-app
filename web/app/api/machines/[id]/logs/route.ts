import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { docker, getContainerOwner } from '@/lib/docker'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const owner = await getContainerOwner(id)
    if (owner !== user.username) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const container = docker.getContainer(id)
    const logs = await container.logs({
      tail: 50,
      stdout: true,
      stderr: true,
    })

    const logString = logs.toString('utf-8')
    return NextResponse.json({ logs: logString })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
