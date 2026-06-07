import { useCallback, useEffect, useRef, useState } from 'react'
import {
  deleteSource,
  getSourceContent,
  ingestDocument,
  ingestImage,
  ingestPdf,
  ingestText,
  ingestUrl,
  knowledgeFileUrl,
  listSources,
  type IngestResult,
  type SourceRow,
} from '../agent/knowledge'
import { IconFileText, IconImage, IconLink, IconTrash } from './Icons'
import { Markdown } from './Markdown'

// Documents and PDFs preview through the Google Docs Viewer (aligns with the
// Google stack); images render directly. The viewer fetches the public file URL.
function googleViewerUrl(fileUrl: string): string {
  return `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`
}

interface Props {
  open: boolean
  onClose: () => void
}

function sourceKind(source: string): 'link' | 'pdf' | 'image' | 'text' {
  const s = source.toLowerCase()
  if (s.includes('http')) return 'link'
  if (/\.pdf\b/.test(s)) return 'pdf'
  if (/\.(png|jpe?g|gif|webp|bmp|svg)\b/.test(s)) return 'image'
  return 'text'
}

function KindIcon({ kind }: { kind: string }) {
  if (kind === 'link') return <IconLink className="text-sky-600" />
  if (kind === 'image') return <IconImage className="text-violet-600" />
  if (kind === 'pdf') return <IconFileText className="text-rose-600" />
  if (kind === 'document') return <IconFileText className="text-emerald-600" />
  return <IconFileText className="text-slate-500" />
}

export function KnowledgeModal({ open, onClose }: Props) {
  const [sources, setSources] = useState<SourceRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [textName, setTextName] = useState('')
  const [preview, setPreview] = useState<SourceRow | null>(null)
  const [previewText, setPreviewText] = useState<string | null>(null)

  function openPreview(s: SourceRow) {
    setPreview(s)
    setPreviewText(null)
    if (s.kind === 'text' || !s.kind) {
      void getSourceContent(s.source)
        .then((r) => setPreviewText(r.text || '(empty)'))
        .catch(() => setPreviewText('(could not load this note)'))
    }
  }

  function closePreview() {
    setPreview(null)
    setPreviewText(null)
  }

  const pdfInput = useRef<HTMLInputElement>(null)
  const imageInput = useRef<HTMLInputElement>(null)
  const docInput = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSources(await listSources())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [open, refresh])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  async function run(label: string, fn: () => Promise<IngestResult>) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fn()
      setNotice(`Indexed ${res.chunks} chunk${res.chunks === 1 ? '' : 's'} from ${label}.`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function onAddUrl() {
    const u = url.trim()
    if (!u) return
    await run(u, () => ingestUrl(u))
    setUrl('')
  }

  async function onAddText() {
    const t = text.trim()
    const name = textName.trim() || 'Pasted note'
    if (!t) return
    await run(name, () => ingestText(t, name))
    setText('')
    setTextName('')
  }

  async function onPickPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) await run(file.name, () => ingestPdf(file))
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) await run(file.name, () => ingestImage(file))
  }

  async function onPickDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) await run(file.name, () => ingestDocument(file))
  }

  async function onDelete(source: string) {
    setBusy(true)
    setError(null)
    try {
      await deleteSource(source)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  const totalChunks = sources.reduce((n, s) => n + s.chunks, 0)

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-brand-100 bg-brand-50 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-brand-900">Knowledge base</h2>
            <p className="text-xs text-slate-500">
              Add Arduino references the agent can search. PDFs, documents, web links, notes, and images.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </header>

        <div className="overflow-y-auto px-4 py-3">
          {error && (
            <p className="mb-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </p>
          )}
          {notice && (
            <p className="mb-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {notice}
            </p>
          )}

          <section className="mb-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Add a source
            </h3>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                void onAddUrl()
              }}
              className="mb-2 flex gap-2"
            >
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste a web link (https://...)"
                className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || !url.trim()}
                className="inline-flex items-center gap-1.5 rounded border border-brand-300 bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
              >
                <IconLink />
                Add link
              </button>
            </form>

            <div className="mb-2 flex gap-2">
              <button
                type="button"
                onClick={() => pdfInput.current?.click()}
                disabled={busy}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <IconFileText />
                Upload PDF
              </button>
              <button
                type="button"
                onClick={() => docInput.current?.click()}
                disabled={busy}
                title="Word, PowerPoint, Excel, HTML, EPUB, CSV"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <IconFileText />
                Upload doc
              </button>
              <button
                type="button"
                onClick={() => imageInput.current?.click()}
                disabled={busy}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <IconImage />
                Upload image
              </button>
              <input
                ref={pdfInput}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={onPickPdf}
              />
              <input
                ref={docInput}
                type="file"
                accept=".docx,.pptx,.xlsx,.xls,.html,.htm,.epub,.csv,.json,.xml,.md"
                className="hidden"
                onChange={onPickDoc}
              />
              <input
                ref={imageInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickImage}
              />
            </div>

            <details className="rounded border border-slate-200 px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-slate-600">
                Paste a note
              </summary>
              <div className="mt-2 space-y-2">
                <input
                  value={textName}
                  onChange={(e) => setTextName(e.target.value)}
                  placeholder="Title (e.g. My wiring notes)"
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                />
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={4}
                  placeholder="Paste any text you want the agent to remember..."
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void onAddText()}
                  disabled={busy || !text.trim()}
                  className="rounded border border-brand-300 bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  Add note
                </button>
              </div>
            </details>

            {busy && <p className="mt-2 text-xs italic text-slate-500">Working...</p>}
          </section>

          <section>
            <h3 className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Indexed sources</span>
              {sources.length > 0 && (
                <span className="font-normal normal-case text-slate-400">
                  {sources.length} source{sources.length === 1 ? '' : 's'} - {totalChunks} chunks
                </span>
              )}
            </h3>
            {loading ? (
              <p className="text-xs text-slate-500">Loading...</p>
            ) : sources.length === 0 ? (
              <p className="text-xs text-slate-500">
                Nothing indexed yet. Add a link, PDF, note, or image above.
              </p>
            ) : (
              <ul className="space-y-1">
                {sources.map((s) => (
                  <li
                    key={s.source}
                    className="flex items-center justify-between gap-3 rounded border border-slate-200 px-3 py-2 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <KindIcon kind={s.kind ?? sourceKind(s.source)} />
                      <div className="min-w-0">
                        {s.kind === 'link' && s.url ? (
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block truncate font-medium text-sky-700 hover:underline"
                            title={`Open ${s.url}`}
                          >
                            {s.source}
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openPreview(s)}
                            className="block max-w-full truncate text-left font-medium text-brand-700 hover:underline"
                            title="Preview"
                          >
                            {s.source}
                          </button>
                        )}
                        <div className="text-xs text-slate-500">{s.chunks} chunks</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onDelete(s.source)}
                      disabled={busy}
                      title="Remove from knowledge base"
                      className="shrink-0 rounded border border-slate-300 bg-white p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    >
                      <IconTrash />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-slate-900/70 p-3"
          onClick={(e) => {
            e.stopPropagation()
            closePreview()
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
          >
            <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
              <span className="truncate text-sm font-medium text-slate-700" title={preview.source}>
                {preview.source}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                {(preview.kind === 'image' ||
                  preview.kind === 'pdf' ||
                  preview.kind === 'document') && (
                  <a
                    href={knowledgeFileUrl(preview.source)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    Open file
                  </a>
                )}
                <button
                  type="button"
                  onClick={closePreview}
                  className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </header>
            <div className="min-h-0 flex-1 bg-slate-100">
              {preview.kind === 'image' ? (
                <img
                  src={knowledgeFileUrl(preview.source)}
                  alt={preview.source}
                  className="mx-auto max-h-full max-w-full object-contain"
                />
              ) : preview.kind === 'pdf' || preview.kind === 'document' ? (
                <iframe
                  title={preview.source}
                  src={googleViewerUrl(knowledgeFileUrl(preview.source))}
                  className="h-full w-full border-0"
                />
              ) : (
                <div className="h-full overflow-auto bg-white p-5">
                  {previewText === null ? (
                    <p className="text-sm text-slate-500">Loading...</p>
                  ) : (
                    <div className="mx-auto max-w-3xl">
                      <Markdown text={previewText} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
