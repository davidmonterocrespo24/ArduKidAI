import { useEffect, useState } from 'react'
import { sendChatMessage } from '../agent/chat'
import { listExamples, type ExampleHit } from '../agent/examples'

interface Props {
  open: boolean
  onClose: () => void
}

export function ExamplesModal({ open, onClose }: Props) {
  const [examples, setExamples] = useState<ExampleHit[]>([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      try {
        const list = await listExamples(30)
        if (!cancelled) {
          setExamples(list)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  if (!open) return null

  const filtered = filter.trim()
    ? examples.filter(
        (e) =>
          e.title.toLowerCase().includes(filter.toLowerCase()) ||
          e.intent.toLowerCase().includes(filter.toLowerCase()),
      )
    : examples

  async function pick(ex: ExampleHit) {
    onClose()
    // Send the intent to the agent so it assembles the circuit.
    await sendChatMessage(`Quiero hacer: ${ex.intent}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h3 className="text-base font-semibold">Example circuits</h3>
            <p className="text-xs text-slate-500">
              Click one and the agent will build it on the canvas.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </header>

        <div className="shrink-0 border-b border-slate-200 px-4 py-2">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter: led, button, servo, melody..."
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {busy && <p className="text-sm text-slate-500">Loading examples...</p>}
          {error && <p className="text-sm text-rose-600">Could not load: {error}</p>}
          {!busy && !error && filtered.length === 0 && (
            <p className="text-sm text-slate-500">No examples match "{filter}".</p>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {filtered.map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => void pick(ex)}
                className="rounded-md border border-slate-200 bg-white p-3 text-left transition hover:border-emerald-400 hover:bg-emerald-50"
              >
                <p className="text-sm font-semibold text-slate-900">{ex.title}</p>
                <p className="mt-1 text-xs text-slate-600">{ex.intent}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
