import { useEffect, useRef, useState } from 'react'
import { sendChatMessage } from '../agent/chat'
import { useAppStore } from '../store/useAppStore'
import { cn } from '../lib/cn'
import { SavedProjectsList } from './SavedProjectsList'

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
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="shrink-0 border-b border-slate-200 px-3 py-2">
        <h2 className="text-sm font-semibold">Talk to the agent</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Type what you want to build. The agent picks parts, wires them, writes the program, and runs the simulator.
        </p>
      </header>

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 text-sm">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="space-y-2">
              <p className="text-xs text-slate-500">Try one of these:</p>
              <div className="grid gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => submit(s)}
                    disabled={isStreaming}
                    className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-brand-400 hover:bg-brand-50 disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <SavedProjectsList refreshKey={0} />
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'rounded-md px-3 py-2 text-sm',
              msg.role === 'user' && 'bg-brand-100 text-brand-900',
              msg.role === 'agent' && 'bg-slate-100 text-slate-900',
              msg.role === 'system' && 'bg-amber-50 text-amber-800 text-xs font-mono',
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
        className="flex shrink-0 gap-2 border-t border-slate-200 p-2"
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
          className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isStreaming || !value.trim()}
          className="rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </aside>
  )
}
