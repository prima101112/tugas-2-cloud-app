import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { docker, getContainerOwner } from '@/lib/docker'

export async function GET(
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
    const stats = await container.stats({ stream: false })

    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage
    const cpuPercent = systemDelta > 0 && cpuDelta > 0
      ? (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100
      : 0

    const memUsage = stats.memory_stats.usage || 0
    const memLimit = stats.memory_stats.limit || 1
    const memMb = Math.round(memUsage / 1024 / 1024)
    const memLimitMb = Math.round(memLimit / 1024 / 1024)

    return NextResponse.json({
      cpu_percent: Math.round(cpuPercent * 100) / 100,
      mem_mb: memMb,
      mem_limit_mb: memLimitMb,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
