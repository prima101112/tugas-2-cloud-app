import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { docker } from '@/lib/docker'

export async function GET(req: Request) {
  const user = getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const containers = await docker.listContainers({ all: true })
    const userContainers = containers.filter((c: any) =>
      c.Labels?.owner === user.username
    )

    const result = userContainers.map((c: any) => ({
      id: c.Id,
      name: c.Names[0]?.replace(/^\//, '') || '',
      status: c.State,
      image: c.Image,
      ip: (Object.values(c.NetworkSettings?.Networks || {})[0] as any)?.IPAddress || '',
      exposedPorts: c.Labels?.exposed ? JSON.parse(c.Labels.exposed || '[]') : [],
    }))

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const user = getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { name, image } = await req.json()
    if (!name || !image) {
      return NextResponse.json({ error: 'Name and image required' }, { status: 400 })
    }

    const containerName = `${user.username}-${name}`
    const networkName = `net-${user.username}`

    // Create network if not exists
    try {
      await docker.getNetwork(networkName).inspect()
    } catch {
      await docker.createNetwork({
        Name: networkName,
        Driver: 'bridge',
        CheckDuplicate: true,
      })
    }

    const container = await docker.createContainer({
      Image: image,
      name: containerName,
      Hostname: name,
      Labels: {
        owner: user.username,
        image: image,
        exposed: '[]',
      },
      HostConfig: {
        NetworkMode: networkName,
      },
      Cmd: ['sleep', 'infinity'],
    })

    await container.start()

    const info = await container.inspect()
    return NextResponse.json({
      id: info.Id,
      name: containerName,
      status: info.State.Status,
      image: image,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
