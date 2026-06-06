'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function TerminalPage() {
  const searchParams = useSearchParams()
  const containerId = searchParams.get('id')
  const token = searchParams.get('token')

  const terminalRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [error, setError] = useState('')
  const wsRef = useRef<WebSocket | null>(null)
  const termRef = useRef<any>(null)
  const fitAddonRef = useRef<any>(null)

  useEffect(() => {
    if (!containerId || !token) {
      setError('Missing container ID or token')
      return
    }

    let ws: WebSocket
    let term: any
    let fitAddon: any
    let resizeObserver: ResizeObserver

    async function init() {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import('xterm'),
        import('xterm-addon-fit'),
      ])

      term = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'monospace',
        theme: { background: '#1e1e1e', foreground: '#d4d4d4' },
      })
      termRef.current = term

      fitAddon = new FitAddon()
      fitAddonRef.current = fitAddon
      term.loadAddon(fitAddon)

      if (terminalRef.current) {
        term.open(terminalRef.current)
        fitAddon.fit()
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/ws/ssh/${containerId}?token=${token}`
      ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setStatus('connected')
        const dims = fitAddon.proposeDimensions()
        if (dims) {
          ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }))
        }
      }

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data)
            if (msg.type === 'error') {
              setError(msg.message)
              setStatus('disconnected')
              return
            }
          } catch {
            // not JSON, treat as terminal data
          }
          term.write(event.data)
        }
      }

      ws.onclose = () => {
        setStatus('disconnected')
      }

      ws.onerror = () => {
        setError('WebSocket error')
        setStatus('disconnected')
      }

      term.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data)
        }
      })

      resizeObserver = new ResizeObserver(() => {
        fitAddon.fit()
        const dims = fitAddon.proposeDimensions()
        if (dims && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }))
        }
      })
      if (terminalRef.current) {
        resizeObserver.observe(terminalRef.current)
      }
    }

    init()

    return () => {
      ws?.close()
      term?.dispose()
      resizeObserver?.disconnect()
    }
  }, [containerId, token])

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2 style={{ color: '#c62828' }}>Error</h2>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 16px', background: '#333', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Terminal: {containerId?.slice(0, 12)}...</span>
        <span style={{
          padding: '4px 8px',
          borderRadius: 4,
          fontSize: 12,
          background: status === 'connected' ? '#2e7d32' : status === 'connecting' ? '#f57c00' : '#c62828',
        }}>
          {status}
        </span>
      </div>
      <div ref={terminalRef} style={{ flex: 1, background: '#1e1e1e' }} />
    </div>
  )
}
