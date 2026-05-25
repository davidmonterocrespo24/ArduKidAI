import { apiUrl, postJson } from '../lib/api'
import type { CircuitState } from '../types/circuit'

export interface ProjectSummary {
  id: string
  name: string
  created_at: string
}

export interface ProjectDetail extends ProjectSummary {
  circuit: CircuitState
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const res = await fetch(apiUrl('/api/projects'))
  if (!res.ok) throw new Error(`list projects failed: ${res.status}`)
  return (await res.json()) as ProjectSummary[]
}

export async function getProject(id: string): Promise<ProjectDetail> {
  const res = await fetch(apiUrl(`/api/projects/${encodeURIComponent(id)}`))
  if (!res.ok) throw new Error(`get project failed: ${res.status}`)
  return (await res.json()) as ProjectDetail
}

export async function saveProject(
  name: string,
  circuit: CircuitState,
): Promise<ProjectDetail> {
  return postJson<ProjectDetail>('/api/projects', { name, circuit })
}
