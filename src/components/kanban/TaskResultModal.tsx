import type { FC } from 'react'
import { createPortal } from 'react-dom'
import { X, MessageSquare } from 'lucide-react'
import type { Task } from '../../types'
import { useStore } from '../../store'

interface Props {
  task: Task
  onClose: () => void
}

export const TaskResultModal: FC<Props> = ({ task, onClose }) => {
  const { setActiveSessionKey, setView } = useStore()

  const isFailed = task.status === 'failed'
  const body = isFailed
    ? (task.error?.trim() ? task.error : 'Aucun message d’erreur.')
    : task.result?.trim()
      ? task.result
      : 'Aucune réponse enregistrée.'

  const titleLabel = isFailed ? 'Erreur' : 'Résultat'

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="glass rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 w-full sm:max-w-lg max-h-[92dvh] flex flex-col shadow-2xl animate-slide-in gradient-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-200">{titleLabel}</h2>
            <p className="mt-1 text-xs text-slate-500 line-clamp-2">{task.title}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        <div
          className={`flex-1 min-h-0 overflow-y-auto overscroll-contain rounded-lg border px-3 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
            isFailed
              ? 'bg-red-500/10 border-red-500/25 text-red-100/90'
              : 'bg-white/5 border-white/10 text-slate-200/95'
          }`}
        >
          {body}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-5 flex-shrink-0">
          {task.sessionKey && (
            <button
              type="button"
              onClick={() => {
                void setActiveSessionKey(task.sessionKey ?? null)
                setView('chat')
                onClose()
              }}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium
                         text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
            >
              <MessageSquare size={13} />
              Ouvrir le chat
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              task.sessionKey
                ? 'sm:w-auto text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10'
                : 'flex-1 text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10'
            }`}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  , document.body)
}
