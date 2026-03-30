import type { FC } from 'react'
import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { Kanban, Plus } from 'lucide-react'
import { useStore } from '../../store'
import { KanbanColumn } from './KanbanColumn'
import { TaskCard } from './TaskCard'
import { CreateTaskModal } from './CreateTaskModal'
import type { Task, TaskStatus } from '../../types'
import { t } from '../../i18n'

const COLUMNS: { id: TaskStatus; label: string; accent: string }[] = [
  { id: 'todo', label: t('kanban.col.todo'), accent: 'bg-indigo-400' },
  { id: 'in_progress', label: t('kanban.col.in_progress'), accent: 'bg-amber-400' },
  { id: 'done', label: t('kanban.col.done'), accent: 'bg-emerald-400' },
  { id: 'failed', label: t('kanban.col.failed'), accent: 'bg-red-400' },
]

export const KanbanBoard: FC = () => {
  const { tasks, updateTaskStatus } = useStore()
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [creating, setCreating] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  )

  const tasksByCol = (col: TaskStatus) => tasks.filter((t) => t.status === col)

  const handleDragStart = (e: DragStartEvent) => {
    const task = tasks.find((t) => t.id === e.active.id)
    setActiveTask(task ?? null)
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveTask(null)
    const { active, over } = e
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    if (COLUMNS.some((c) => c.id === overId)) {
      const task = tasks.find((t) => t.id === activeId)
      if (task && task.status !== overId) {
        updateTaskStatus(activeId, overId as TaskStatus)
      }
      return
    }

    const overTask = tasks.find((t) => t.id === overId)
    if (!overTask) return

    const activeTaskFound = tasks.find((t) => t.id === activeId)
    if (!activeTaskFound) return

    if (activeTaskFound.status !== overTask.status) {
      updateTaskStatus(activeId, overTask.status)
    }
  }

  const totalActive = tasks.filter((t) => t.status === 'in_progress').length

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-3 sm:px-6 py-3 sm:py-4 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Kanban size={16} className="text-indigo-400 flex-shrink-0" />
          <h1 className="text-sm font-semibold text-slate-200 truncate">{t('kanban.title')}</h1>
          {totalActive > 0 && (
            <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full whitespace-nowrap">
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
              {t('kanban.active_count', { count: totalActive })}
            </span>
          )}
        </div>
        <div className="flex-1 hidden sm:block" />
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2.5 sm:py-1.5 rounded-lg text-xs font-medium
            bg-indigo-500 hover:bg-indigo-400 text-white transition-all w-full sm:w-auto min-h-[44px] sm:min-h-0"
        >
          <Plus size={13} />
          {t('kanban.new_task')}
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 min-h-0 overflow-y-auto xl:overflow-x-auto xl:overflow-y-hidden px-3 sm:px-6 pb-4 sm:pb-6 overscroll-contain">
          <div className="flex flex-col xl:flex-row gap-4 h-auto xl:h-full xl:items-stretch xl:min-h-0 xl:min-w-max">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                id={col.id}
                label={col.label}
                accent={col.accent}
                tasks={tasksByCol(col.id)}
              />
            ))}
          </div>
        </div>

        <DragOverlay>{activeTask ? <TaskCard task={activeTask} overlay /> : null}</DragOverlay>
      </DndContext>

      {creating && <CreateTaskModal onClose={() => setCreating(false)} />}
    </div>
  )
}
