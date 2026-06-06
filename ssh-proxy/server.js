const WebSocket = require('ws')
const Docker = require('dockerode')
const jwt = require('jsonwebtoken')

const JWT_SECRET = 'mini-cloud-secret-key-2024'
const PORT = 3000

const docker = new Docker()
const wss = new WebSocket.Server({ port: PORT })

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

async function getContainerOwner(containerId) {
  try {
    const container = docker.getContainer(containerId)
    const info = await container.inspect()
    return info.Config.Labels?.owner || null
  } catch {
    return null
  }
}

/**
 * Docker exec stream demultiplexer.
 * Format: [type(1 byte), padding(3 bytes), size(4 bytes big-endian), payload(size bytes)]
 * type: 0=stdin, 1=stdout, 2=stderr
 */
function demuxStream(stream, onPayload) {
  let buffer = Buffer.alloc(0)

  stream.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk])

    while (buffer.length >= 8) {
      const size = buffer.readUInt32BE(4)
      if (buffer.length < 8 + size) break

      const payload = buffer.slice(8, 8 + size)
      onPayload(payload)
      buffer = buffer.slice(8 + size)
    }
  })
}

wss.on('connection', async (ws, req) => {
  console.log('[WS] New connection from', req.socket.remoteAddress, 'URL:', req.url)
  const url = new URL(req.url, 'http://localhost')
  const pathParts = url.pathname.split('/')
  const containerId = pathParts[pathParts.length - 1]
  const token = url.searchParams.get('token')

  if (!containerId || !token) {
    ws.send(JSON.stringify({ type: 'error', message: 'Missing container ID or token' }))
    ws.close()
    return
  }

  const decoded = verifyToken(token)
  if (!decoded) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }))
    ws.close()
    return
  }

  const owner = await getContainerOwner(containerId)
  if (owner !== decoded.username) {
    ws.send(JSON.stringify({ type: 'error', message: 'Access denied' }))
    ws.close()
    return
  }

  let exec = null
  let stream = null

  try {
    const container = docker.getContainer(containerId)
    const info = await container.inspect()
    const imageLabel = info.Config.Labels?.image || ''
    const shell = imageLabel.includes('alpine') ? '/bin/sh' : '/bin/bash'
    console.log('[WS] Starting exec for container', containerId, 'user', decoded.username, 'shell', shell)

    exec = await container.exec({
      Cmd: [shell, '-l'],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
    })

    stream = await exec.start({
      hijack: true,
      stdin: true,
    })
    console.log('[WS] Exec stream started for container', containerId)

    // Demultiplex docker stream and send clean payload to websocket
    demuxStream(stream, (payload) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload.toString('utf-8'))
      }
    })

    stream.on('end', () => {
      console.log('[WS] Exec stream ended for container', containerId)
      if (ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
    })

    stream.on('error', (err) => {
      console.error('[WS] Stream error for container', containerId, ':', err.message)
    })

    // Handle input from websocket -> container
    ws.on('message', (message) => {
      const data = message.toString()
      try {
        const msg = JSON.parse(data)
        if (msg.type === 'resize' && exec) {
          exec.resize({ h: msg.rows, w: msg.cols })
          return
        }
      } catch {
        // Not JSON, treat as raw input
      }
      if (stream) {
        stream.write(data)
      }
    })

    ws.on('close', () => {
      console.log('[WS] Connection closed for container', containerId)
      if (stream) {
        stream.destroy()
      }
    })

    ws.on('error', (err) => {
      console.error('[WS] WebSocket error for container', containerId, ':', err)
      if (stream) {
        stream.destroy()
      }
    })
  } catch (err) {
    console.error('[WS] Exec error for container', containerId, ':', err)
    ws.send(JSON.stringify({ type: 'error', message: err.message || 'Failed to start terminal' }))
    ws.close()
  }
})

console.log(`SSH Proxy listening on ws://localhost:${PORT}`)
