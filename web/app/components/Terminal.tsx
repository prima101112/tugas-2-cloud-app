'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle } from 'lucide-react'

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
          fontFamily: 'var(--font-mono)',
          theme: {
            background: '#020617',
            foreground: '#e2e8f0',
            cursor: '#e2e8f0',
            selectionBackground: '#1e3a5f',
            black: '#1e293b',
            red: '#f87171',
            green: '#4ade80',
            yellow: '#fbbf24',
            blue: '#60a5fa',
            magenta: '#c084fc',
            cyan: '#22d3ee',
            white: '#e2e8f0',
            brightBlack: '#334155',
            brightRed: '#fca5a5',
            brightGreen: '#86efac',
            brightYellow: '#fde047',
            brightBlue: '#93c5fd',
            brightMagenta: '#d8b4fe',
            brightCyan: '#67e8f9',
            brightWhite: '#f8fafc',
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
          term.writeln('\r\n\x1b[31m[WebSocket error — check server logs]\x1b[0m')
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
      <div className="flex flex-col items-center justify-center h-full gap-4 text-accent-red">
        <AlertCircle className="w-8 h-8" />
        <p className="text-sm">{loadError}</p>
      </div>
    )
  }

  return (
    <div
      ref={terminalRef}
      className="w-full h-full rounded-xl overflow-hidden"
    />
  )
}
