const SUGGESTIONS = [
  'Turn on a LED',
  'Button that turns on a light',
  'Traffic light',
  'Play a melody',
]

export function ChatPanel() {
  return (
    <aside className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <h2 className="text-sm font-semibold">Talk to the agent</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Type what you want to build. The agent will pick the parts, wire them, write the
          program, and run it in the simulator.
        </p>
        <p className="mt-3 text-xs text-slate-500">
          Chat streaming wires up in phase 3. Try a suggestion below for now (also wires up
          in phase 3).
        </p>

        <div className="mt-4 grid grid-cols-1 gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-200 p-2 dark:border-slate-800">
        <input
          type="text"
          disabled
          placeholder="Backend lands in phase 3..."
          className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950"
        />
      </div>
    </aside>
  )
}
