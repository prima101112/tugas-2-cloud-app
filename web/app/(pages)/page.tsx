'use client'

import { useState, useEffect, useCallback } from 'react'
import styles from './page.module.css'
import Terminal from '../components/Terminal'

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
  const [showTerminalId, setShowTerminalId] = useState<string | null>(null)
  const [showTerminalToken, setShowTerminalToken] = useState<string | null>(null)
  const [showTerminalName, setShowTerminalName] = useState<string>('')

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

  function openTerminal(machine: Machine) {
    if (!token) return
    setShowTerminalId(machine.id)
    setShowTerminalToken(token)
    setShowTerminalName(machine.name)
  }

  function closeTerminal() {
    setShowTerminalId(null)
    setShowTerminalToken(null)
    setShowTerminalName('')
  }

  const total = machines.length
  const running = machines.filter((m) => m.status === 'running').length
  const stopped = machines.filter((m) => m.status !== 'running').length

  if (!token) {
    return (
      <div className={styles.loginPage}>
        <div className={styles.loginCard}>
          <div className={styles.loginTitle}>Mini Cloud</div>
          <form onSubmit={handleLogin}>
            <div className={styles.formGroup}>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={styles.input}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                required
              />
            </div>
            {error && <div className={`${styles.formError} ${styles.mb1}`}>{error}</div>}
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary} ${styles.wFull}`}>
              Login
            </button>
          </form>
          <p className={styles.loginHint}>Demo users: admin/1234, alice/1234, bob/1234</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>Mini Cloud</div>
        <button className={styles.logoutBtn} onClick={handleLogout}>
          Logout
        </button>
      </header>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Machines</div>
          <div className={styles.statValue}>{total}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Running</div>
          <div className={`${styles.statValue} ${styles.statValueSuccess}`}>
            {running}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Stopped</div>
          <div className={`${styles.statValue} ${styles.statValueDanger}`}>
            {stopped}
          </div>
        </div>
      </div>

      <button className={`${styles.btn} ${styles.btnPrimary} ${styles.createBtn}`} onClick={() => setShowCreate(true)}>
        + Create Machine
      </button>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Image</th>
              <th>Status</th>
              <th>IP</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {machines.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.image}</td>
                <td>
                  <span
                    className={`${styles.badge} ${
                      m.status === 'running'
                        ? styles.badgeRunning
                        : m.status === 'stopped'
                        ? styles.badgeStopped
                        : styles.badgeOther
                    }`}
                  >
                    {m.status}
                  </span>
                </td>
                <td>{m.ip || '-'}</td>
                <td>
                  <div className={styles.actionGroup}>
                    {m.status !== 'running' && (
                      <button className={`${styles.btn} ${styles.btnSuccess} ${styles.btnSm}`} onClick={() => handleAction(m.id, 'start')}>
                        Start
                      </button>
                    )}
                    {m.status === 'running' && (
                      <button className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`} onClick={() => handleAction(m.id, 'stop')}>
                        Stop
                      </button>
                    )}
                    <button className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`} onClick={() => handleDelete(m.id)}>
                      Delete
                    </button>
                    <button className={`${styles.btn} ${styles.btnSm}`} onClick={() => openTerminal(m)}>
                      Terminal
                    </button>
                    <button className={`${styles.btn} ${styles.btnSm}`} onClick={() => setShowExpose(m.id)}>
                      Expose
                    </button>
                    <button className={`${styles.btn} ${styles.btnSm}`} onClick={() => toggleLogs(m.id)}>
                      Logs
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {machines.length === 0 && (
              <tr>
                <td colSpan={5} className={styles.emptyCell}>
                  No machines. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {Object.entries(showLogs).map(([id, showing]) =>
        showing ? (
          <div key={id} className={styles.logsPanel}>
            <div className={styles.logsHeader}>
              <span>Logs: {machines.find((m) => m.id === id)?.name}</span>
              <button className={styles.modalClose} onClick={() => toggleLogs(id)}>
                ×
              </button>
            </div>
            <pre className={styles.logsPre}>{logs[id] || 'Loading...'}</pre>
          </div>
        ) : null
      )}

      {showCreate && (
        <div className={styles.modalOverlay} onClick={() => setShowCreate(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Create New Machine</h3>
              <button className={styles.modalClose} onClick={() => setShowCreate(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Machine name</label>
                  <input
                    type="text"
                    placeholder="e.g. web-server"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    className={styles.input}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Image</label>
                  <select value={createImage} onChange={(e) => setCreateImage(e.target.value)} className={styles.select}>
                    <option value="ubuntu:22.04">ubuntu:22.04</option>
                    <option value="debian:12">debian:12</option>
                    <option value="alpine">alpine</option>
                  </select>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btn} onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showExpose && (
        <div className={styles.modalOverlay} onClick={() => { setShowExpose(null); setExposeResult(''); setExposePort('') }}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Expose Port</h3>
              <button
                className={styles.modalClose}
                onClick={() => { setShowExpose(null); setExposeResult(''); setExposePort('') }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleExpose}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Port number</label>
                  <input
                    type="number"
                    placeholder="e.g. 8080"
                    value={exposePort}
                    onChange={(e) => setExposePort(e.target.value)}
                    className={styles.input}
                    required
                  />
                </div>
                {exposeResult && (
                  <div className={styles.resultBox}>
                    Exposed at: <code>{exposeResult}</code>
                  </div>
                )}
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => { setShowExpose(null); setExposeResult(''); setExposePort('') }}
                >
                  Cancel
                </button>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                  Expose
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className={`${styles.terminalPanel} ${showTerminalId ? styles.terminalPanelOpen : ''}`}>
        <div className={styles.terminalHeader}>
          <span className={styles.terminalTitle}>Terminal: {showTerminalName}</span>
          <button className={styles.modalClose} onClick={closeTerminal}>
            ×
          </button>
        </div>
        <div className={styles.terminalBody}>
          {showTerminalId && showTerminalToken && (
            <Terminal containerId={showTerminalId} token={showTerminalToken} />
          )}
        </div>
      </div>
    </div>
  )
}
