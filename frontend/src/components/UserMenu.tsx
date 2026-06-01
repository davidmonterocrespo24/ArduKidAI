import { useEffect, useRef, useState } from 'react'
import { fetchCurrentUser, signout } from '../auth/api'
import { useAppStore } from '../store/useAppStore'
import { AuthDialog } from './AuthDialog'
import { KnowledgeModal } from './KnowledgeModal'
import { ProjectsModal } from './ProjectsModal'
import { IconBrain, IconFolder, IconLogout, IconUser } from './Icons'

export function UserMenu() {
  const currentUser = useAppStore((s) => s.currentUser)
  const setCurrentUser = useAppStore((s) => s.setCurrentUser)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [projectsOpen, setProjectsOpen] = useState(false)
  const [documentsOpen, setDocumentsOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!menuOpen) return
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  function handleSignOut() {
    signout()
    setCurrentUser(null)
    setMenuOpen(false)
  }

  if (!hydrated) {
    return <span className="text-xs text-slate-400">...</span>
  }

  if (!currentUser) {
    return (
      <>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-md border border-brand-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-brand-700 shadow-sm hover:bg-brand-50"
        >
          <IconUser />
          Sign in
        </button>
        <AuthDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      </>
    )
  }

  const initial = currentUser.email.charAt(0).toUpperCase()
  const itemCls =
    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-brand-50'

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        className="inline-flex items-center justify-center rounded-md border border-brand-200 bg-white p-1 text-sm font-medium text-slate-700 shadow-sm hover:bg-brand-50"
        title={currentUser.email}
        aria-label={currentUser.email}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
          {initial}
        </span>
      </button>

      {menuOpen && (
        <div className="absolute right-0 z-40 mt-1 w-56 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 bg-brand-50 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-brand-700">Signed in as</div>
            <div className="truncate text-sm font-medium text-slate-800">{currentUser.email}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              setProjectsOpen(true)
              setMenuOpen(false)
            }}
            className={itemCls}
          >
            <IconFolder className="text-brand-500" />
            My projects
          </button>
          <button
            type="button"
            onClick={() => {
              setDocumentsOpen(true)
              setMenuOpen(false)
            }}
            className={itemCls}
          >
            <IconBrain className="text-brand-500" />
            My documents
          </button>
          <div className="border-t border-slate-100">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
            >
              <IconLogout />
              Sign out
            </button>
          </div>
        </div>
      )}

      <ProjectsModal open={projectsOpen} onClose={() => setProjectsOpen(false)} />
      <KnowledgeModal open={documentsOpen} onClose={() => setDocumentsOpen(false)} />
    </div>
  )
}
