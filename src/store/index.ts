import { create } from 'zustand'
import { openClawWS } from '../services/websocket'
import { textFromGatewayMessage } from '../lib/gateway-message-text'
import { loadKanbanTasks, saveKanbanTasks } from '../lib/kanban-sqlite'
import type {
  Agent,
  ChatMessage,
  ConnectionStatus,
  CronJob,
  GatewaySessionRow,
  ModelOption,
  Task,
  TaskStatus,
} from '../types'
import { CLAUDE_MODELS, parseSessionKeyAgentId } from '../types'

let _msgIdCounter = 0
const nextId = () => `local_${Date.now()}_${++_msgIdCounter}`

type AgentsListResult = {
  defaultId?: string
  agents?: Array<{
    id: string
    name?: string
    identity?: { name?: string }
    model?: { primary?: string }
  }>
}

type ModelsListResult = {
  models?: Array<{ id: string; name: string; provider: string; contextWindow?: number; reasoning?: boolean }>
}

type SessionsListResult = {
  sessions?: GatewaySessionRow[]
}

type CronListResult = {
  jobs?: CronJob[]
}

function inferModelTier(id: string): ModelOption['tier'] {
  const x = id.toLowerCase()
  if (x.includes('opus')) return 'opus'
  if (x.includes('haiku')) return 'haiku'
  return 'sonnet'
}

function agentsListToAgents(result: AgentsListResult): Agent[] {
  const rows = result.agents ?? []
  return rows.map((a) => {
    const id = String(a.id ?? '').trim() || 'unknown'
    const name = a.name?.trim() || a.identity?.name?.trim() || id
    const model = a.model?.primary?.trim() ?? ''
    return { id, name, model, status: 'idle' as const, subAgents: [] }
  })
}

function modelsListToOptions(models: NonNullable<ModelsListResult['models']>): ModelOption[] {
  return models.map((m) => ({
    id: m.id,
    label: `${m.name} · ${m.provider}`,
    tier: inferModelTier(m.id + m.name),
    contextWindow:
      typeof m.contextWindow === 'number' && m.contextWindow > 0
        ? `${Math.round(m.contextWindow / 1000)}K`
        : '—',
  }))
}

function clearPendingRunFromState(
  pending: Record<string, string>,
  sessionKey: string,
  runId: string,
): Record<string, string> {
  const next = { ...pending }
  if (next[sessionKey] === runId) delete next[sessionKey]
  for (const [sk, rid] of Object.entries(next)) {
    if (rid === runId) delete next[sk]
  }
  return next
}

function historyToChatMessage(raw: unknown, sessionKey: string, idx: number): ChatMessage {
  const m = raw as Record<string, unknown>
  const roleRaw = m.role
  const role =
    roleRaw === 'user' ? 'user' : roleRaw === 'assistant' ? 'assistant' : 'system'
  const id = typeof m.id === 'string' && m.id ? m.id : `h_${sessionKey}_${idx}`
  const ts =
    typeof m.timestamp === 'number'
      ? m.timestamp
      : typeof m.createdAt === 'number'
        ? m.createdAt
        : Date.now()
  const content = textFromGatewayMessage(raw)
  return {
    id,
    role,
    content,
    agentId: sessionKey,
    timestamp: ts,
  }
}

interface Store {
  connectionStatus: ConnectionStatus
  serverVersion: string | null

  agents: Agent[]
  gatewayModels: ModelOption[]
  gatewayDefaultAgentId: string | null
  openClawSessions: GatewaySessionRow[]

  tasks: Task[]
  kanbanLoaded: boolean

  cronJobs: CronJob[]
  cronLoaded: boolean

  activeAgentId: string | null
  activeSessionKey: string | null
  selectedModel: string
  chatMessagesBySession: Record<string, ChatMessage[]>
  /** sessionKey → runId : réponse modèle en cours après `chat.send`. */
  pendingChatBySession: Record<string, string>
  /** taskId → runId (idempotencyKey / runId gateway) */
  taskRunByTaskId: Record<string, string>
  /** runId → taskId */
  taskIdByRunId: Record<string, string>

  activeView: 'kanban' | 'chat' | 'workspace'
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void

  initWS: () => void
  disconnectWS: () => void

  bootstrapGateway: () => Promise<void>
  refreshOpenClawSessions: () => Promise<void>
  refreshCronJobs: () => Promise<void>

  loadKanbanFromDb: () => Promise<void>
  createTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateTaskStatus: (taskId: string, status: TaskStatus) => void
  deleteTask: (taskId: string) => void
  startTask: (taskId: string) => Promise<void>

  addCronJob: (job: Omit<CronJob, 'jobId'>) => Promise<void>
  updateCronJob: (jobId: string, patch: Partial<CronJob>) => Promise<void>
  removeCronJob: (jobId: string) => Promise<void>

  setActiveAgent: (agentId: string) => void
  setActiveSessionKey: (sessionKey: string | null) => Promise<void>
  createOpenClawSession: (agentId?: string) => Promise<void>
  setSelectedModel: (model: string) => void
  patchSessionModel: (model: string) => Promise<void>
  sendChatMessage: (content: string) => void
  loadSessionHistory: (sessionKey: string) => Promise<void>

  setView: (view: 'kanban' | 'chat' | 'workspace') => void
  toggleSidebar: () => void
}

let _taskScheduler: ReturnType<typeof setInterval> | null = null
let _persistTimer: ReturnType<typeof setTimeout> | null = null

function schedulePersist(get: () => Store) {
  if (_persistTimer) clearTimeout(_persistTimer)
  _persistTimer = setTimeout(() => {
    _persistTimer = null
    const { tasks, kanbanLoaded } = get()
    if (!kanbanLoaded) return
    void saveKanbanTasks(tasks).catch((e) => console.warn('[Kanban sqlite] save failed', e))
  }, 250)
}

const SEED_AGENTS: Agent[] = [
  {
    id: 'agent-1',
    name: 'Analyste',
    model: 'claude-sonnet-4-6',
    status: 'busy',
    subAgents: [],
    tasksCompleted: 12,
  },
  {
    id: 'agent-2',
    name: 'Reviewer',
    model: 'claude-opus-4-6',
    status: 'idle',
    subAgents: [],
    tasksCompleted: 8,
  },
  {
    id: 'agent-3',
    name: 'Scout',
    model: 'claude-haiku-4-5-20251001',
    status: 'idle',
    subAgents: [
      {
        id: 'sub-1',
        name: 'Scout-A',
        model: 'claude-haiku-4-5-20251001',
        status: 'idle',
        parentId: 'agent-3',
      },
      {
        id: 'sub-2',
        name: 'Scout-B',
        model: 'claude-haiku-4-5-20251001',
        status: 'busy',
        parentId: 'agent-3',
        currentTask: 'Crawl page 4',
      },
    ],
    tasksCompleted: 34,
  },
]

export const useStore = create<Store>((set, get) => ({
  connectionStatus: 'disconnected',
  serverVersion: null,
  agents: SEED_AGENTS,
  gatewayModels: [...CLAUDE_MODELS],
  gatewayDefaultAgentId: null,
  openClawSessions: [],
  tasks: [],
  kanbanLoaded: false,
  cronJobs: [],
  cronLoaded: false,
  activeAgentId: SEED_AGENTS[0].id,
  activeSessionKey: null,
  selectedModel: CLAUDE_MODELS[1].id,
  chatMessagesBySession: {},
  pendingChatBySession: {},
  taskRunByTaskId: {},
  taskIdByRunId: {},
  activeView: 'chat',
  sidebarOpen: true,

  initWS: () => {
    openClawWS.onStatus((status) => {
      set({ connectionStatus: status })
      if (status === 'disconnected' || status === 'error') {
        set({ pendingChatBySession: {} })
      }
    })

    openClawWS.onMessage((msg) => {
      switch (msg.type) {
        case 'connected': {
          set({ serverVersion: msg.server_version ?? null })
          if (!msg.token_valid) {
            console.warn('[OpenClaw] Token invalide')
          }
          void get().bootstrapGateway()
          break
        }

        case 'agent_status': {
          set({ agents: msg.agents })
          break
        }

        case 'task_update': {
          set((state) => {
            const idx = state.tasks.findIndex((t) => t.id === msg.task.id)
            if (idx === -1) return { tasks: [...state.tasks, msg.task] }
            const tasks = [...state.tasks]
            tasks[idx] = msg.task
            return { tasks }
          })
          schedulePersist(get)
          break
        }

        case 'chat_response': {
          set((state) => {
            const key = msg.agentId
            const sessions = { ...state.chatMessagesBySession }
            const msgs = [...(sessions[key] ?? [])]
            const existingIdx = msgs.findIndex((m) => m.id === msg.messageId)
            if (existingIdx !== -1) {
              msgs[existingIdx] = {
                ...msgs[existingIdx],
                content: msgs[existingIdx].content + msg.content,
                streaming: !msg.done,
              }
            } else {
              msgs.push({
                id: msg.messageId,
                role: 'assistant',
                content: msg.content,
                agentId: key,
                model: msg.model,
                timestamp: Date.now(),
                streaming: !msg.done,
              })
            }
            sessions[key] = msgs
            return { chatMessagesBySession: sessions }
          })
          break
        }

        case 'gateway_chat': {
          const { sessionKey, runId, state, message, errorMessage } = msg
          if (!sessionKey || !runId) break

          const taskId = get().taskIdByRunId[runId]
          const bumpProgress = (seq: number) => {
            const base = 10
            const max = 92
            const next = Math.min(max, base + Math.floor(Math.log2(Math.max(1, seq + 1)) * 18) + seq * 2)
            set((s) => ({
              tasks: s.tasks.map((t) =>
                t.id === taskId && t.status === 'in_progress'
                  ? { ...t, progress: Math.max(t.progress ?? 0, next), updatedAt: Date.now() }
                  : t,
              ),
            }))
          }

          if (state === 'error') {
            set((s) => {
              const msgs = [...(s.chatMessagesBySession[sessionKey] ?? [])]
              msgs.push({
                id: nextId(),
                role: 'system',
                content: errorMessage ?? 'Erreur gateway',
                agentId: sessionKey,
                timestamp: Date.now(),
              })
              return {
                chatMessagesBySession: { ...s.chatMessagesBySession, [sessionKey]: msgs },
                pendingChatBySession: clearPendingRunFromState(s.pendingChatBySession, sessionKey, runId),
              }
            })

            if (taskId) {
              set((s) => ({
                tasks: s.tasks.map((t) =>
                  t.id === taskId ? { ...t, status: 'failed', progress: undefined, updatedAt: Date.now() } : t,
                ),
                taskRunByTaskId: Object.fromEntries(
                  Object.entries(s.taskRunByTaskId).filter(([tid]) => tid !== taskId),
                ),
                taskIdByRunId: Object.fromEntries(
                  Object.entries(s.taskIdByRunId).filter(([rid]) => rid !== runId),
                ),
              }))
            }
            break
          }

          if (state === 'delta') {
            const chunk = textFromGatewayMessage(message)
            set((s) => {
              const pendingChatBySession = {
                ...s.pendingChatBySession,
                [sessionKey]: s.pendingChatBySession[sessionKey] || runId,
              }
              if (!chunk) return { pendingChatBySession }
              const msgs = [...(s.chatMessagesBySession[sessionKey] ?? [])]
              const idx = msgs.findIndex((m) => m.id === runId)
              if (idx === -1) {
                msgs.push({
                  id: runId,
                  role: 'assistant',
                  content: chunk,
                  agentId: sessionKey,
                  model: s.selectedModel,
                  timestamp: Date.now(),
                  streaming: true,
                })
              } else {
                const cur = msgs[idx].content
                const nextText =
                  chunk.length >= cur.length && chunk.startsWith(cur) ? chunk : cur + chunk
                msgs[idx] = { ...msgs[idx], content: nextText, streaming: true }
              }
              return {
                pendingChatBySession,
                chatMessagesBySession: { ...s.chatMessagesBySession, [sessionKey]: msgs },
              }
            })
            if (taskId) bumpProgress(msg.seq ?? 0)
            break
          }

          if (state === 'final' || state === 'aborted') {
            const finalPiece = textFromGatewayMessage(message)
            set((s) => {
              const msgs = [...(s.chatMessagesBySession[sessionKey] ?? [])]
              const idx = msgs.findIndex((m) => m.id === runId)
              const prevText = idx !== -1 ? msgs[idx].content : ''
              const merged =
                finalPiece.trim() && prevText && !prevText.includes(finalPiece.trim())
                  ? `${prevText}\n${finalPiece}`.trim()
                  : finalPiece.trim() || prevText
              if (idx === -1) {
                if (merged) {
                  msgs.push({
                    id: runId,
                    role: 'assistant',
                    content: merged,
                    agentId: sessionKey,
                    model: s.selectedModel,
                    timestamp: Date.now(),
                    streaming: false,
                  })
                }
              } else {
                msgs[idx] = {
                  ...msgs[idx],
                  content: merged,
                  streaming: false,
                }
              }
              return {
                chatMessagesBySession: { ...s.chatMessagesBySession, [sessionKey]: msgs },
                pendingChatBySession: clearPendingRunFromState(s.pendingChatBySession, sessionKey, runId),
              }
            })

            if (taskId) {
              const finalStatus = state === 'aborted' ? 'failed' : 'done'
              set((s) => ({
                tasks: s.tasks.map((t) =>
                  t.id === taskId
                    ? {
                        ...t,
                        status: finalStatus,
                        progress: finalStatus === 'done' ? 100 : undefined,
                        updatedAt: Date.now(),
                      }
                    : t,
                ),
                taskRunByTaskId: Object.fromEntries(
                  Object.entries(s.taskRunByTaskId).filter(([tid]) => tid !== taskId),
                ),
                taskIdByRunId: Object.fromEntries(
                  Object.entries(s.taskIdByRunId).filter(([rid]) => rid !== runId),
                ),
              }))
            }
          }
          break
        }

        case 'sessions_changed': {
          void get().refreshOpenClawSessions()
          break
        }

        case 'error': {
          console.error('[OpenClaw error]', msg.code, msg.message)
          break
        }
      }
    })

    openClawWS.connect()

    if (!_taskScheduler) {
      _taskScheduler = setInterval(() => {
        const { tasks, connectionStatus } = get()
        if (connectionStatus !== 'connected') return
        const now = Date.now()
        for (const t of tasks) {
          if (t.status !== 'todo') continue
          if (typeof t.scheduledAt !== 'number') continue
          if (t.startedAt) continue
          if (t.scheduledAt <= now) {
            void get().startTask(t.id)
          }
        }
      }, 2000)
    }
  },

  disconnectWS: () => {
    set({ pendingChatBySession: {} })
    openClawWS.disconnect()
    if (_taskScheduler) {
      clearInterval(_taskScheduler)
      _taskScheduler = null
    }
    if (_persistTimer) {
      clearTimeout(_persistTimer)
      _persistTimer = null
    }
  },

  bootstrapGateway: async () => {
    try {
      await openClawWS.request('sessions.subscribe', {})
    } catch (e) {
      console.warn('[OpenClaw] sessions.subscribe', e)
    }
    try {
      const [agentsRes, modelsRes] = await Promise.all([
        openClawWS.request<AgentsListResult>('agents.list', {}),
        openClawWS.request<ModelsListResult>('models.list', {}),
      ])
      const agents = agentsListToAgents(agentsRes)
      const gatewayModels = modelsListToOptions(modelsRes.models ?? [])
      set({
        agents: agents.length ? agents : get().agents,
        gatewayModels: gatewayModels.length ? gatewayModels : [...CLAUDE_MODELS],
        gatewayDefaultAgentId:
          (agentsRes.defaultId && String(agentsRes.defaultId)) || agents[0]?.id || null,
      })
      if (agents.length) {
        const cur = get().activeAgentId
        if (!cur || !agents.some((a) => a.id === cur)) {
          set({ activeAgentId: agents[0].id })
        }
      }
    } catch (e) {
      console.error('[OpenClaw] agents/models', e)
    }
    await get().refreshOpenClawSessions()
    await get().refreshCronJobs()
  },

  refreshOpenClawSessions: async () => {
    try {
      const sessionsRes = await openClawWS.request<SessionsListResult>('sessions.list', {
        limit: 200,
        includeDerivedTitles: true,
        includeLastMessage: true,
      })
      const sessions = sessionsRes.sessions ?? []
      const prev = get().activeSessionKey
      const { activeAgentId } = get()

      let visible = sessions
      if (activeAgentId) {
        const filtered = sessions.filter((s) => parseSessionKeyAgentId(s.key) === activeAgentId)
        if (filtered.length > 0) visible = filtered
      }

      const keys = new Set(visible.map((s) => s.key))
      let next = prev && keys.has(prev) ? prev : visible[0]?.key ?? null
      if (!next && sessions.length > 0) next = sessions[0].key

      set({ openClawSessions: sessions, activeSessionKey: next })

      if (next) {
        const row = sessions.find((s) => s.key === next)
        if (row?.model) set({ selectedModel: row.model })
        if (next !== prev) {
          await get().loadSessionHistory(next)
        }
      }
    } catch (e) {
      console.error('[OpenClaw] sessions.list', e)
    }
  },

  refreshCronJobs: async () => {
    try {
      const res = await openClawWS.request<CronListResult | CronJob[]>('cron.list', {})
      const jobs = Array.isArray(res) ? res : (res.jobs ?? [])
      set({ cronJobs: jobs, cronLoaded: true })
    } catch (e) {
      console.warn('[OpenClaw] cron.list', e)
      set({ cronLoaded: true })
    }
  },

  loadKanbanFromDb: async () => {
    try {
      const tasks = await loadKanbanTasks()
      set({ tasks, kanbanLoaded: true })
    } catch (e) {
      console.warn('[Kanban sqlite] load failed', e)
      set({ kanbanLoaded: true })
    }
  },

  addCronJob: async (job) => {
    await openClawWS.request('cron.add', job)
    await get().refreshCronJobs()
  },

  updateCronJob: async (jobId, patch) => {
    await openClawWS.request('cron.update', { jobId, patch })
    await get().refreshCronJobs()
  },

  removeCronJob: async (jobId) => {
    await openClawWS.request('cron.remove', { jobId })
    await get().refreshCronJobs()
  },

  createTask: (taskData) => {
    const task: Task = {
      ...taskData,
      id: nextId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    set((state) => ({ tasks: [...state.tasks, task] }))
    schedulePersist(get)
  },

  updateTaskStatus: (taskId, status) => {
    const prev = get().tasks.find((t) => t.id === taskId)
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, status, updatedAt: Date.now() } : t,
      ),
    }))
    schedulePersist(get)
    if (status === 'in_progress' && prev?.status !== 'in_progress') {
      void get().startTask(taskId)
    }
  },

  deleteTask: (taskId) => {
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== taskId) }))
    schedulePersist(get)
  },

  startTask: async (taskId) => {
    const task = get().tasks.find((t) => t.id === taskId)
    if (!task) return
    if (task.status !== 'in_progress') {
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === taskId ? { ...t, status: 'in_progress', updatedAt: Date.now() } : t,
        ),
      }))
    }

    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? { ...t, startedAt: t.startedAt ?? Date.now(), scheduledAt: undefined, updatedAt: Date.now() }
          : t,
      ),
    }))

    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId && t.status === 'in_progress'
          ? { ...t, progress: t.progress ?? 5, updatedAt: Date.now() }
          : t,
      ),
    }))

    let sessionKey = task.sessionKey?.trim() || ''
    const model = get().selectedModel

    if (!sessionKey && task.agentId) {
      try {
        const params: Record<string, unknown> = { agentId: task.agentId, model }
        if (task.subAgentId) params.subAgentId = task.subAgentId
        const res = (await openClawWS.request('sessions.spawn', params)) as { key?: unknown }
        if (typeof res.key === 'string' && res.key.trim()) sessionKey = res.key.trim()
      } catch (e) {
        if (!task.subAgentId) {
          try {
            const res = (await openClawWS.request('sessions.create', { agentId: task.agentId, model })) as {
              key?: unknown
            }
            if (typeof res.key === 'string' && res.key.trim()) sessionKey = res.key.trim()
          } catch (e2) {
            console.error('[OpenClaw] sessions.create/spawn', e2)
          }
        } else {
          console.error('[OpenClaw] sessions.spawn', e)
        }
      }
    }

    if (sessionKey) {
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, sessionKey, updatedAt: Date.now() } : t)),
      }))
      await get().refreshOpenClawSessions()

      const message = [task.title.trim(), task.description?.trim()].filter(Boolean).join('\n\n')
      try {
        const runId =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}_${Math.random().toString(16).slice(2)}`
        set((s) => ({
          taskRunByTaskId: { ...s.taskRunByTaskId, [taskId]: runId },
          taskIdByRunId: { ...s.taskIdByRunId, [runId]: taskId },
        }))
        await openClawWS.request('chat.send', {
          sessionKey,
          message,
          idempotencyKey: runId,
        })
      } catch (e) {
        console.error('[OpenClaw] chat.send (task)', e)
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, status: 'failed', progress: undefined, updatedAt: Date.now() } : t,
          ),
        }))
      }
      return
    }

    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, status: 'failed', updatedAt: Date.now() } : t,
      ),
    }))
  },

  setActiveAgent: (agentId) => set({ activeAgentId: agentId }),

  setActiveSessionKey: async (sessionKey) => {
    set({ activeSessionKey: sessionKey })
    if (!sessionKey) return
    const row = get().openClawSessions.find((s) => s.key === sessionKey)
    if (row?.model) set({ selectedModel: row.model })
    await get().loadSessionHistory(sessionKey)
  },

  createOpenClawSession: async (agentId) => {
    const {
      gatewayDefaultAgentId,
      agents,
      selectedModel,
    } = get()
    const aid =
      (agentId && agentId.trim()) ||
      gatewayDefaultAgentId ||
      agents[0]?.id ||
      ''
    if (!aid) {
      console.warn('[OpenClaw] Aucun agent pour créer une session')
      return
    }
    try {
      const res = (await openClawWS.request('sessions.create', {
        agentId: aid,
        model: selectedModel,
      })) as { key?: string }
      const key = typeof res.key === 'string' ? res.key : null
      if (!key) return
      await get().refreshOpenClawSessions()
      await get().setActiveSessionKey(key)
    } catch (e) {
      console.error('[OpenClaw] sessions.create', e)
    }
  },

  setSelectedModel: (model) => {
    set({ selectedModel: model })
    void get().patchSessionModel(model)
  },

  patchSessionModel: async (model) => {
    const key = get().activeSessionKey
    if (!key) return
    try {
      await openClawWS.request('sessions.patch', { key, model })
    } catch (e) {
      console.error('[OpenClaw] sessions.patch', e)
    }
  },

  loadSessionHistory: async (sessionKey) => {
    try {
      const res = await openClawWS.request<{ messages?: unknown[] }>('chat.history', {
        sessionKey,
        limit: 200,
      })
      const messages = (res.messages ?? []).map((m, i) => historyToChatMessage(m, sessionKey, i))
      set((s) => ({
        chatMessagesBySession: { ...s.chatMessagesBySession, [sessionKey]: messages },
      }))
    } catch (e) {
      console.error('[OpenClaw] chat.history', e)
    }
  },

  sendChatMessage: (content) => {
    const { activeSessionKey, chatMessagesBySession } = get()
    const key = activeSessionKey?.trim()
    if (!key || !content.trim()) return

    const messageId = nextId()
    const userMsg: ChatMessage = {
      id: `${messageId}_user`,
      role: 'user',
      content,
      agentId: key,
      timestamp: Date.now(),
    }

    const idempotencyKey =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(16).slice(2)}`

    set({
      chatMessagesBySession: {
        ...chatMessagesBySession,
        [key]: [...(chatMessagesBySession[key] ?? []), userMsg],
      },
      pendingChatBySession: {
        ...get().pendingChatBySession,
        [key]: idempotencyKey,
      },
    })

    void openClawWS
      .request('chat.send', {
        sessionKey: key,
        message: content,
        idempotencyKey,
      })
      .catch((e) => {
        console.error('[OpenClaw] chat.send', e)
        set((s) => {
          const p = { ...s.pendingChatBySession }
          if (p[key] === idempotencyKey) delete p[key]
          return { pendingChatBySession: p }
        })
      })
  },

  setView: (view) => set({ activeView: view }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
