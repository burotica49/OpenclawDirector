import { type FC, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Save } from 'lucide-react'
import { useStore } from '../../store'
import type { Task, TaskPriority, TaskStatus } from '../../types'
import { t } from '../../i18n'

function toDatetimeLocal(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function assigneeValueFromTask(task: Task): string {
  if (task.subAgentId && task.agentId) return `sub:${task.agentId}:${task.subAgentId}`
  if (task.agentId) return `agent:${task.agentId}`
  return ''
}

interface Props {
  task: Task
  onClose: () => void
}

export const EditTaskModal: FC<Props> = ({ task, onClose }) => {
  const { updateTask, startTask, agents } = useStore()
  const [title, setTitle] = useState(task.title)
  const [desc, setDesc] = useState(task.description ?? '')
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [assignee, setAssignee] = useState(() => assigneeValueFromTask(task))
  const [scheduledAt, setScheduledAt] = useState(
    typeof task.scheduledAt === 'number' && Number.isFinite(task.scheduledAt)
      ? toDatetimeLocal(task.scheduledAt)
      : '',
  )
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = () => {
    if (!title.trim()) return

    const assignPatch: Pick<
      Task,
      'agentId' | 'agentName' | 'assigneeKind' | 'subAgentId' | 'subAgentName'
    > = {
      agentId: undefined,
      agentName: undefined,
      assigneeKind: undefined,
      subAgentId: undefined,
      subAgentName: undefined,
    }

    if (assignee.startsWith('agent:')) {
      const id = assignee.slice('agent:'.length)
      const agent = agents.find((a) => a.id === id)
      if (agent) {
        assignPatch.agentId = agent.id
        assignPatch.agentName = agent.name
        assignPatch.assigneeKind = 'agent'
      }
    } else if (assignee.startsWith('sub:')) {
      const rest = assignee.slice('sub:'.length)
      const [parentId, sid] = rest.split(':')
      const parent = agents.find((a) => a.id === parentId)
      const sub = parent?.subAgents.find((s) => s.id === sid)
      if (parent && sub) {
        assignPatch.agentId = parent.id
        assignPatch.agentName = parent.name
        assignPatch.assigneeKind = 'subagent'
        assignPatch.subAgentId = sub.id
        assignPatch.subAgentName = sub.name
      }
    }

    const sched =
      scheduledAt.trim() ? new Date(scheduledAt).getTime() : undefined
    const scheduled =
      typeof sched === 'number' && Number.isFinite(sched) ? sched : undefined

    const prevStatus = useStore.getState().tasks.find((t) => t.id === task.id)?.status

    updateTask(task.id, {
      title: title.trim(),
      description: desc.trim() || undefined,
      priority,
      status,
      scheduledAt: scheduled,
      ...assignPatch,
    })

    if (status === 'in_progress' && prevStatus !== 'in_progress') {
      void startTask(task.id)
    }

    onClose()
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="glass rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 w-full sm:max-w-md max-h-[92dvh] overflow-y-auto overscroll-contain shadow-2xl animate-slide-in gradient-border mb-0 sm:mb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-slate-200">Modifier la tâche</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              Titre <span className="text-red-400">*</span>
            </label>
            <input
              ref={inputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Titre de la tâche…"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600
                         focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Description</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Description optionnelle…"
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600
                         focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Priorité</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200
                           focus:outline-none focus:border-indigo-500/50 transition-all"
              >
                <option value="low">Basse</option>
                <option value="medium">Moyenne</option>
                <option value="high">Haute</option>
                <option value="critical">Critique</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Colonne</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200
                           focus:outline-none focus:border-indigo-500/50 transition-all"
              >
                <option value="todo">Todo</option>
                <option value="in_progress">{t('kanban.col.in_progress')}</option>
                <option value="done">{t('kanban.col.done')}</option>
                <option value="failed">{t('kanban.col.failed')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Assigner à un agent</label>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200
                         focus:outline-none focus:border-indigo-500/50 transition-all"
            >
              <option value="">— Aucun —</option>
              {agents.map((a) => (
                <option key={a.id} value={`agent:${a.id}`}>
                  {a.name}
                </option>
              ))}
              {agents.flatMap((a) =>
                (a.subAgents ?? []).map((s) => (
                  <option key={`${a.id}:${s.id}`} value={`sub:${a.id}:${s.id}`}>
                    {a.name} · {s.name}
                  </option>
                )),
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Planifier (optionnel)</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600
                         focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
            <p className="mt-1 text-[10px] text-slate-600">
              Si renseigné, la tâche passera automatiquement en « {t('kanban.col.in_progress')} » à l’heure choisie
              (si connecté).
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 transition-all"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium
                       bg-indigo-500 hover:bg-indigo-400 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save size={13} />
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  , document.body)
}
