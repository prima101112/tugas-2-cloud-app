import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { docker, getContainerOwner, getContainerIp } from '@/lib/docker'
import fs from 'fs/promises'
import path from 'path'

const ROUTES_FILE = path.join(process.cwd(), '..', 'traefik-dynamic', 'user-routes.yml')

async function readRoutes(): Promise<any> {
  try {
    const content = await fs.readFile(ROUTES_FILE, 'utf-8')
    return parseYaml(content)
  } catch {
    return { http: { routers: {}, services: {} } }
  }
}

async function writeRoutes(doc: any) {
  await fs.mkdir(path.dirname(ROUTES_FILE), { recursive: true })
  await fs.writeFile(ROUTES_FILE, stringifyYaml(doc))
}

function parseYaml(content: string): any {
  const lines = content.split('\n')
  const doc: any = { http: { routers: {}, services: {} } }
  let currentRouter: string | null = null
  let currentService: string | null = null
  let section: 'routers' | 'services' | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const indent = line.length - line.trimStart().length

    // Section headers at indent 2
    if (indent === 2) {
      if (trimmed === 'routers:') {
        section = 'routers'
        currentRouter = null
        currentService = null
        continue
      }
      if (trimmed === 'services:') {
        section = 'services'
        currentRouter = null
        currentService = null
        continue
      }
    }

    // Top-level keys at indent 4 (router or service names)
    if (indent === 4 && /^[\w-]+:\s*$/.test(trimmed)) {
      const key = trimmed.replace(':', '').trim()
      if (section === 'routers') {
        doc.http.routers[key] = {}
        currentRouter = key
        currentService = null
      } else if (section === 'services') {
        doc.http.services[key] = { loadBalancer: { servers: [] } }
        currentService = key
        currentRouter = null
      }
      continue
    }

    // Router properties
    if (currentRouter && section === 'routers') {
      if (trimmed.startsWith('rule:')) {
        doc.http.routers[currentRouter].rule = trimmed.slice(5).trim().replace(/^"/, '').replace(/"$/, '')
      } else if (trimmed.startsWith('service:')) {
        doc.http.routers[currentRouter].service = trimmed.slice(8).trim()
      } else if (trimmed.startsWith('priority:')) {
        doc.http.routers[currentRouter].priority = parseInt(trimmed.slice(9).trim())
      }
    }

    // Service properties
    if (currentService && section === 'services' && trimmed.startsWith('- url:')) {
      const url = trimmed.slice(6).trim().replace(/^"/, '').replace(/"$/, '')
      doc.http.services[currentService].loadBalancer.servers.push({ url })
    }
  }

  return doc
}

function stringifyYaml(doc: any): string {
  let out = 'http:\n  routers:\n'
  for (const [key, router] of Object.entries(doc.http.routers || {})) {
    const r = router as any
    out += `    ${key}:\n`
    out += `      rule: "${r.rule}"\n`
    out += `      service: ${r.service}\n`
    if (r.priority) out += `      priority: ${r.priority}\n`
  }
  out += '  services:\n'
  for (const [key, svc] of Object.entries(doc.http.services || {})) {
    const s = svc as any
    out += `    ${key}:\n`
    out += `      loadBalancer:\n`
    out += `        servers:\n`
    for (const srv of s.loadBalancer.servers || []) {
      out += `          - url: "${srv.url}"\n`
    }
  }
  return out
}

export async function POST(req: Request) {
  const user = getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { containerId, port, machineName } = await req.json()
    if (!containerId || !port || !machineName) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const owner = await getContainerOwner(containerId)
    if (owner !== user.username) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const ip = await getContainerIp(containerId)
    if (!ip) {
      return NextResponse.json({ error: 'Container not running or no IP' }, { status: 400 })
    }

    const safeMachine = machineName.replace(/[^a-zA-Z0-9_-]/g, '-')
    const routeKey = `user-${user.username}-${safeMachine}-${port}`
    const routeKeySvc = `${routeKey}-svc`
    const urlPath = `/user/${user.username}/${safeMachine}/${port}`

    const doc = await readRoutes()
    if (!doc.http) doc.http = { routers: {}, services: {} }
    if (!doc.http.routers) doc.http.routers = {}
    if (!doc.http.services) doc.http.services = {}

    doc.http.routers[routeKey] = {
      rule: `PathPrefix(\`${urlPath}\`)`,
      service: routeKeySvc,
      priority: 20,
    }
    doc.http.services[routeKeySvc] = {
      loadBalancer: {
        servers: [{ url: `http://${ip}:${port}` }],
      },
    }

    await writeRoutes(doc)

    return NextResponse.json({ url: urlPath })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const user = getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { containerId, port } = await req.json()
    if (!containerId || !port) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const container = docker.getContainer(containerId)
    const info = await container.inspect()
    const machineName = info.Name.replace(/^\//, '').replace(`${user.username}-`, '')
    const safeMachine = machineName.replace(/[^a-zA-Z0-9_-]/g, '-')
    const routeKey = `user-${user.username}-${safeMachine}-${port}`

    const doc = await readRoutes()
    if (doc.http?.routers?.[routeKey]) {
      delete doc.http.routers[routeKey]
      delete doc.http.services[`${routeKey}-svc`]
      await writeRoutes(doc)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
