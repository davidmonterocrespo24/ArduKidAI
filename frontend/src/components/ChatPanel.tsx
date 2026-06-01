import { useEffect, useRef, useState } from 'react'
import { sendChatMessage, type ChatAttachment } from '../agent/chat'
import { useAppStore } from '../store/useAppStore'
import { cn } from '../lib/cn'
import { SavedProjectsList } from './SavedProjectsList'
import { IconImage, IconPaperclip } from './Icons'

const SUGGESTIONS = [
  'Make an LED blink',
  'A button that turns on a light',
  'Build a traffic light',
  'Play a melody with the buzzer',
]

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function ChatPanel() {
  const messages = useAppStore((s) => s.chatMessages)
  const agentStatus = useAppStore((s) => s.agentStatus)
  const [value, setValue] = useState('')
  const [pending, setPending] = useState<File[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  const isStreaming = agentStatus === 'streaming'

  async function submit(text: string, files: File[] = []) {
    if ((!text.trim() && files.length === 0) || isStreaming) return
    setValue('')
    setPending([])
    const attachments: ChatAttachment[] = await Promise.all(
      files.map(async (f) => ({
        mime_type: f.type || 'application/octet-stream',
        data: await fileToBase64(f),
        name: f.name,
      })),
    )
    await sendChatMessage(text, attachments)
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files
    if (list) setPending((p) => [...p, ...Array.from(list)])
    e.target.value = ''
  }

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="shrink-0 border-b border-slate-200 px-3 py-2">
        <h2 className="text-sm font-semibold">Talk to the agent</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Type what you want to build, or attach a photo of a circuit. The agent picks parts, wires
          them, writes the program, and runs the simulator.
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
            {msg.text && <div className="whitespace-pre-wrap">{msg.text}</div>}
            {msg.attachments && msg.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {msg.attachments.map((a, i) =>
                  a.previewUrl ? (
                    <img
                      key={i}
                      src={a.previewUrl}
                      alt={a.name}
                      className="h-20 w-20 rounded border border-brand-200 object-cover"
                    />
                  ) : (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded border border-brand-200 bg-white px-2 py-1 text-xs text-slate-600"
                    >
                      <IconImage className="h-3.5 w-3.5" />
                      {a.name}
                    </span>
                  ),
                )}
              </div>
            )}
          </div>
        ))}

        {isStreaming && (
          <div className="text-xs italic text-slate-500">agent is thinking...</div>
        )}
      </div>

      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-slate-200 px-2 pt-2">
          {pending.map((f, i) => (
            <span
              key={`${f.name}-${i}`}
              className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-600"
            >
              {f.type.startsWith('image/') ? (
                <img
                  src={URL.createObjectURL(f)}
                  alt={f.name}
                  className="h-6 w-6 rounded object-cover"
                />
              ) : (
                <IconImage className="h-3.5 w-3.5" />
              )}
              <span className="max-w-[8rem] truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => setPending((p) => p.filter((_, idx) => idx !== i))}
                className="text-slate-400 hover:text-rose-600"
                aria-label={`Remove ${f.name}`}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      <form
        className="flex shrink-0 items-end gap-2 border-t border-slate-200 p-2"
        onSubmit={(e) => {
          e.preventDefault()
          void submit(value, pending)
        }}
      >
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={isStreaming}
          title="Attach an image or PDF"
          className="rounded-md border border-slate-300 bg-white p-2 text-slate-500 hover:bg-slate-50 hover:text-brand-600 disabled:opacity-50"
        >
          <IconPaperclip />
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*,application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={onPickFiles}
        />
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
          disabled={isStreaming || (!value.trim() && pending.length === 0)}
          className="rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </aside>
  )
}
