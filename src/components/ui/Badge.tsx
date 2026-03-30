import type { FC } from 'react'

interface BadgeProps {
  label: string
  color?: 'indigo' | 'amber' | 'green' | 'red' | 'slate' | 'violet'
  size?: 'xs' | 'sm'
}

const colorMap = {
  indigo: 'bg-indigo-500/15 text-indigo-300 ring-indigo-500/20',
  amber:  'bg-amber-500/15  text-amber-300  ring-amber-500/20',
  green:  'bg-emerald-500/15 text-emerald-300 ring-emerald-500/20',
  red:    'bg-red-500/15    text-red-300    ring-red-500/20',
  slate:  'bg-slate-500/15  text-slate-300  ring-slate-500/20',
  violet: 'bg-violet-500/15 text-violet-300 ring-violet-500/20',
}

export const Badge: FC<BadgeProps> = ({ label, color = 'slate', size = 'xs' }) => (
  <span className={`
    inline-flex items-center rounded-full font-medium ring-1 ring-inset
    ${colorMap[color]}
    ${size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'}
  `}>
    {label}
  </span>
)
