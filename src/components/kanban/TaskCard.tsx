import type { FC } from 'react'
import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Bot, Trash2, ChevronDown, AlertTriangle, ArrowUp, Minus, ArrowDown, type LucideIcon } from 'lucide-react'
import type { Task, TaskPriority } from '../../types'
import { Badge } from '../ui/Badge'
import { useStore } from '../../store'

const priorityMap: Record<TaskPriority, { color: 'red' | 'amber' | 'indigo' | 'slate'; label: string; Icon: LucideIcon }> = {
  critical: { color: 'red',    label: 'Critique', Icon: AlertTriangle },
  high:     { color: 'amber',  label: 'Haute',    Icon: ArrowUp },
  medium:   { color: 'indigo', label: 'Moyenne',  Icon: Minus },
  low:      { color: 'slate',  label: 'Basse',    Icon: ArrowDown },
}

interface Props {
  task: Task
  overlay?: boolean
}

export const TaskCard: FC<Props> = ({ task, overlay }) => {
  const [expanded, setExpanded] = useState(false)
  const { deleteTask, setActiveSessionKey, setView, startTask } = useStore()

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  }

  const { color, label: prioLabel, Icon: PrioIcon } = priorityMap[task.priority]

  return (
    <div
      ref={setNodeRef}
      style={overlay ? undefined : style}
      className={`task-card group ${overlay ? 'rotate-2 shadow-2xl' : ''}`}
    >
      {/* Header row */}
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 text-slate-600 hover:text-slate-400 transition-colors flex-shrink-0 touch-none"
        >
          <GripVertical size={14} />
        </button>

        {/* Title */}
        <p className="flex-1 text-sm font-medium text-slate-200 leading-snug min-w-0">
          {task.title}
        </p>

        {/* Expand */}
        {task.description && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="mt-0.5 text-slate-600 hover:text-slate-300 transition-colors flex-shrink-0"
          >
            <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* Description */}
      {expanded && task.description && (
        <p className="mt-1.5 ml-5 text-xs text-slate-400 leading-relaxed animate-fade-in">
          {task.description}
        </p>
      )}

      {/* Progress bar */}
      {task.progress !== undefined && task.status === 'in_progress' && (
        <div className="mt-2 ml-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-500">Progression</span>
            <span className="text-[10px] text-slate-400 font-mono">{task.progress}%</span>
          </div>
          <div className="h-1 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
              style={{ width: `${task.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-2.5 ml-5 flex items-center gap-1.5 flex-wrap">
        <Badge label={prioLabel} color={color} />
        {typeof task.scheduledAt === 'number' && task.status === 'todo' && task.scheduledAt > Date.now() && (
          <Badge
            label={`Planifiée · ${new Date(task.scheduledAt).toLocaleString()}`}
            color="indigo"
          />
        )}
        {task.tags?.map((tag) => (
          <Badge key={tag} label={`#${tag}`} color="slate" />
        ))}
        {task.agentName && (
          <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
            <Bot size={9} />
            {task.subAgentName ? `${task.agentName} · ${task.subAgentName}` : task.agentName}
          </span>
        )}

        <div className="flex-1" />

        {task.status === 'todo' && task.agentId && (
          <button
            type="button"
            onClick={() => void startTask(task.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-indigo-300 text-[10px] px-2 py-1 rounded-md hover:bg-white/5"
          >
            Démarrer
          </button>
        )}

        {task.sessionKey && (
          <button
            type="button"
            onClick={() => {
              void setActiveSessionKey(task.sessionKey ?? null)
              setView('chat')
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-slate-300 text-[10px] px-2 py-1 rounded-md hover:bg-white/5"
          >
            Ouvrir chat
          </button>
        )}

        {/* Delete */}
        <button
          onClick={() => deleteTask(task.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-red-400"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}
