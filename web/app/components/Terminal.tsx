'use client'

import { useEffect, useRef, useState } from 'react'

interface TerminalProps {
  containerId: string
  token: string
}

export default function Terminal({ containerId, token }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!containerId || !token) {
      setLoadError('Missing container ID or token')
      return
    }

    let ws: WebSocket
    let term: any
    let fitAddon: any
    let resizeObserver: ResizeObserver
    let closed = false

    async function init() {
      try {
        const [{ Terminal }, { FitAddon }] = await Promise.all([
          import('xterm'),
          import('xterm-addon-fit'),
        ])

        if (closed) return

        term = new Terminal({
          cursorBlink: true,
          fontSize: 13,
          fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
          theme: {
            background: '#0d1117',
            foreground: '#e6edf3',
            cursor: '#e6edf3',
            selectionBackground: '#264f78',
            black: '#484f58',
            red: '#ff7b72',
            green: '#7ee787',
            yellow: '#ffa657',
            blue: '#79c0ff',
            magenta: '#d2a8ff',
            cyan: '#a5d6ff',
            white: '#e6edf3',
          },
          scrollback: 5000,
        })

        fitAddon = new FitAddon()
        term.loadAddon(fitAddon)

        if (terminalRef.current) {
          term.open(terminalRef.current)
          fitAddon.fit()
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsUrl = `${protocol}//${window.location.host}/ws/ssh/${containerId}?token=${token}`
        ws = new WebSocket(wsUrl)

        ws.onopen = () => {
          if (closed) return
          const dims = fitAddon.proposeDimensions()
          if (dims) {
            ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }))
          }
        }

        ws.onmessage = (event) => {
          if (closed) return
          if (typeof event.data === 'string') {
            try {
              const msg = JSON.parse(event.data)
              if (msg.type === 'error') {
                term.writeln(`\r\n\x1b[31mError: ${msg.message}\x1b[0m`)
                return
              }
            } catch {
              // not JSON, treat as terminal data
            }
            term.write(event.data)
          } else if (event.data instanceof Blob) {
            const reader = new FileReader()
            reader.onload = () => term.write(reader.result)
            reader.readAsText(event.data)
          }
        }

        ws.onclose = () => {
          if (closed) return
          term.writeln('\r\n\x1b[33m[Connection closed]\x1b[0m')
        }

        ws.onerror = () => {
          if (closed) return
          term.writeln('\r\n\x1b[31m[WebSocket error]\x1b[0m')
        }

        term.onData((data: string) => {
          if (!closed && ws.readyState === WebSocket.OPEN) {
            ws.send(data)
          }
        })

        resizeObserver = new ResizeObserver(() => {
          if (closed) return
          fitAddon.fit()
          const dims = fitAddon.proposeDimensions()
          if (dims && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }))
          }
        })

        if (terminalRef.current) {
          resizeObserver.observe(terminalRef.current)
        }
      } catch (err: any) {
        setLoadError(err.message || 'Failed to load terminal')
      }
    }

    init()

    return () => {
      closed = true
      ws?.close()
      term?.dispose()
      resizeObserver?.disconnect()
    }
  }, [containerId, token])

  if (loadError) {
    return (
      <div style={{ color: '#f85149', padding: 20, textAlign: 'center' }}>
        ⚠️ {loadError}
      </div>
    )
  }

  return (
    <div
      ref={terminalRef}
      style={{ width: '100%', height: '100%' }}
    />
  )
}
