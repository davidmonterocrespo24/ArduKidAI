import { useEffect, useRef, useState } from 'react'
import { sendChatMessage } from '../agent/chat'
import { useAppStore } from '../store/useAppStore'
import { cn } from '../lib/cn'

const SUGGESTIONS = [
  'Quiero encender un LED',
  'Un botón que prende una luz',
  'Quiero un semáforo',
  'Tocá una melodía con el buzzer',
]

export function ChatPanel() {
  const messages = useAppStore((s) => s.chatMessages)
  const agentStatus = useAppStore((s) => s.agentStatus)
  const [value, setValue] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  const isStreaming = agentStatus === 'streaming'

  async function submit(text: string) {
    if (!text.trim() || isStreaming) return
    setValue('')
    await sendChatMessage(text)
  }

  return (
    <aside className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <h2 className="text-sm font-semibold">Talk to the agent</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Type what you want to build. The agent picks parts, wires them, writes the program, and runs the simulator.
        </p>
      </header>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">Try one of these:</p>
            <div className="grid gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  disabled={isStreaming}
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-emerald-500 dark:hover:bg-emerald-950/30"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'rounded-md px-3 py-2 text-sm',
              msg.role === 'user' && 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100',
              msg.role === 'agent' && 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100',
              msg.role === 'system' && 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200 text-xs font-mono',
            )}
          >
            {msg.text}
          </div>
        ))}

        {isStreaming && (
          <div className="text-xs italic text-slate-500">agent is thinking...</div>
        )}
      </div>

      <form
        className="flex gap-2 border-t border-slate-200 p-2 dark:border-slate-800"
        onSubmit={(e) => {
          e.preventDefault()
          void submit(value)
        }}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isStreaming}
          placeholder="What do you want to build?"
          className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <button
          type="submit"
          disabled={isStreaming || !value.trim()}
          className="rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </aside>
  )
}
