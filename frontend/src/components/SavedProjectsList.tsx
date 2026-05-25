import { useEffect, useState } from 'react'
import { getProject, listProjects, type ProjectSummary } from '../agent/projects'
import { useAppStore } from '../store/useAppStore'

interface Props {
  refreshKey: number
}

export function SavedProjectsList({ refreshKey }: Props) {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const addComponent = useAppStore((s) => s.addComponent)
  const addWire = useAppStore((s) => s.addWire)
  const setBlocklyXml = useAppStore((s) => s.setBlocklyXml)
  const setCppCode = useAppStore((s) => s.setCppCode)
  const resetCircuit = useAppStore((s) => s.resetCircuit)
  const appendChatMessage = useAppStore((s) => s.appendChatMessage)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await listProjects()
        if (!cancelled) {
          setProjects(list)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  async function open(id: string, name: string) {
    try {
      const detail = await getProject(id)
      resetCircuit()
      detail.circuit.components.forEach(addComponent)
      detail.circuit.wires.forEach(addWire)
      setBlocklyXml(detail.circuit.blockly_xml)
      setCppCode(detail.circuit.cpp_code)
      appendChatMessage({
        id: crypto.randomUUID(),
        role: 'system',
        text: `Loaded project "${name}".`,
      })
    } catch (err) {
      appendChatMessage({
        id: crypto.randomUUID(),
        role: 'system',
        text: `Could not load project: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }

  if (busy) {
    return <p className="text-xs text-slate-500">Loading saved projects...</p>
  }
  if (error) {
    return <p className="text-xs text-rose-600">Saved projects unreachable: {error}</p>
  }
  if (projects.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">Your projects:</p>
      <div className="grid gap-1.5">
        {projects.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => void open(p.id, p.name)}
            className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-800 hover:border-emerald-400 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-emerald-500 dark:hover:bg-emerald-950/30"
          >
            <span className="truncate">{p.name}</span>
            <span className="ml-2 shrink-0 font-mono text-[10px] text-slate-400">
              {p.created_at.slice(0, 10)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
