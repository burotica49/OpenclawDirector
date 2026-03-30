import { type FC, useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Send, Bot, MessageSquarePlus, Trash2, RefreshCw, Loader2, List } from 'lucide-react'
import { useStore } from '../../store'
import { ChatMessage } from './ChatMessage'
import { ModelSelector } from './ModelSelector'
import { parseSessionKeyAgentId } from '../../types'
import { isSessionBusy } from '../../lib/gateway-session-status'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { t } from '../../i18n'

function sessionTitle(row: {
  key: string
  displayName?: string
  derivedTitle?: string
  label?: string
  lastMessagePreview?: string
}) {
  return (
    row.displayName?.trim() ||
    row.derivedTitle?.trim() ||
    row.label?.trim() ||
    row.key.slice(0, 28) + (row.key.length > 28 ? '…' : '')
  )
}

export const ChatView: FC = () => {
  const {
    agents,
    activeAgentId,
    openClawSessions,
    activeSessionKey,
    gatewayModels,
    chatMessagesBySession,
    selectedModel,
    setSelectedModel,
    setActiveSessionKey,
    createOpenClawSession,
    refreshOpenClawSessions,
    loadSessionHistory,
    sendChatMessage,
    connectionStatus,
    pendingChatBySession,
  } = useStore()

  const lgUp = useMediaQuery('(min-width: 1024px)')
  const [sessionsSheetOpen, setSessionsSheetOpen] = useState(false)

  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const filteredSessions = useMemo(() => {
    if (!activeAgentId) return openClawSessions
    const matched = openClawSessions.filter(
      (s) => parseSessionKeyAgentId(s.key) === activeAgentId,
    )
    return matched.length > 0 ? matched : openClawSessions
  }, [openClawSessions, activeAgentId])

  const activeRow = openClawSessions.find((s) => s.key === activeSessionKey)
  const agentForSession = activeSessionKey
    ? agents.find((a) => a.id === parseSessionKeyAgentId(activeSessionKey)) ?? agents[0]
    : agents[0]

  const messages = activeSessionKey ? chatMessagesBySession[activeSessionKey] ?? [] : []

  const activeSessionWorking = useMemo(() => {
    if (!activeSessionKey) return false
    const row = openClawSessions.find((s) => s.key === activeSessionKey)
    if (row && isSessionBusy(row, pendingChatBySession)) return true
    if (!row && pendingChatBySession[activeSessionKey]) return true
    return messages.some((m) => m.role === 'assistant' && m.streaming)
  }, [activeSessionKey, openClawSessions, pendingChatBySession, messages])

  const sessionRowAppearsWorking = useCallback(
    (rowKey: string) => {
      const row = openClawSessions.find((s) => s.key === rowKey)
      const localMsgs = chatMessagesBySession[rowKey] ?? []
      if (localMsgs.some((m) => m.role === 'assistant' && m.streaming)) return true
      if (row) return isSessionBusy(row, pendingChatBySession)
      return Boolean(pendingChatBySession[rowKey])
    },
    [openClawSessions, chatMessagesBySession, pendingChatBySession],
  )

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const pickSession = async (key: string) => {
    await setActiveSessionKey(key)
    if (!lgUp) setSessionsSheetOpen(false)
  }

  const handleSend = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || !activeSessionKey) return
    setInput('')
    sendChatMessage(trimmed)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }, [input, activeSessionKey, sendChatMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const reloadHistory = () => {
    if (activeSessionKey) void loadSessionHistory(activeSessionKey)
  }

  const clearLocalView = () => {
    if (!activeSessionKey) return
    useStore.setState((state) => ({
      chatMessagesBySession: { ...state.chatMessagesBySession, [activeSessionKey]: [] },
    }))
  }

  const sessionsPanel = (opts: { mobileSheet?: boolean }) => (
    <div
      className={`flex flex-col overflow-hidden bg-surface-950/95 lg:bg-transparent min-h-0
        ${opts.mobileSheet ? 'h-full max-h-[min(70dvh,520px)]' : 'h-full'}
      `}
    >
      <div className="px-3 pt-3 pb-2 border-b border-white/5 space-y-2 flex-shrink-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Sessions
          </span>
            <button
              type="button"
              title={t('chat.sessions.refresh_title')}
            onClick={() => void refreshOpenClawSessions()}
            className="p-2 rounded-md text-slate-600 hover:text-slate-300 hover:bg-white/5 min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <RefreshCw size={12} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => void createOpenClawSession(activeAgentId ?? undefined)}
          disabled={connectionStatus !== 'connected'}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 sm:py-1.5 rounded-lg text-[11px] font-medium
            bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/30 transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] sm:min-h-0"
        >
          <MessageSquarePlus size={12} />
          {t('chat.sessions.new')}
        </button>
        {activeAgentId && (
          <p className="text-[9px] text-slate-600 leading-tight">
            {t('chat.sessions.filter_agent')}{' '}
            <span className="text-slate-500">{agents.find((a) => a.id === activeAgentId)?.name}</span>
          </p>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0 overscroll-contain">
        {filteredSessions.length === 0 ? (
          <p className="text-[11px] text-slate-600 px-1 py-2 text-center">
            {connectionStatus === 'connected'
              ? t('chat.sessions.empty.connected')
              : t('chat.sessions.empty.disconnected')}
          </p>
        ) : (
          filteredSessions.map((row) => {
            const isActive = row.key === activeSessionKey
            return (
              <button
                type="button"
                key={row.key}
                onClick={() => void pickSession(row.key)}
                className={`w-full flex flex-col gap-0.5 px-2.5 py-2.5 rounded-lg text-left transition-all min-h-[44px] ${
                  isActive ? 'bg-indigo-500/15 ring-1 ring-indigo-500/25' : 'hover:bg-white/5 active:bg-white/10'
                }`}
              >
                <div
                  className={`text-[11px] font-medium truncate ${isActive ? 'text-slate-200' : 'text-slate-400'}`}
                >
                  {sessionTitle(row)}
                </div>
                {row.lastMessagePreview && (
                  <div className="text-[9px] text-slate-600 truncate">{row.lastMessagePreview}</div>
                )}
                {row.model && (
                  <div className="text-[9px] text-slate-700 font-mono truncate">{row.model}</div>
                )}
                {sessionRowAppearsWorking(row.key) && (
                  <div className="flex items-center gap-1 text-amber-400/95 mt-0.5">
                    <Loader2 size={10} className="animate-spin flex-shrink-0" />
                    <span className="text-[9px] font-medium">{t('chat.sessions.working')}</span>
                  </div>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-full min-h-0 overflow-hidden flex-col lg:flex-row">
      <div className="hidden lg:flex w-56 flex-shrink-0 border-r border-white/5 flex-col overflow-hidden h-full min-h-0">
        {sessionsPanel({})}
      </div>

      {!lgUp && sessionsSheetOpen && (
        <button
          type="button"
          aria-label="Fermer la liste des sessions"
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[1px] lg:hidden"
          onClick={() => setSessionsSheetOpen(false)}
        />
      )}

      {!lgUp && (
        <div
          className={`fixed z-40 left-0 right-0 bottom-0 rounded-t-2xl border border-white/10 border-b-0 glass shadow-2xl
            transition-transform duration-200 ease-out lg:hidden
            max-h-[min(75dvh,560px)] flex flex-col
            pb-[env(safe-area-inset-bottom,0px)]
            ${sessionsSheetOpen ? 'translate-y-0' : 'translate-y-full'}
          `}
          style={{ pointerEvents: sessionsSheetOpen ? 'auto' : 'none' }}
        >
          <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>
          <div className="flex items-center justify-between px-3 pb-2 border-b border-white/5 flex-shrink-0">
            <span className="text-xs font-semibold text-slate-300">Sessions</span>
            <button
              type="button"
              onClick={() => setSessionsSheetOpen(false)}
              className="text-xs text-indigo-300 px-2 py-1 rounded-lg hover:bg-white/5"
            >
              Fermer
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">{sessionsPanel({ mobileSheet: true })}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-h-0 min-w-0">
        {activeSessionKey && agentForSession ? (
          <>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 border-b border-white/5 flex-shrink-0">
              {!lgUp && (
                <button
                  type="button"
                  onClick={() => setSessionsSheetOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-white/5 text-slate-300 text-xs min-h-[40px] hover:bg-white/10"
                >
                  <List size={14} />
                  {t('chat.mobile.sessions')}
                  {filteredSessions.length > 0 && (
                    <span className="text-[10px] bg-indigo-500/30 px-1.5 py-0.5 rounded-md">
                      {filteredSessions.length}
                    </span>
                  )}
                </button>
              )}
              <div className="w-8 h-8 rounded-xl bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
                <Bot size={15} className="text-indigo-300" />
              </div>
              <div className="min-w-0 flex-1 basis-[8rem]">
                <div className="text-sm font-medium text-slate-200 truncate">
                  {activeRow ? sessionTitle(activeRow) : activeSessionKey}
                </div>
                <div className="text-[10px] text-slate-500 truncate hidden sm:block">
                  {agentForSession.name} ·{' '}
                  <span className="font-mono opacity-70">{activeSessionKey}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                <ModelSelector
                  value={selectedModel}
                  models={gatewayModels}
                  onChange={setSelectedModel}
                />
                <button
                  type="button"
                  title="Recharger l’historique depuis la gateway"
                  onClick={reloadHistory}
                  className="p-2 sm:p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-colors min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
                >
                  <RefreshCw size={13} />
                </button>
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={clearLocalView}
                    title="Effacer l’affichage local (ne supprime pas la session)"
                    className="p-2 sm:p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-white/5 transition-colors min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>

            {activeSessionWorking && (
              <div className="flex items-center gap-2 px-3 sm:px-5 py-2 flex-shrink-0 bg-amber-500/10 border-b border-amber-500/15 text-amber-100/95 text-[11px] sm:text-xs">
                <Loader2 size={14} className="animate-spin flex-shrink-0 text-amber-300" />
                <span className="leading-snug">
                  {t('chat.session.working_banner')}
                </span>
              </div>
            )}

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto overflow-x-hidden px-3 sm:px-5 py-3 sm:py-4 space-y-3 sm:space-y-4 min-h-0 overscroll-contain"
            >
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[12rem] h-full gap-3 text-center px-2">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                    <MessageSquarePlus size={22} className="text-indigo-400" />
                  </div>
                  <p className="text-sm text-slate-400">
                    {t('chat.empty.hint')}
                  </p>
                  <p className="text-xs text-slate-600">Shift+Entrée pour un saut de ligne</p>
                </div>
              ) : (
                messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
              )}
            </div>

            <div className="px-3 sm:px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] flex-shrink-0 border-t border-white/5">
              <div className="flex items-end gap-2 sm:gap-3 glass rounded-2xl p-3">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message (session OpenClaw)…"
                  rows={1}
                  disabled={connectionStatus !== 'connected'}
                  className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 resize-none
                    focus:outline-none max-h-32 overflow-y-auto leading-relaxed
                    disabled:opacity-50 min-h-[44px] sm:min-h-[24px]"
                  style={{ height: 'auto', minHeight: '24px' }}
                  onInput={(e) => {
                    const t = e.currentTarget
                    t.style.height = 'auto'
                    t.style.height = `${Math.min(t.scrollHeight, 128)}px`
                  }}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim() || connectionStatus !== 'connected'}
                  className="w-10 h-10 sm:w-8 sm:h-8 rounded-xl bg-indigo-500 hover:bg-indigo-400 flex items-center justify-center
                    transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                >
                  <Send size={13} className="text-white" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center space-y-3 max-w-sm">
              <Bot size={32} className="text-slate-700 mx-auto" />
              <p className="text-sm text-slate-500">
                {!lgUp ? (
                  <>
                    Ouvrez <strong className="text-slate-400">Sessions</strong> pour choisir une conversation ou en
                    créer une.
                  </>
                ) : (
                  <>
                    Choisissez une session dans la liste ou créez-en une (
                    <code className="text-[11px] text-slate-600">chat.send</code>).
                  </>
                )}
              </p>
              {!lgUp && (
                <button
                  type="button"
                  onClick={() => setSessionsSheetOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-indigo-500/20 text-indigo-200 text-sm font-medium hover:bg-indigo-500/30 min-h-[48px]"
                >
                  <List size={16} />
                  Voir les sessions
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
