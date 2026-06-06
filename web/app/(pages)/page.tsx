'use client'

import { useState, useEffect, useCallback } from 'react'

interface Machine {
  id: string
  name: string
  status: string
  image: string
  ip: string
  exposedPorts: string[]
}

export default function HomePage() {
  const [token, setToken] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [machines, setMachines] = useState<Machine[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createImage, setCreateImage] = useState('ubuntu:22.04')
  const [showExpose, setShowExpose] = useState<string | null>(null)
  const [exposePort, setExposePort] = useState('')
  const [exposeResult, setExposeResult] = useState('')
  const [logs, setLogs] = useState<Record<string, string>>({})
  const [showLogs, setShowLogs] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    const t = localStorage.getItem('token')
    if (t) setToken(t)
  }, [])

  const fetchMachines = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/machines', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setMachines(data)
      } else if (res.status === 401) {
        localStorage.removeItem('token')
        setToken(null)
      }
    } catch {
      // ignore
    }
  }, [token])

  useEffect(() => {
    fetchMachines()
    const interval = setInterval(fetchMachines, 5000)
    return () => clearInterval(interval)
  }, [fetchMachines])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (res.ok) {
        localStorage.setItem('token', data.token)
        localStorage.setItem('username', data.username)
        setToken(data.token)
        setUsername('')
        setPassword('')
      } else {
        setError(data.error || 'Login failed')
      }
    } catch {
      setError('Network error')
    }
  }

  async function handleLogout() {
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    }
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    setToken(null)
    setMachines([])
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    try {
      const res = await fetch('/api/machines', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: createName, image: createImage }),
      })
      if (res.ok) {
        setShowCreate(false)
        setCreateName('')
        fetchMachines()
      } else {
        const data = await res.json()
        alert(data.error || 'Create failed')
      }
    } catch {
      alert('Network error')
    }
  }

  async function handleAction(id: string, action: string) {
    if (!token) return
    try {
      const res = await fetch(`/api/machines/${id}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) fetchMachines()
    } catch {
      // ignore
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this machine?')) return
    if (!token) return
    try {
      const res = await fetch(`/api/machines/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) fetchMachines()
    } catch {
      // ignore
    }
  }

  async function handleExpose(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !showExpose) return
    const machine = machines.find((m) => m.id === showExpose)
    if (!machine) return

    try {
      const res = await fetch('/api/expose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          containerId: showExpose,
          port: parseInt(exposePort),
          machineName: machine.name.replace(`${localStorage.getItem('username') || ''}-`, ''),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setExposeResult(data.url)
        fetchMachines()
      } else {
        alert(data.error || 'Expose failed')
      }
    } catch {
      alert('Network error')
    }
  }

  async function toggleLogs(id: string) {
    const showing = !showLogs[id]
    setShowLogs((prev) => ({ ...prev, [id]: showing }))
    if (showing && token) {
      try {
        const res = await fetch(`/api/machines/${id}/logs`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        setLogs((prev) => ({ ...prev, [id]: data.logs || '' }))
      } catch {
        setLogs((prev) => ({ ...prev, [id]: 'Failed to load logs' }))
      }
    }
  }

  if (!token) {
    return (
      <div style={{ maxWidth: 400, margin: '100px auto', padding: 24, border: '1px solid #ccc', borderRadius: 8 }}>
        <h1 style={{ marginBottom: 16 }}>Mini Cloud Login</h1>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ width: '100%', padding: 8, fontSize: 16 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: 8, fontSize: 16 }}
            />
          </div>
          {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
          <button type="submit" style={{ width: '100%', padding: 10, fontSize: 16 }}>
            Login
          </button>
        </form>
        <p style={{ marginTop: 16, fontSize: 12, color: '#666' }}>
          Demo users: admin/1234, alice/1234, bob/1234
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>Mini Cloud Dashboard</h1>
        <button onClick={handleLogout}>Logout</button>
      </div>

      <button onClick={() => setShowCreate(true)} style={{ marginBottom: 16 }}>
        + Create Machine
      </button>

      {showCreate && (
        <div style={{ border: '1px solid #ccc', padding: 16, marginBottom: 16, borderRadius: 8 }}>
          <h3>Create New Machine</h3>
          <form onSubmit={handleCreate}>
            <div style={{ marginBottom: 12 }}>
              <input
                type="text"
                placeholder="Machine name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                style={{ padding: 8, fontSize: 16, width: 300 }}
                required
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <select
                value={createImage}
                onChange={(e) => setCreateImage(e.target.value)}
                style={{ padding: 8, fontSize: 16, width: 300 }}
              >
                <option value="ubuntu:22.04">ubuntu:22.04</option>
                <option value="debian:12">debian:12</option>
                <option value="alpine">alpine</option>
              </select>
            </div>
            <button type="submit" style={{ marginRight: 8 }}>Create</button>
            <button type="button" onClick={() => setShowCreate(false)}>Cancel</button>
          </form>
        </div>
      )}

      {showExpose && (
        <div style={{ border: '1px solid #ccc', padding: 16, marginBottom: 16, borderRadius: 8 }}>
          <h3>Expose Port</h3>
          <form onSubmit={handleExpose}>
            <div style={{ marginBottom: 12 }}>
              <input
                type="number"
                placeholder="Port number (e.g. 8080)"
                value={exposePort}
                onChange={(e) => setExposePort(e.target.value)}
                style={{ padding: 8, fontSize: 16, width: 300 }}
                required
              />
            </div>
            <button type="submit" style={{ marginRight: 8 }}>Expose</button>
            <button type="button" onClick={() => { setShowExpose(null); setExposeResult(''); setExposePort('') }}>Cancel</button>
            {exposeResult && (
              <div style={{ marginTop: 12, padding: 8, background: '#e8f5e9' }}>
                Exposed at: <code>{exposeResult}</code>
              </div>
            )}
          </form>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #ddd' }}>Name</th>
            <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #ddd' }}>Image</th>
            <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #ddd' }}>Status</th>
            <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #ddd' }}>IP</th>
            <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #ddd' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {machines.map((m) => (
            <tr key={m.id}>
              <td style={{ padding: 12, borderBottom: '1px solid #ddd' }}>{m.name}</td>
              <td style={{ padding: 12, borderBottom: '1px solid #ddd' }}>{m.image}</td>
              <td style={{ padding: 12, borderBottom: '1px solid #ddd' }}>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: 4,
                  background: m.status === 'running' ? '#e8f5e9' : '#ffebee',
                  color: m.status === 'running' ? '#2e7d32' : '#c62828',
                }}>
                  {m.status}
                </span>
              </td>
              <td style={{ padding: 12, borderBottom: '1px solid #ddd' }}>{m.ip || '-'}</td>
              <td style={{ padding: 12, borderBottom: '1px solid #ddd' }}>
                {m.status !== 'running' && (
                  <button onClick={() => handleAction(m.id, 'start')} style={{ marginRight: 4 }}>Start</button>
                )}
                {m.status === 'running' && (
                  <button onClick={() => handleAction(m.id, 'stop')} style={{ marginRight: 4 }}>Stop</button>
                )}
                <button onClick={() => handleDelete(m.id)} style={{ marginRight: 4 }}>Delete</button>
                <a
                  href={`/terminal?id=${m.id}&token=${token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginRight: 4 }}
                >
                  <button>Terminal</button>
                </a>
                <button onClick={() => setShowExpose(m.id)} style={{ marginRight: 4 }}>Expose</button>
                <button onClick={() => toggleLogs(m.id)}>Logs</button>
              </td>
            </tr>
          ))}
          {machines.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#999' }}>
                No machines. Create one to get started.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {Object.entries(showLogs).map(([id, showing]) =>
        showing ? (
          <div key={id} style={{ marginTop: 16, border: '1px solid #ddd', borderRadius: 4 }}>
            <div style={{ padding: 8, background: '#f5f5f5', fontWeight: 'bold' }}>
              Logs: {machines.find((m) => m.id === id)?.name}
            </div>
            <pre style={{ padding: 12, maxHeight: 300, overflow: 'auto', background: '#1e1e1e', color: '#ddd', margin: 0, fontSize: 12 }}>
              {logs[id] || 'Loading...'}
            </pre>
          </div>
        ) : null
      )}
    </div>
  )
}
