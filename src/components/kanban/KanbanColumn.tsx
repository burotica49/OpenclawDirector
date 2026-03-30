import type { FC } from 'react'
import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import type { Task, TaskStatus } from '../../types'
import { TaskCard } from './TaskCard'
import { CreateTaskModal } from './CreateTaskModal'
import { t } from '../../i18n'

interface Props {
  id: TaskStatus
  label: string
  tasks: Task[]
  accent: string
}

export const KanbanColumn: FC<Props> = ({ id, label, tasks, accent }) => {
  const [creating, setCreating] = useState(false)
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <>
      <div
        className={`flex flex-col rounded-2xl glass col-${id} w-full xl:min-w-[270px] xl:w-72 xl:flex-shrink-0 overflow-hidden transition-all duration-200 max-w-2xl xl:max-w-none mx-auto xl:mx-0 ${
          isOver ? 'ring-1 ring-indigo-500/40 bg-indigo-500/5' : ''
        }`}
      >
        {/* Column header */}
        <div className="px-4 py-3.5 flex items-center gap-2 border-b border-white/5">
          <span className={`w-2 h-2 rounded-full ${accent}`} />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{label}</span>
          <span className="ml-auto text-xs font-mono text-slate-500 bg-white/5 px-1.5 py-0.5 rounded-md">
            {tasks.length}
          </span>
        </div>

        {/* Cards */}
        <div
          ref={setNodeRef}
          className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[100px] max-h-[min(55vh,420px)] xl:max-h-none xl:min-h-[120px]"
        >
          <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </SortableContext>

          {tasks.length === 0 && (
            <div className="flex items-center justify-center h-16 rounded-xl border border-dashed border-white/10">
              <span className="text-xs text-slate-600">{t('kanban.drop_here')}</span>
            </div>
          )}
        </div>

        {/* Add button */}
        <div className="p-3 border-t border-white/5">
          <button
            onClick={() => setCreating(true)}
            className="w-full flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-300
                       hover:bg-white/5 transition-all group"
          >
            <Plus size={13} className="group-hover:text-indigo-400 transition-colors" />
            {t('kanban.add_task')}
          </button>
        </div>
      </div>

      {creating && (
        <CreateTaskModal defaultStatus={id} onClose={() => setCreating(false)} />
      )}
    </>
  )
}
