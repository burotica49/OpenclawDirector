// ─── Connection ──────────────────────────────────────────────────────────────

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

// ─── Agents ──────────────────────────────────────────────────────────────────

export type AgentStatus = 'idle' | 'busy' | 'error' | 'offline'

export interface SubAgent {
  id: string
  name: string
  model: string
  status: AgentStatus
  parentId: string
  currentTask?: string
}

export interface Agent {
  id: string
  name: string
  model: string
  status: AgentStatus
  subAgents: SubAgent[]
  description?: string
  currentTask?: string
  tasksCompleted?: number
}

// ─── Tasks / Kanban ──────────────────────────────────────────────────────────

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'failed'
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

export type TaskAssigneeKind = 'agent' | 'subagent'

export interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  agentId?: string
  agentName?: string
  assigneeKind?: TaskAssigneeKind
  subAgentId?: string
  subAgentName?: string
  /** Session gateway utilisée pour exécuter la tâche (kanban ↔ chat). */
  sessionKey?: string
  /** Date/heure (ms) à laquelle la tâche doit démarrer automatiquement. */
  scheduledAt?: number
  /** Date/heure (ms) du démarrage effectif. */
  startedAt?: number
  progress?: number          // 0–100
  createdAt: number
  updatedAt: number
  tags?: string[]
  subTasks?: { id: string; label: string; done: boolean }[]
}

export interface KanbanColumn {
  id: TaskStatus
  label: string
  color: string
  tasks: Task[]
}

// ─── Cron (Gateway scheduler) ────────────────────────────────────────────────

export type CronSchedule =
  | { kind: 'at'; at: string; tz?: string; staggerMs?: number }
  | { kind: 'every'; everyMs: number; staggerMs?: number }
  | { kind: 'cron'; expr: string; tz?: string; staggerMs?: number }

export type CronSessionTarget = 'main' | 'isolated' | 'current' | `session:${string}`
export type CronWakeMode = 'now' | 'next-heartbeat'

export type CronPayload =
  | { kind: 'systemEvent'; text: string }
  | {
      kind: 'agentTurn'
      message: string
      model?: string
      thinking?: string
      timeoutSeconds?: number
      lightContext?: boolean
    }

export type CronDeliveryMode = 'none' | 'announce' | 'webhook'
export type CronDeliveryChannel = 'last' | string

export interface CronDelivery {
  mode: CronDeliveryMode
  channel?: CronDeliveryChannel
  to?: string
  bestEffort?: boolean
}

export interface CronJob {
  jobId: string
  name: string
  description?: string
  agentId?: string
  enabled?: boolean
  schedule: CronSchedule
  sessionTarget: CronSessionTarget
  wakeMode?: CronWakeMode
  payload: CronPayload
  delivery?: CronDelivery
  deleteAfterRun?: boolean
  // Champs optionnels (selon version gateway)
  nextRunAt?: string | number
  lastRunAt?: string | number
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  agentId: string
  model?: string
  timestamp: number
  streaming?: boolean
}

export interface ChatSession {
  agentId: string
  messages: ChatMessage[]
}

// ─── WebSocket protocol ───────────────────────────────────────────────────────

export interface WsOutChat {
  type: 'chat'
  agentId: string
  model: string
  content: string
  messageId: string
  sessionId?: string
}

export interface WsOutCreateTask {
  type: 'create_task'
  task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>
}

export interface WsOutUpdateTask {
  type: 'update_task'
  taskId: string
  status: TaskStatus
}

export interface WsOutDeleteTask {
  type: 'delete_task'
  taskId: string
}

export interface WsOutAuth {
  type: 'auth'
  token: string
}

export type WsOutMessage = WsOutAuth | WsOutChat | WsOutCreateTask | WsOutUpdateTask | WsOutDeleteTask

export interface WsInConnected {
  type: 'connected'
  token_valid: boolean
  server_version?: string
}

export interface WsInChatResponse {
  type: 'chat_response'
  agentId: string
  content: string
  messageId: string
  done: boolean
  model?: string
}

export interface WsInTaskUpdate {
  type: 'task_update'
  task: Task
}

export interface WsInAgentStatus {
  type: 'agent_status'
  agents: Agent[]
}

export interface WsInError {
  type: 'error'
  code: string
  message: string
}

export interface WsInGatewayChatEventMsg {
  type: 'gateway_chat'
  runId: string
  sessionKey: string
  seq: number
  state: 'delta' | 'final' | 'aborted' | 'error'
  message?: unknown
  errorMessage?: string
}

export interface WsInSessionsChanged {
  type: 'sessions_changed'
  payload: unknown
}

export type WsInMessage =
  | WsInConnected
  | WsInChatResponse
  | WsInTaskUpdate
  | WsInAgentStatus
  | WsInError
  | WsInGatewayChatEventMsg
  | WsInSessionsChanged

// ─── Gateway session row (sessions.list) ──────────────────────────────────────

/** Sous-ensemble des champs renvoyés par `sessions.list` côté gateway. */
export interface GatewaySessionRow {
  key: string
  displayName?: string
  derivedTitle?: string
  lastMessagePreview?: string
  label?: string
  model?: string
  modelProvider?: string
  updatedAt?: number | null
  sessionId?: string
  /** Ex. `running` | `done` | `failed` | … (tel que renvoyé par `sessions.list`). */
  status?: string
}

export function parseSessionKeyAgentId(sessionKey: string): string | null {
  const parts = sessionKey.split(':')
  if (parts[0] === 'agent' && parts.length >= 2 && parts[1]) {
    return parts[1]
  }
  return null
}

// ─── Models ──────────────────────────────────────────────────────────────────

export interface ModelOption {
  id: string
  label: string
  tier: 'opus' | 'sonnet' | 'haiku'
  contextWindow: string
}

export const CLAUDE_MODELS: ModelOption[] = [
  { id: 'claude-opus-4-6',              label: 'Claude Opus 4.6',     tier: 'opus',   contextWindow: '200K' },
  { id: 'claude-sonnet-4-6',            label: 'Claude Sonnet 4.6',   tier: 'sonnet', contextWindow: '200K' },
  { id: 'claude-haiku-4-5-20251001',    label: 'Claude Haiku 4.5',    tier: 'haiku',  contextWindow: '200K' },
]
