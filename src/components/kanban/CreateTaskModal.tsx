import { type FC, useState, useRef, useEffect } from 'react'
import { X, Plus } from 'lucide-react'
import { useStore } from '../../store'
import type { TaskPriority, TaskStatus } from '../../types'
import { t } from '../../i18n'

interface Props {
  defaultStatus?: TaskStatus
  onClose: () => void
}

export const CreateTaskModal: FC<Props> = ({ defaultStatus = 'todo', onClose }) => {
  const { createTask, agents } = useStore()
  const [title, setTitle]       = useState('')
  const [desc, setDesc]         = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [assignee, setAssignee] = useState('')
  const [status, setStatus]     = useState<TaskStatus>(defaultStatus)
  const [scheduledAt, setScheduledAt] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSubmit = () => {
    if (!title.trim()) return
    let agentId: string | undefined
    let agentName: string | undefined
    let assigneeKind: 'agent' | 'subagent' | undefined
    let subAgentId: string | undefined
    let subAgentName: string | undefined

    if (assignee.startsWith('agent:')) {
      const id = assignee.slice('agent:'.length)
      const agent = agents.find((a) => a.id === id)
      if (agent) {
        agentId = agent.id
        agentName = agent.name
        assigneeKind = 'agent'
      }
    } else if (assignee.startsWith('sub:')) {
      const rest = assignee.slice('sub:'.length)
      const [parentId, sid] = rest.split(':')
      const parent = agents.find((a) => a.id === parentId)
      const sub = parent?.subAgents.find((s) => s.id === sid)
      if (parent && sub) {
        agentId = parent.id
        agentName = parent.name
        assigneeKind = 'subagent'
        subAgentId = sub.id
        subAgentName = sub.name
      }
    }

    const sched =
      scheduledAt.trim() ? new Date(scheduledAt).getTime() : undefined

    createTask({
      title: title.trim(),
      description: desc.trim() || undefined,
      priority,
      status,
      agentId,
      agentName,
      assigneeKind,
      subAgentId,
      subAgentName,
      scheduledAt: typeof sched === 'number' && Number.isFinite(sched) ? sched : undefined,
      tags: [],
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="glass rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 w-full sm:max-w-md max-h-[92dvh] overflow-y-auto overscroll-contain shadow-2xl animate-slide-in gradient-border mb-0 sm:mb-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-slate-200">{t('kanban.new_task')}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Titre <span className="text-red-400">*</span></label>
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
                <option key={a.id} value={`agent:${a.id}`}>{a.name}</option>
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

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 transition-all"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium
                       bg-indigo-500 hover:bg-indigo-400 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={13} />
            Créer
          </button>
        </div>
      </div>
    </div>
  )
}
