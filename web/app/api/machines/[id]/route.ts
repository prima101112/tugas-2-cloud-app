import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { docker, getContainerOwner } from '@/lib/docker'
import fs from 'fs/promises'

const ROUTES_FILE = process.cwd() + '/../traefik-dynamic/user-routes.yml'

export async function DELETE(
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

    // Clean up exposed routes for this user
    try {
      const content = await fs.readFile(ROUTES_FILE, 'utf-8')
      const lines = content.split('\n')
      const prefix = `user-${user.username}-`
      const newLines: string[] = []
      let skipBlock = false
      let currentKey = ''

      for (const line of lines) {
        const trimmed = line.trimStart()
        const indent = line.length - trimmed.length

        // Detect top-level keys under http.routers or http.services (indent 4)
        if (indent === 4 && trimmed.match(/^[\w-]+:/)) {
          currentKey = trimmed.replace(':', '')
          skipBlock = currentKey.startsWith(prefix)
          if (!skipBlock) {
            newLines.push(line)
          }
          continue
        }

        if (skipBlock) continue
        newLines.push(line)
      }

      await fs.writeFile(ROUTES_FILE, newLines.join('\n'))
    } catch {
      // File may not exist
    }

    const container = docker.getContainer(params.id)
    await container.remove({ force: true })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
