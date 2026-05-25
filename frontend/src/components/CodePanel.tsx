import Editor from '@monaco-editor/react'
import { useAppStore } from '../store/useAppStore'

export function CodePanel() {
  const code = useAppStore((s) => s.cppCode)
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-slate-800 dark:bg-amber-950/30 dark:text-amber-200">
        This is what your Arduino understands. Read-only - change the blocks to modify it.
      </div>
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
