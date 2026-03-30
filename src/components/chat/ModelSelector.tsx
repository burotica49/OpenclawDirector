import type { FC } from 'react'
import { ChevronDown, Cpu } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import type { ModelOption } from '../../types'

interface Props {
  value: string
  models: ModelOption[]
  onChange: (model: string) => void
}

const tierColor: Record<string, string> = {
  opus: 'text-violet-400',
  sonnet: 'text-indigo-400',
  haiku: 'text-sky-400',
}

export const ModelSelector: FC<Props> = ({ value, models, onChange }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const list = models.length > 0 ? models : []
  const current = list.find((m) => m.id === value) ?? list[0]

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!current) return null

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-2 sm:py-1.5 rounded-lg glass-hover text-xs font-medium transition-all min-h-[40px] sm:min-h-0 max-w-[min(12rem,45vw)]"
      >
        <Cpu size={11} className={tierColor[current.tier] ?? 'text-slate-400'} />
        <span className="text-slate-300 max-w-[140px] truncate">{current.label}</span>
        <ChevronDown size={11} className={`text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute z-[60] left-0 right-0 sm:left-auto sm:right-0 top-full mt-1.5
            w-full sm:w-64 max-h-[min(50dvh,320px)] overflow-y-auto overscroll-contain glass rounded-xl shadow-xl border border-white/10 overflow-hidden animate-slide-in"
        >
          {list.map((model) => (
            <button
              type="button"
              key={model.id}
              onClick={() => {
                onChange(model.id)
                setOpen(false)
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/5 transition-colors ${
                model.id === value ? 'bg-indigo-500/10' : ''
              }`}
            >
              <Cpu size={12} className={tierColor[model.tier] ?? 'text-slate-400'} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-slate-200 truncate">{model.label}</div>
                <div className="text-[10px] text-slate-500">ctx {model.contextWindow}</div>
              </div>
              {model.id === value && (
                <span className="ml-auto w-1.5 h-1.5 bg-indigo-400 rounded-full flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
