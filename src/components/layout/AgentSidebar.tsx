import type { FC } from 'react'
import { useMemo } from 'react'
import { Bot, ChevronRight, Circle, Cpu, AlertCircle, Clock, X, type LucideIcon } from 'lucide-react'
import { useStore } from '../../store'
import type { Agent, AgentStatus } from '../../types'
import { parseSessionKeyAgentId } from '../../types'
import { isGatewaySessionRowWorking } from '../../lib/gateway-session-status'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { t } from '../../i18n'

const statusCfg: Record<AgentStatus, { color: string; label: string; Icon: LucideIcon }> = {
  idle: { color: 'text-slate-400', label: t('agent.status.idle'), Icon: Circle },
  busy: { color: 'text-amber-400', label: t('agent.status.busy'), Icon: Cpu },
  error: { color: 'text-red-400', label: t('agent.status.error'), Icon: AlertCircle },
  offline: { color: 'text-slate-600', label: t('agent.status.offline'), Icon: Clock },
}

const AgentRow: FC<{ agent: Agent; isActive?: boolean; onClick?: () => void }> = ({
  agent,
  isActive,
  onClick,
}) => {
  const { color, label, Icon } = statusCfg[agent.status]
  const tierColor = agent.model.includes('opus')
    ? 'text-violet-400'
    : agent.model.includes('sonnet')
      ? 'text-indigo-400'
      : 'text-sky-400'

  return (
    <button type="button" onClick={onClick} className="w-full text-left">
      <div
        className={`w-full text-left px-3 py-2.5 rounded-xl transition-all group min-h-[44px] ${
          isActive ? 'bg-indigo-500/15 ring-1 ring-indigo-500/30' : 'hover:bg-white/5 active:bg-white/10'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isActive ? 'bg-indigo-500/20' : 'bg-white/5'
            }`}
          >
            <Bot size={15} className={isActive ? 'text-indigo-300' : 'text-slate-400'} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span
                className={`text-xs font-medium truncate ${isActive ? 'text-slate-200' : 'text-slate-300'}`}
              >
                {agent.name}
              </span>
              {agent.subAgents.length > 0 && (
                <span className="text-[10px] text-slate-600 font-mono">+{agent.subAgents.length}</span>
              )}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <Icon size={10} className={color} />
              <span className={`text-[10px] ${color}`}>{label}</span>
            </div>
            <div className={`text-[10px] ${tierColor} font-mono truncate max-w-[9.5rem] mt-0.5`}>
              {agent.model.replace('claude-', '').split('-').slice(0, 2).join('-')}
            </div>
          </div>
          <ChevronRight
            size={12}
            className={`text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0 ${
              isActive ? 'rotate-90' : ''
            }`}
          />
        </div>

        {isActive && agent.subAgents.length > 0 && (
          <div className="mt-2 ml-3 space-y-1 border-l border-indigo-500/20 pl-3">
            {agent.subAgents.map((sub) => {
              const subCfg = statusCfg[sub.status]
              return (
                <div key={sub.id} className="flex items-center gap-2 py-0.5">
                  <subCfg.Icon size={8} className={subCfg.color} />
                  <span className="text-[11px] text-slate-400 truncate">{sub.name}</span>
                  {sub.currentTask && (
                    <span className="text-[10px] text-slate-600 truncate">{sub.currentTask}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {agent.status === 'busy' && (
          <div className="mt-2 ml-0.5">
            <div className="h-0.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full shimmer"
                style={{ width: '60%' }}
              />
            </div>
          </div>
        )}
      </div>
    </button>
  )
}

function agentsWithDerivedStatus(
  agents: Agent[],
  sessions: Array<{ key: string; status?: string }>,
  pendingBySession: Record<string, string>,
): Agent[] {
  const busyIds = new Set<string>()
  for (const row of sessions) {
    if (pendingBySession[row.key] || isGatewaySessionRowWorking(row)) {
      const aid = parseSessionKeyAgentId(row.key)
      if (aid) busyIds.add(aid)
    }
  }
  return agents.map((a) => ({
    ...a,
    status: busyIds.has(a.id) ? ('busy' as const) : ('idle' as const),
  }))
}

export const AgentSidebar: FC = () => {
  const {
    agents,
    activeAgentId,
    setActiveAgent,
    setView,
    sidebarOpen,
    setSidebarOpen,
    openClawSessions,
    pendingChatBySession,
  } = useStore()

  const lgUp = useMediaQuery('(min-width: 1024px)')

  const agentsForUi = useMemo(
    () => agentsWithDerivedStatus(agents, openClawSessions, pendingChatBySession),
    [agents, openClawSessions, pendingChatBySession],
  )

  const closeOnNavigate = () => {
    if (!lgUp) setSidebarOpen(false)
  }

  if (lgUp && !sidebarOpen) return null

  const busyCount = agentsForUi.filter((a) => a.status === 'busy').length

  return (
    <>
      {!lgUp && sidebarOpen && (
        <button
          type="button"
          aria-label="Fermer le menu agents"
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px] animate-fade-in lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`flex flex-col overflow-hidden glass border-r border-white/5
          ${lgUp ? 'relative w-60 flex-shrink-0 h-full min-h-0' : ''}
          ${!lgUp ? 'fixed z-50 top-0 bottom-0 left-0 w-[min(19.5rem,calc(100vw-0.5rem))] max-w-[100vw] shadow-2xl transition-transform duration-200 ease-out h-full min-h-0 pt-[env(safe-area-inset-top,0px)]' : ''}
          ${!lgUp && !sidebarOpen ? '-translate-x-full pointer-events-none' : ''}
          ${!lgUp && sidebarOpen ? 'translate-x-0' : ''}
        `}
        aria-hidden={!lgUp && !sidebarOpen}
      >
        {!lgUp && (
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-white/5 flex-shrink-0">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              {t('agent.mobile.title')}
            </span>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {lgUp && (
          <div className="px-4 pt-4 pb-3 border-b border-white/5 flex-shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                {t('agent.mobile.title')}
              </span>
              <div className="flex items-center gap-1.5">
                {busyCount > 0 && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-400">
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                    {t('agent.summary.active', {
                      count: busyCount,
                      plural: busyCount > 1 ? 's' : '',
                    })}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {!lgUp && busyCount > 0 && (
          <div className="px-3 py-1.5 border-b border-white/5 flex-shrink-0">
            <span className="flex items-center gap-1 text-[10px] text-amber-400">
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
              {t('agent.summary.active', {
                count: busyCount,
                plural: busyCount > 1 ? 's' : '',
              })}
            </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1 min-h-0 overscroll-contain">
          {agentsForUi.map((agent) => (
            <AgentRow
              key={agent.id}
              agent={agent}
              isActive={agent.id === activeAgentId}
              onClick={() => {
                setActiveAgent(agent.id)
                closeOnNavigate()
              }}
            />
          ))}
        </div>

        <div className="p-3 border-t border-white/5 flex-shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
          <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 px-2 py-2">
            <div className="grid grid-cols-3 gap-1">
              {[
                { label: t('agent.summary.total'), value: agentsForUi.length },
                { label: t('agent.summary.actifs'), value: busyCount, highlight: busyCount > 0 },
                {
                  label: t('agent.summary.tasks'),
                  value: agentsForUi.reduce((acc, a) => acc + (a.tasksCompleted ?? 0), 0),
                },
              ].map(({ label, value, highlight }) => (
                <div
                  key={label}
                  className={`rounded-xl px-1.5 py-2 text-center transition-colors ${
                    highlight ? 'bg-amber-500/10 ring-1 ring-amber-500/20' : 'hover:bg-white/[0.04]'
                  }`}
                >
                  <div
                    className={`text-[15px] leading-5 font-semibold tabular-nums ${
                      highlight ? 'text-amber-300' : 'text-slate-100'
                    }`}
                  >
                    {value}
                  </div>
                  <div className={`mt-0.5 text-[10px] uppercase tracking-wider ${highlight ? 'text-amber-200/80' : 'text-slate-500'}`}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
