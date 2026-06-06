import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { docker, getContainerOwner } from '@/lib/docker'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const owner = await getContainerOwner(params.id)
    if (owner !== user.username) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const container = docker.getContainer(params.id)
    await container.stop()
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
