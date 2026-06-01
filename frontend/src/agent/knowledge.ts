import { apiUrl, getJson, postJson } from '../lib/api'
import { authHeader } from '../auth/token'

export interface SourceRow {
  source: string
  chunks: number
}

export interface IngestResult {
  ok: boolean
  source: string
  chunks: number
}

export async function listSources(): Promise<SourceRow[]> {
  return getJson<SourceRow[]>('/api/knowledge')
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

export async function deleteSource(source: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/knowledge/${encodeURIComponent(source)}`), {
    method: 'DELETE',
    headers: { ...authHeader() },
  })
  if (!res.ok) throw new Error(`delete failed: ${res.status}`)
}
