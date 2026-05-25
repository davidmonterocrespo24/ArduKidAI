import { useState } from 'react'
import Editor from '@monaco-editor/react'
import { useAppStore } from '../store/useAppStore'

export function CodePanel() {
  const code = useAppStore((s) => s.cppCode)
  const compileError = useAppStore((s) => s.compileError)
  const setCompileError = useAppStore((s) => s.setCompileError)
  const [errorOpen, setErrorOpen] = useState(true)

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-slate-800 dark:bg-amber-950/30 dark:text-amber-200">
        This is what your Arduino understands. Read-only - change the blocks to modify it.
      </div>

      {compileError && (
        <div className="border-b border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
          <div className="flex items-start justify-between gap-2">
            <div>
              <button
                type="button"
                onClick={() => setErrorOpen((v) => !v)}
                className="font-semibold underline-offset-2 hover:underline"
              >
                {errorOpen ? 'Hide' : 'Show'} compile error
              </button>
              <span className="ml-2 text-rose-700/80">{errorOpen ? '' : 'click to expand'}</span>
            </div>
            <button
              type="button"
              onClick={() => setCompileError(null)}
              className="text-rose-700/70 hover:text-rose-900"
              aria-label="Dismiss compile error"
            >
              dismiss
            </button>
          </div>
          {errorOpen && (
            <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-white/60 p-2 font-mono text-[11px] leading-snug text-rose-900 dark:bg-slate-900/60 dark:text-rose-200">
              {compileError}
            </pre>
          )}
        </div>
      )}

      <div className="flex-1">
        <Editor
          language="cpp"
          value={code}
          theme="vs-dark"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 13,
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  )
}
