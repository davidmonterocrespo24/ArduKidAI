import { useEffect, useRef, useState } from 'react'
import { signin, signup } from '../auth/api'
import { useAppStore } from '../store/useAppStore'
import { cn } from '../lib/cn'

interface Props {
  open: boolean
  onClose: () => void
}

type Mode = 'signin' | 'signup'

export function AuthDialog({ open, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const setCurrentUser = useAppStore((s) => s.setCurrentUser)

  useEffect(() => {
    if (!open) return
    const handle = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(handle)
  }, [open])

  if (!open) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const user = mode === 'signin'
        ? await signin(email.trim(), password)
        : await signup(email.trim(), password)
      setCurrentUser(user)
      setEmail('')
      setPassword('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="mb-3 flex gap-2 border-b border-slate-200 dark:border-slate-800">
          {(['signin', 'signup'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'pb-2 text-sm font-semibold',
                mode === m
                  ? 'border-b-2 border-emerald-500 text-emerald-600'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
              )}
            >
              {m === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
          ))}
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Signing in is optional. Anonymous play still works and your projects are scoped to this
          browser tab.
        </p>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
          Email
        </label>
        <input
          ref={inputRef}
          type="email"
          value={email}
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <label className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-300">
          Password
        </label>
        <input
          type="password"
          value={password}
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
          minLength={8}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        {mode === 'signup' && (
          <p className="mt-1 text-[11px] text-slate-500">At least 8 characters.</p>
        )}
        {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {busy ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        </div>
      </form>
    </div>
  )
}
