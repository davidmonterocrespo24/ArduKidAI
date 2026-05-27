import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { EXAMPLE_TEMPLATES, type ExampleTemplate } from '../lib/exampleTemplates'

interface Props {
  open: boolean
  onClose: () => void
}

const DIFFICULTY_DOT: Record<number, string> = {
  1: 'bg-brand-500',
  2: 'bg-amber-500',
  3: 'bg-rose-500',
}
const DIFFICULTY_LABEL: Record<number, string> = {
  1: 'easy',
  2: 'medium',
  3: 'hard',
}

export function ExamplesModal({ open, onClose }: Props) {
  const [filter, setFilter] = useState('')
  const resetCircuit = useAppStore((s) => s.resetCircuit)
  const addComponent = useAppStore((s) => s.addComponent)
  const addWire = useAppStore((s) => s.addWire)
  const setCppCode = useAppStore((s) => s.setCppCode)
  const setBlocklyXml = useAppStore((s) => s.setBlocklyXml)
  const setRightTab = useAppStore((s) => s.setRightTab)
  const appendChatMessage = useAppStore((s) => s.appendChatMessage)

  if (!open) return null

  const sorted = [...EXAMPLE_TEMPLATES].sort(
    (a, b) => a.difficulty - b.difficulty || a.title.localeCompare(b.title),
  )
  const filtered = filter.trim()
    ? sorted.filter((e) => {
        const q = filter.toLowerCase()
        return (
          e.title.toLowerCase().includes(q) ||
          e.intent_en.toLowerCase().includes(q) ||
          e.intent_es.toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q))
        )
      })
    : sorted

  function pick(ex: ExampleTemplate) {
    onClose()
    // Wipe whatever was on the canvas first - examples are stand-alone
    // starter circuits, not additions to the current one. resetCircuit
    // also flips simStatus -> 'idle', which the SimControls effect
    // catches and tears the running AVR handle down.
    resetCircuit()
    // Drop the template's components and wires straight into the store.
    for (const c of ex.components) addComponent(c)
    for (const wire of ex.wires) addWire(wire)
    setCppCode(ex.cpp_code)
    if (ex.blockly_xml) {
      setBlocklyXml(ex.blockly_xml)
      setRightTab('blockly')
    } else {
      // No starter blocks for this example (the C++ uses libraries the
      // block toolbox does not cover yet). Show the Arduino code tab
      // instead so the kid sees an actual program, not an empty board.
      setBlocklyXml('<xml xmlns="https://developers.google.com/blockly/xml"></xml>')
      setRightTab('code')
    }
    appendChatMessage({
      id: crypto.randomUUID(),
      role: 'system',
      text: ex.blockly_xml
        ? `Loaded example: ${ex.title}. Hit "Compile & run" in the top bar to try it.`
        : `Loaded example: ${ex.title}. This one is written directly in Arduino code - see the Arduino code tab on the right. Hit "Compile & run" to try it.`,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h3 className="text-base font-semibold">Example circuits</h3>
            <p className="text-xs text-slate-500">
              Click one and the canvas resets to that starter circuit. Then hit Compile &amp; run.
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
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-500">No examples match "{filter}".</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => pick(ex)}
                  className="flex h-full flex-col rounded-md border border-slate-200 bg-white p-3 text-left transition hover:border-brand-400 hover:bg-brand-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{ex.title}</p>
                    <span
                      className="flex shrink-0 items-center gap-1 text-[10px] text-slate-500"
                      title={`difficulty ${ex.difficulty}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${DIFFICULTY_DOT[ex.difficulty]}`} />
                      {DIFFICULTY_LABEL[ex.difficulty]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{ex.intent_es}</p>
                  <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-slate-500">
                    {ex.tags.map((t) => (
                      <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5">
                        {t}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
