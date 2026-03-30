import type { FC } from 'react'
import { Wifi, WifiOff, Loader2, AlertTriangle, type LucideIcon } from 'lucide-react'
import type { ConnectionStatus as CS } from '../../types'
import { t } from '../../i18n'

interface Props {
  status: CS
  version?: string | null
}

const cfg: Record<
  CS,
  { icon: LucideIcon; label: string; short: string; dot: string; text: string }
> = {
  connected: {
    icon: Wifi,
    label: t('ws.connected'),
    short: 'OK',
    dot: 'bg-emerald-400',
    text: 'text-emerald-400',
  },
  connecting: {
    icon: Loader2,
    label: t('ws.connecting'),
    short: '…',
    dot: 'bg-amber-400 animate-pulse',
    text: 'text-amber-400',
  },
  disconnected: {
    icon: WifiOff,
    label: t('ws.disconnected'),
    short: 'Off',
    dot: 'bg-slate-500',
    text: 'text-slate-400',
  },
  error: {
    icon: AlertTriangle,
    label: t('ws.error'),
    short: '!',
    dot: 'bg-red-400',
    text: 'text-red-400',
  },
}

export const ConnectionStatus: FC<Props> = ({ status, version }) => {
  const { icon: Icon, label, short, dot, text } = cfg[status]
  const isSpinning = status === 'connecting'

  return (
    <div
      className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg glass text-xs max-w-[min(100%,11rem)] sm:max-w-none flex-shrink-0"
      title={`${label}${version && status === 'connected' ? ` · v${version}` : ''}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot} flex-shrink-0`} />
      <Icon size={12} className={`${text} flex-shrink-0 ${isSpinning ? 'animate-spin' : ''}`} />
      <span className={`${text} truncate sm:hidden`}>{short}</span>
      <span className={`${text} truncate hidden sm:inline`}>{label}</span>
      {version && status === 'connected' && (
        <span className="text-slate-600 hidden md:inline flex-shrink-0">v{version}</span>
      )}
    </div>
  )
}
