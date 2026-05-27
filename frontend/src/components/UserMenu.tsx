import { useEffect, useState } from 'react'
import { fetchCurrentUser, signout } from '../auth/api'
import { useAppStore } from '../store/useAppStore'
import { AuthDialog } from './AuthDialog'
import { IconUser } from './Icons'

export function UserMenu() {
  const currentUser = useAppStore((s) => s.currentUser)
  const setCurrentUser = useAppStore((s) => s.setCurrentUser)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const user = await fetchCurrentUser()
        if (!cancelled) setCurrentUser(user)
      } finally {
        if (!cancelled) setHydrated(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [setCurrentUser])

  function handleSignOut() {
    signout()
    setCurrentUser(null)
  }

  if (!hydrated) {
    return <span className="text-xs text-slate-400">...</span>
  }

  if (currentUser) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="hidden text-slate-500 sm:inline">Signed in as</span>
        <span className="max-w-[180px] truncate font-medium text-slate-700 dark:text-slate-200">
          {currentUser.email}
        </span>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-brand-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-brand-700 shadow-sm hover:bg-brand-50 dark:border-brand-800 dark:text-brand-200 dark:hover:bg-brand-950/30"
      >
        <IconUser />
        Sign in
      </button>
      <AuthDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  )
}
