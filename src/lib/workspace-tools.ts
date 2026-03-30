import { openClawWS } from '../services/websocket'

/** Réponse typique de `agents.files.list` (gateway OpenClaw). */
export type AgentWorkspaceFileRow = {
  name: string
  path?: string
  missing?: boolean
  size?: number
  updatedAtMs?: number
}

type AgentsFilesListResult = {
  agentId: string
  workspace: string
  files: AgentWorkspaceFileRow[]
}

type AgentsFilesGetResult = {
  agentId: string
  workspace: string
  file: {
    name: string
    path?: string
    missing?: boolean
    content?: string
    size?: number
    updatedAtMs?: number
  }
}

function normName(relativePath: string): string {
  return relativePath.replace(/^\.\/+/, '').replace(/^\/+/, '')
}

/**
 * Liste les fichiers workspace exposés par la gateway (`agents.files.list`, WebSocket).
 * Ne passe pas par `exec` ni `/tools/invoke` (souvent indisponibles côté HTTP).
 */
export async function listWorkspaceFiles(agentId: string): Promise<{
  paths: string[]
  workspaceRoot: string
}> {
  const res = await openClawWS.request<AgentsFilesListResult>('agents.files.list', { agentId })
  const paths = (res.files ?? [])
    .map((f) => f.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
  console.log(res)
  return { paths, workspaceRoot: res.workspace ?? '' }
}

export async function readWorkspaceFile(agentId: string, relativePath: string): Promise<string> {
  const name = normName(relativePath)
  const res = await openClawWS.request<AgentsFilesGetResult>('agents.files.get', { agentId, name })
  console.log(res)
  const f = res.file
  if (f?.missing) return ''
  return f?.content ?? ''
}

export async function writeWorkspaceFile(
  agentId: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const name = normName(relativePath)
  await openClawWS.request('agents.files.set', { agentId, name, content })
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.split('/').pop() || 'fichier.txt'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
