import { apiUrl, getJson, postJson } from '../lib/api'
import { authHeader } from '../auth/token'

export interface SourceRow {
  source: string
  chunks: number
  kind?: 'image' | 'pdf' | 'document' | 'link' | 'text'
  content_type?: string
  url?: string
}

// Absolute, public URL of a source's stored original file. Absolute so an
// embedded document viewer (Google Docs Viewer) can fetch it.
export function knowledgeFileUrl(source: string): string {
  const u = apiUrl(`/api/knowledge/file/${encodeURIComponent(source)}`)
  return u.startsWith('http') ? u : `${window.location.origin}${u}`
}

export interface IngestResult {
  ok: boolean
  source: string
  chunks: number
}

export async function listSources(): Promise<SourceRow[]> {
  return getJson<SourceRow[]>('/api/knowledge')
}

// The indexed plain text of a source (for previewing a note that has no file).
export async function getSourceContent(source: string): Promise<{ source: string; text: string }> {
  return getJson<{ source: string; text: string }>(
    `/api/knowledge/content/${encodeURIComponent(source)}`,
  )
}

export async function ingestUrl(url: string, source?: string): Promise<IngestResult> {
  return postJson<IngestResult>('/api/knowledge/url', { url, source: source ?? null })
}

export async function ingestText(text: string, source: string): Promise<IngestResult> {
  return postJson<IngestResult>('/api/knowledge/text', { text, source })
}

async function postForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { ...authHeader() },
    body: form,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`POST ${path} failed: ${res.status} ${res.statusText} ${text}`)
  }
  return res.json() as Promise<T>
}

export async function ingestPdf(file: File, source?: string): Promise<IngestResult> {
  const form = new FormData()
  form.append('file', file)
  if (source) form.append('source', source)
  return postForm<IngestResult>('/api/knowledge/pdf', form)
}

export async function ingestImage(file: File, source?: string): Promise<IngestResult> {
  const form = new FormData()
  form.append('file', file)
  if (source) form.append('source', source)
  return postForm<IngestResult>('/api/knowledge/image', form)
}

// Word / PowerPoint / Excel / HTML / EPUB / CSV, converted to Markdown on the
// backend (markitdown) and embedded with Gemini like any other source.
export async function ingestDocument(file: File, source?: string): Promise<IngestResult> {
  const form = new FormData()
  form.append('file', file)
  if (source) form.append('source', source)
  return postForm<IngestResult>('/api/knowledge/document', form)
}

export async function deleteSource(source: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/knowledge/${encodeURIComponent(source)}`), {
    method: 'DELETE',
    headers: { ...authHeader() },
  })
  if (!res.ok) throw new Error(`delete failed: ${res.status}`)
}
