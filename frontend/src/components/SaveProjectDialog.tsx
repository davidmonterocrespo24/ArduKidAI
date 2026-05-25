import { useEffect, useRef, useState } from 'react'
import { saveProject } from '../agent/projects'
import { useAppStore } from '../store/useAppStore'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: (id: string, name: string) => void
}

export function SaveProjectDialog({ open, onClose, onSaved }: Props) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const components = useAppStore((s) => s.components)
  const wires = useAppStore((s) => s.wires)
  const blocklyXml = useAppStore((s) => s.blocklyXml)
  const cppCode = useAppStore((s) => s.cppCode)

  useEffect(() => {
    if (!open) return
    const handle = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(handle)
  }, [open])

  if (!open) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Pick a name.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const saved = await saveProject(name.trim(), {
        components,
        wires,
        blockly_xml: blocklyXml,
        cpp_code: cppCode,
      })
      onSaved(saved.id, saved.name)
      setName('')
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
        <h3 className="text-base font-semibold">Save this project</h3>
        <p className="mt-1 text-xs text-slate-500">
          Give it a name so you can come back to it later.
        </p>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="my-traffic-light"
          maxLength={80}
          disabled={busy}
          className="mt-3 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
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
            disabled={busy || !name.trim()}
            className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {busy ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
