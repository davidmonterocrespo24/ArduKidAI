import { apiUrl } from '../lib/api'

export interface ExampleHit {
  id: string
  title: string
  intent: string
  score: number
}

export async function listExamples(limit = 30): Promise<ExampleHit[]> {
  const res = await fetch(apiUrl(`/api/examples/search?q=&limit=${limit}`))
  if (!res.ok) throw new Error(`list examples failed: ${res.status}`)
  return (await res.json()) as ExampleHit[]
}
