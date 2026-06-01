import { useCallback, useEffect, useState } from 'react'
import { getProject, listProjects, type ProjectSummary } from '../agent/projects'
import { useAppStore } from '../store/useAppStore'
import { IconFolder } from './Icons'

interface Props {
  open: boolean
  onClose: () => void
}

export function ProjectsModal({ open, onClose }: Props) {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetCircuit = useAppStore((s) => s.resetCircuit)
  const addComponent = useAppStore((s) => s.addComponent)
  const addWire = useAppStore((s) => s.addWire)
  const setBlocklyXml = useAppStore((s) => s.setBlocklyXml)
  const setCppCode = useAppStore((s) => s.setCppCode)
  const appendChatMessage = useAppStore((s) => s.appendChatMessage)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setProjects(await listProjects())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [open, refresh])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  async function load(id: string, name: string) {
    try {
      const detail = await getProject(id)
      resetCircuit()
      detail.circuit.components.forEach(addComponent)
      detail.circuit.wires.forEach(addWire)
      setBlocklyXml(detail.circuit.blockly_xml)
      setCppCode(detail.circuit.cpp_code)
      appendChatMessage({ id: crypto.randomUUID(), role: 'system', text: `Loaded project "${name}".` })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-brand-100 bg-brand-50 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-brand-900">My projects</h2>
            <p className="text-xs text-slate-500">Open a circuit you saved before.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </header>

        <div className="overflow-y-auto px-4 py-3">
          {error && (
            <p className="mb-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </p>
          )}
          {loading ? (
            <p className="text-xs text-slate-500">Loading...</p>
          ) : projects.length === 0 ? (
            <p className="text-xs text-slate-500">
              No saved projects yet. Build something and press Save.
            </p>
          ) : (
            <ul className="space-y-1">
              {projects.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => void load(p.id, p.name)}
                    className="flex w-full items-center gap-2 rounded border border-slate-200 px-3 py-2 text-left text-sm hover:border-brand-400 hover:bg-brand-50"
                  >
                    <IconFolder className="shrink-0 text-brand-500" />
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{p.name}</span>
                    <span className="shrink-0 font-mono text-[10px] text-slate-400">
                      {p.created_at.slice(0, 10)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
