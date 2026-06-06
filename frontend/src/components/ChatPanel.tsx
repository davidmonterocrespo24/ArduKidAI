import { useEffect, useRef, useState } from 'react'
import { sendChatMessage, type ChatAttachment } from '../agent/chat'
import { useAppStore } from '../store/useAppStore'
import { cn } from '../lib/cn'
import { SavedProjectsList } from './SavedProjectsList'
import { IconClock, IconImage, IconMinimize, IconPaperclip, IconPlus, IconTrash } from './Icons'
import { newSession, setSessionId } from '../lib/sessionId'
import {
  deleteChatSession,
  getChatSession,
  listChatSessions,
  type ChatSessionSummary,
} from '../agent/chatSessions'

const SUGGESTIONS = [
  'Make an LED blink',
  'A button that turns on a light',
  'Build a traffic light',
  'Play a melody with the buzzer',
]

// Tutor quick-actions: always available, so the child can learn from what is on
// the canvas, not just build. The agent reads the circuit (describe_circuit) and
// teaches with grounded, cited facts (see the system prompt's teaching policy).
const TUTOR_ACTIONS: { label: string; prompt: string }[] = [
  {
    label: 'Explain my circuit',
    prompt: 'Explain my current circuit simply: what each part does and how it works together.',
  },
  {
    label: 'Quiz me',
    prompt:
      'Ask me one short, friendly quiz question about my current circuit or how it works, then wait for my answer.',
  },
  {
    label: 'Why does it work?',
    prompt:
      'Teach me the main idea behind how my current project works, in a simple way, and end with a question to check I understood.',
  },
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
  const setChatMessages = useAppStore((s) => s.setChatMessages)
  const setChatCollapsed = useAppStore((s) => s.setChatCollapsed)
  const [value, setValue] = useState('')
  const [pending, setPending] = useState<File[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  const isStreaming = agentStatus === 'streaming'

  // The backend (ADK MongoSessionService) persists every turn, so a new chat
  // just starts a fresh session id; the old one is already saved.
  function newChat() {
    newSession()
    setChatMessages([])
    setHistoryOpen(false)
  }

  async function loadSession(s: ChatSessionSummary) {
    try {
      const transcript = await getChatSession(s.id)
      setSessionId(s.id) // continue this conversation: the agent reloads its full context from Mongo
      setChatMessages(transcript.messages)
    } catch {
      /* ignore - the chat just will not load */
    }
    setHistoryOpen(false)
  }

  async function refreshSessions() {
    try {
      setSessions(await listChatSessions())
    } catch {
      setSessions([])
    }
  }

  function toggleHistory() {
    if (!historyOpen) void refreshSessions()
    setHistoryOpen((o) => !o)
  }

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

  const iconBtn =
    'rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-brand-600 disabled:opacity-50'

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="relative shrink-0 border-b border-slate-200 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-brand-900">Talk to the agent</h2>
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={newChat} title="New chat" className={iconBtn}>
              <IconPlus />
            </button>
            <button
              type="button"
              onClick={toggleHistory}
              title="Chat history"
              className={cn(iconBtn, historyOpen && 'bg-brand-100 text-brand-700')}
            >
              <IconClock />
            </button>
            <button
              type="button"
              onClick={() => setChatCollapsed(true)}
              title="Minimize chat"
              className={iconBtn}
            >
              <IconMinimize />
            </button>
          </div>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          Type what you want to build, or attach a photo of a circuit.
        </p>

        {historyOpen && (
          <div className="absolute left-2 right-2 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
            <div className="border-b border-slate-100 bg-brand-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
              Chat history
            </div>
            {sessions.length === 0 ? (
              <p className="px-3 py-3 text-xs text-slate-500">No past chats yet.</p>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 last:border-0 hover:bg-slate-50"
                >
                  <button
                    type="button"
                    onClick={() => void loadSession(s)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-xs font-medium text-slate-700">{s.title}</div>
                    <div className="text-[10px] text-slate-400">
                      {new Date(s.updated_at * 1000).toLocaleString()}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteChatSession(s.id).then(refreshSessions)}
                    title="Delete this chat"
                    className="shrink-0 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <IconTrash />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
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
              msg.role === 'system' && msg.toolName
                ? 'flex items-start gap-1.5 px-1 text-xs text-slate-500'
                : 'rounded-md px-3 py-2 text-sm',
              !msg.toolName && msg.role === 'user' && 'bg-brand-100 text-brand-900',
              !msg.toolName && msg.role === 'agent' && 'bg-slate-100 text-slate-900',
              !msg.toolName && msg.role === 'system' && 'bg-amber-50 text-amber-800 text-xs',
            )}
          >
            {msg.role === 'system' && msg.toolName && (
              <svg
                viewBox="0 0 24 24"
                className="mt-0.5 h-3 w-3 shrink-0 text-brand-400"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z" />
              </svg>
            )}
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

        {isStreaming && <div className="text-xs italic text-slate-500">agent is thinking...</div>}
      </div>

      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-slate-200 px-2 pt-2">
          {pending.map((f, i) => (
            <span
              key={`${f.name}-${i}`}
              className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-600"
            >
              {f.type.startsWith('image/') ? (
                <img src={URL.createObjectURL(f)} alt={f.name} className="h-6 w-6 rounded object-cover" />
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

      <div className="flex shrink-0 flex-wrap gap-1.5 border-t border-slate-200 px-2 pt-2">
        {TUTOR_ACTIONS.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => void submit(a.prompt)}
            disabled={isStreaming}
            title="Ask the tutor"
            className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-50"
          >
            {a.label}
          </button>
        ))}
      </div>

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
