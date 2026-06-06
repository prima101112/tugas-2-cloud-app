import Docker from 'dockerode'

const docker = new Docker()

export { docker }

export async function getContainerOwner(containerId: string): Promise<string | null> {
  try {
    const container = docker.getContainer(containerId)
    const info = await container.inspect()
    return info.Config.Labels?.owner || null
  } catch {
    return null
  }
}

export async function getContainerIp(containerId: string): Promise<string | null> {
  try {
    const container = docker.getContainer(containerId)
    const info = await container.inspect()
    const networks = info.NetworkSettings.Networks
    const netName = Object.keys(networks)[0]
    return networks[netName]?.IPAddress || null
  } catch {
    return null
  }
}
