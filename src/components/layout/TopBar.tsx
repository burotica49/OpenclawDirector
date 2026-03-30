import type { FC } from 'react'
import { Kanban, MessageSquare, Menu, Bot, RefreshCw, FolderOpen, LogOut } from 'lucide-react'
import { useStore } from '../../store'
import { ConnectionStatus } from '../ui/ConnectionStatus'
import { openClawWS } from '../../services/websocket'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { t } from '../../i18n'

export const TopBar: FC<{ onLogout?: () => void }> = ({ onLogout }) => {
  const {
    activeView,
    setView,
    toggleSidebar,
    setSidebarOpen,
    connectionStatus,
    serverVersion,
  } = useStore()
  const lgUp = useMediaQuery('(min-width: 1024px)')

  const reconnect = () => {
    openClawWS.disconnect()
    setTimeout(() => openClawWS.connect(), 300)
  }

  const go = (view: 'kanban' | 'chat' | 'workspace') => {
    setView(view)
    if (!lgUp) setSidebarOpen(false)
  }

  return (
    <header className="min-h-14 flex items-center gap-2 sm:gap-3 md:gap-4 px-2 sm:px-4 border-b border-white/5 glass flex-shrink-0 z-20 pt-[max(0.25rem,env(safe-area-inset-top,0px))]">
      <button
        type="button"
        onClick={toggleSidebar}
        className="p-2.5 sm:p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center flex-shrink-0"
        aria-label="Menu agents"
      >
        <Menu size={18} />
      </button>

      <div className="flex items-center gap-1.5 sm:gap-2 mr-1 sm:mr-4 flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
          <Bot size={14} className="text-white" />
        </div>
        <span className="font-semibold text-sm text-slate-200 tracking-wide hidden sm:inline">
          OpenClaw DIRECTOR
        </span>
      </div>

      <nav className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={() => go('chat')}
          className={`flex items-center justify-center sm:justify-start gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-lg text-xs font-medium transition-all min-h-[40px] min-w-[40px] sm:min-w-0 sm:min-h-0 ${
            activeView === 'chat'
              ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
          aria-current={activeView === 'chat' ? 'page' : undefined}
        >
          <MessageSquare size={14} className="flex-shrink-0" />
          <span className="hidden md:inline">{t('topbar.chat')}</span>
        </button>
        <button
          type="button"
          onClick={() => go('kanban')}
          className={`flex items-center justify-center sm:justify-start gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-lg text-xs font-medium transition-all min-h-[40px] min-w-[40px] sm:min-w-0 sm:min-h-0 ${
            activeView === 'kanban'
              ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
          aria-current={activeView === 'kanban' ? 'page' : undefined}
        >
          <Kanban size={14} className="flex-shrink-0" />
          <span className="hidden md:inline">{t('topbar.kanban')}</span>
        </button>
        <button
          type="button"
          onClick={() => go('workspace')}
          className={`flex items-center justify-center sm:justify-start gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-lg text-xs font-medium transition-all min-h-[40px] min-w-[40px] sm:min-w-0 sm:min-h-0 ${
            activeView === 'workspace'
              ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
          aria-current={activeView === 'workspace' ? 'page' : undefined}
        >
          <FolderOpen size={14} className="flex-shrink-0" />
          <span className="hidden md:inline">{t('topbar.workspace')}</span>
        </button>
      </nav>

      <div className="flex-1 min-w-2" />

      <ConnectionStatus status={connectionStatus} version={serverVersion} />

      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          title={t('topbar.logout')}
          className="p-2 sm:p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 flex items-center justify-center flex-shrink-0"
          aria-label={t('topbar.logout')}
        >
          <LogOut size={14} />
        </button>
      )}

      {connectionStatus !== 'connected' && (
        <button
          type="button"
          onClick={reconnect}
          title="Reconnecter"
          className="p-2 sm:p-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-white/5 transition-colors min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 flex items-center justify-center flex-shrink-0"
          aria-label="Reconnecter"
        >
          <RefreshCw size={14} />
        </button>
      )}
    </header>
  )
}
