'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Cloud, LogOut, Plus, Play, Square, Trash2, Terminal, Globe, FileText,
  Server, Activity, CircleDot, X, ChevronRight, Shield, Loader2
} from 'lucide-react'
import TerminalComponent from '../components/Terminal'

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
  const [showTerminalName, setShowTerminalName] = useState('')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
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
    setLoading(true)
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
    } finally {
      setLoading(false)
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
    setLoading(true)
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
    } finally {
      setLoading(false)
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

    setLoading(true)
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
    } finally {
      setLoading(false)
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

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    )
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-500/10 via-dark-950 to-dark-950" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-purple/5 rounded-full blur-3xl" />

        <div className="relative z-10 w-full max-w-md mx-4">
          <div className="bg-dark-900/80 backdrop-blur-xl border border-dark-700/50 rounded-2xl p-8 shadow-2xl shadow-black/50">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-brand-500 to-accent-purple mb-4 shadow-lg shadow-brand-500/20">
                <Cloud className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Mini Cloud</h1>
              <p className="text-dark-400 text-sm mt-1">Container platform for everyone</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder-dark-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                  required
                />
              </div>
              <div>
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder-dark-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                  required
                />
              </div>
              {error && (
                <div className="px-4 py-3 bg-accent-red/10 border border-accent-red/20 rounded-xl text-accent-red text-sm">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-dark-800 text-center">
              <p className="text-dark-500 text-xs">
                Demo: <span className="text-dark-400">admin/1234</span> · <span className="text-dark-400">alice/1234</span> · <span className="text-dark-400">bob/1234</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-dark-800/60 bg-dark-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-accent-purple shadow-lg shadow-brand-500/20">
                <Cloud className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">Mini Cloud</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-dark-800/80 border border-dark-700/50 rounded-full">
                <Shield className="w-3.5 h-3.5 text-brand-400" />
                <span className="text-sm text-dark-300">{localStorage.getItem('username') || 'User'}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="relative overflow-hidden rounded-2xl bg-dark-900 border border-dark-800 p-6">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20">
                <Server className="w-6 h-6 text-brand-400" />
              </div>
              <div>
                <p className="text-dark-500 text-sm font-medium">Total Machines</p>
                <p className="text-3xl font-bold text-white">{total}</p>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-dark-900 border border-dark-800 p-6">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent-green/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-accent-green/10 border border-accent-green/20">
                <Activity className="w-6 h-6 text-accent-green" />
              </div>
              <div>
                <p className="text-dark-500 text-sm font-medium">Running</p>
                <p className="text-3xl font-bold text-accent-green">{running}</p>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-dark-900 border border-dark-800 p-6">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent-red/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-accent-red/10 border border-accent-red/20">
                <CircleDot className="w-6 h-6 text-accent-red" />
              </div>
              <div>
                <p className="text-dark-500 text-sm font-medium">Stopped</p>
                <p className="text-3xl font-bold text-accent-red">{stopped}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Machines</h2>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-400 text-white font-medium rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-brand-500/20"
          >
            <Plus className="w-4 h-4" />
            Create Machine
          </button>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-dark-800/60 bg-dark-900/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-800/60">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-dark-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-dark-500 uppercase tracking-wider">Image</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-dark-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-dark-500 uppercase tracking-wider hidden sm:table-cell">IP</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-dark-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-800/40">
                {machines.map((m) => (
                  <tr key={m.id} className="group hover:bg-dark-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-dark-800 border border-dark-700 flex items-center justify-center">
                          <Server className="w-4 h-4 text-dark-400" />
                        </div>
                        <span className="font-medium text-white">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-dark-400 font-mono">{m.image}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        m.status === 'running'
                          ? 'bg-accent-green/10 text-accent-green border border-accent-green/20'
                          : 'bg-accent-red/10 text-accent-red border border-accent-red/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${m.status === 'running' ? 'bg-accent-green animate-pulse' : 'bg-accent-red'}`} />
                        {m.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <span className="text-sm text-dark-400 font-mono">{m.ip || '—'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {m.status !== 'running' && (
                          <button
                            onClick={() => handleAction(m.id, 'start')}
                            className="p-2 text-dark-400 hover:text-accent-green hover:bg-accent-green/10 rounded-lg transition-all"
                            title="Start"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                        {m.status === 'running' && (
                          <button
                            onClick={() => handleAction(m.id, 'stop')}
                            className="p-2 text-dark-400 hover:text-accent-amber hover:bg-accent-amber/10 rounded-lg transition-all"
                            title="Stop"
                          >
                            <Square className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="p-2 text-dark-400 hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openTerminal(m)}
                          className="p-2 text-dark-400 hover:text-brand-400 hover:bg-brand-500/10 rounded-lg transition-all"
                          title="Terminal"
                        >
                          <Terminal className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setShowExpose(m.id)}
                          className="p-2 text-dark-400 hover:text-accent-cyan hover:bg-accent-cyan/10 rounded-lg transition-all"
                          title="Expose Port"
                        >
                          <Globe className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleLogs(m.id)}
                          className="p-2 text-dark-400 hover:text-dark-200 hover:bg-dark-800 rounded-lg transition-all"
                          title="Logs"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {machines.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-dark-800 border border-dark-700 flex items-center justify-center">
                          <Server className="w-8 h-8 text-dark-600" />
                        </div>
                        <p className="text-dark-500">No machines yet</p>
                        <p className="text-dark-600 text-sm">Create your first machine to get started</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Logs panels */}
        {Object.entries(showLogs).map(([id, showing]) =>
          showing ? (
            <div key={id} className="mt-4 rounded-2xl border border-dark-800/60 bg-dark-900/50 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-3 border-b border-dark-800/40">
                <span className="text-sm font-medium text-dark-400">
                  Logs: <span className="text-white">{machines.find((m) => m.id === id)?.name}</span>
                </span>
                <button onClick={() => toggleLogs(id)} className="p-1 text-dark-500 hover:text-white rounded transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <pre className="px-6 py-4 max-h-80 overflow-auto text-xs font-mono text-dark-300 whitespace-pre-wrap break-all">
                {logs[id] || 'Loading...'}
              </pre>
            </div>
          ) : null
        )}
      </main>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-md bg-dark-900 border border-dark-700/50 rounded-2xl shadow-2xl shadow-black/50 p-6 animate-[fadeIn_0.15s_ease-out]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Create Machine</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 text-dark-500 hover:text-white rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-400 mb-2">Machine name</label>
                <input
                  type="text"
                  placeholder="e.g. web-server"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder-dark-600 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-400 mb-2">Operating System</label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { value: 'ubuntu:22.04', label: 'Ubuntu 22.04 LTS', desc: 'Full-featured, apt package manager, systemd', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
                    { value: 'debian:12', label: 'Debian 12 (Bookworm)', desc: 'Stable, apt package manager, minimal', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
                    { value: 'alpine', label: 'Alpine Linux (latest)', desc: 'Ultra-lightweight, apk package manager, musl libc', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
                  ].map((img) => (
                    <label
                      key={img.value}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        createImage === img.value
                          ? `${img.bg} border-brand-500 ring-1 ring-brand-500/30`
                          : 'border-dark-700 hover:border-dark-600 bg-dark-800/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="image"
                        value={img.value}
                        checked={createImage === img.value}
                        onChange={(e) => setCreateImage(e.target.value)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        createImage === img.value ? 'border-brand-500' : 'border-dark-600'
                      }`}>
                        {createImage === img.value && <div className="w-2 h-2 rounded-full bg-brand-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${img.color}`}>{img.label}</span>
                          {createImage === img.value && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 bg-brand-500/20 text-brand-400 rounded">Selected</span>
                          )}
                        </div>
                        <p className="text-xs text-dark-500 mt-0.5">{img.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-3 bg-dark-800 text-dark-300 font-medium rounded-xl border border-dark-700 hover:bg-dark-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-brand-500 hover:bg-brand-400 text-white font-medium rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expose Modal */}
      {showExpose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowExpose(null); setExposeResult(''); setExposePort('') }} />
          <div className="relative w-full max-w-md bg-dark-900 border border-dark-700/50 rounded-2xl shadow-2xl shadow-black/50 p-6 animate-[fadeIn_0.15s_ease-out]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Expose Port</h3>
              <button
                onClick={() => { setShowExpose(null); setExposeResult(''); setExposePort('') }}
                className="p-1 text-dark-500 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleExpose} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-400 mb-2">Port number</label>
                <input
                  type="number"
                  placeholder="e.g. 8080"
                  value={exposePort}
                  onChange={(e) => setExposePort(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder-dark-600 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                  required
                />
              </div>
              {exposeResult && (
                <div className="p-4 bg-brand-500/10 border border-brand-500/20 rounded-xl">
                  <p className="text-sm text-dark-400 mb-1">Exposed at:</p>
                  <code className="text-sm font-mono text-brand-400 break-all">{exposeResult}</code>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowExpose(null); setExposeResult(''); setExposePort('') }}
                  className="flex-1 px-4 py-3 bg-dark-800 text-dark-300 font-medium rounded-xl border border-dark-700 hover:bg-dark-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-brand-500 hover:bg-brand-400 text-white font-medium rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Expose'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Terminal Slide-out */}
      <div className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[600px] lg:w-[700px] bg-dark-950 border-l border-dark-800 shadow-2xl shadow-black/50 transform transition-transform duration-300 ease-out ${
        showTerminalId ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-6 py-4 border-b border-dark-800/60 bg-dark-900/50">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/20">
                <Terminal className="w-4 h-4 text-brand-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">{showTerminalName || 'Terminal'}</h3>
                <p className="text-xs text-dark-500">Interactive shell session</p>
              </div>
            </div>
            <button
              onClick={closeTerminal}
              className="p-2 text-dark-500 hover:text-white hover:bg-dark-800 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 p-4 overflow-hidden">
            {showTerminalId && showTerminalToken && (
              <TerminalComponent containerId={showTerminalId} token={showTerminalToken} />
            )}
          </div>
        </div>
      </div>

      {/* Terminal backdrop */}
      {showTerminalId && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={closeTerminal} />
      )}
    </div>
  )
}
