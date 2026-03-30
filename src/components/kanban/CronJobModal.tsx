import { type FC, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useStore } from '../../store'
import type {
  CronDeliveryMode,
  CronJob,
  CronSchedule,
  CronSessionTarget,
  CronWakeMode,
} from '../../types'
import { parseSessionKeyAgentId } from '../../types'
import { t } from '../../i18n'

interface Props {
  initial?: Partial<CronJob>
  onClose: () => void
}

function toIsoLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`
}

export const CronJobModal: FC<Props> = ({ initial, onClose }) => {
  const { agents, addCronJob, updateCronJob, openClawSessions } = useStore()
  const isEdit = Boolean(initial?.jobId)

  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const defaultAgentId = agents[0]?.id ?? ''
  const [agentId, setAgentId] = useState<string>((initial?.agentId as string | undefined) ?? defaultAgentId)
  const [name, setName] = useState<string>(initial?.name ?? '')
  const [description, setDescription] = useState<string>(initial?.description ?? '')
  const [enabled, setEnabled] = useState<boolean>(initial?.enabled ?? true)
  const [wakeMode, setWakeMode] = useState<CronWakeMode>((initial?.wakeMode as CronWakeMode) ?? 'now')

  const initialScheduleKind =
    (initial?.schedule as CronSchedule | undefined)?.kind ?? 'cron'
  const [scheduleKind, setScheduleKind] = useState<CronSchedule['kind']>(initialScheduleKind)

  const [at, setAt] = useState<string>(() => {
    const s = initial?.schedule as CronSchedule | undefined
    if (s?.kind === 'at' && typeof s.at === 'string' && s.at) return toIsoLocalInputValue(new Date(s.at))
    return toIsoLocalInputValue(new Date(Date.now() + 60 * 60 * 1000))
  })
  const [expr, setExpr] = useState<string>(() => {
    const s = initial?.schedule as CronSchedule | undefined
    return s?.kind === 'cron' && typeof s.expr === 'string' ? s.expr : '0 9 * * *'
  })
  const [tz, setTz] = useState<string>(() => {
    const s = initial?.schedule as CronSchedule | undefined
    return s?.kind === 'cron' || s?.kind === 'at' ? (s.tz ?? '') : ''
  })
  const [everyMinutes, setEveryMinutes] = useState<number>(() => {
    const s = initial?.schedule as CronSchedule | undefined
    return s?.kind === 'every' ? Math.max(1, Math.round(s.everyMs / 60000)) : 60
  })

  const initialSessionTarget =
    (initial?.sessionTarget as CronSessionTarget | undefined) ??
    ((initial?.payload as any)?.kind === 'systemEvent' ? 'main' : 'isolated')
  const [sessionTarget, setSessionTarget] = useState<CronSessionTarget>(initialSessionTarget)

  const [systemText, setSystemText] = useState<string>(() => {
    const p = initial?.payload as any
    return p?.kind === 'systemEvent' ? String(p.text ?? '') : ''
  })
  const [message, setMessage] = useState<string>(() => {
    const p = initial?.payload as any
    return p?.kind === 'agentTurn' ? String(p.message ?? '') : ''
  })

  const [deliveryMode, setDeliveryMode] = useState<CronDeliveryMode>(() => {
    const m = (initial?.delivery as any)?.mode
    if (m === 'announce' || m === 'webhook' || m === 'none') return m
    return 'none'
  })
  const [deliveryChannel, setDeliveryChannel] = useState<string>(() => {
    const c = (initial?.delivery as any)?.channel
    return typeof c === 'string' ? c : 'last'
  })
  const [deliveryTo, setDeliveryTo] = useState<string>(() => {
    const to = (initial?.delivery as any)?.to
    return typeof to === 'string' ? to : ''
  })
  const [webhookUrl, setWebhookUrl] = useState<string>(() => {
    const to = (initial?.delivery as any)?.to
    return typeof to === 'string' ? to : ''
  })

  const inferRouteFromSessionKey = (key: string): { channel: string; to: string } | null => {
    const parts = key.split(':')
    if (parts[0] !== 'agent') return null
    if (parts.length < 5) return null
    const channel = parts[2]
    if (!channel || channel === 'main') return null
    if (channel === 'cron' || channel === 'hook' || channel === 'node') return null
    const kind = parts[3]
    const id = parts[4]
    if (!kind || !id) return null
    const rest = parts.slice(5)
    const suffix = rest.length ? `:${rest.join(':')}` : ''

    // Telegram delivery expects raw chatId (optionally + :topic:..)
    if (channel === 'telegram' && kind === 'group') {
      return { channel, to: `${id}${suffix}` }
    }
    return { channel, to: `${kind}:${id}${suffix}` }
  }

  useEffect(() => {
    if (deliveryMode !== 'announce') return
    // Ne pas écraser les valeurs si l’utilisateur a déjà précisé une cible.
    if ((deliveryChannel ?? '').trim() !== 'last') return
    if ((deliveryTo ?? '').trim()) return

    const sessionsForAgent = openClawSessions
      .filter((s) => parseSessionKeyAgentId(s.key) === agentId)
      .slice()
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))

    for (const s of sessionsForAgent) {
      const r = inferRouteFromSessionKey(s.key)
      if (!r) continue
      setDeliveryChannel(r.channel)
      setDeliveryTo(r.to)
      break
    }
  }, [deliveryMode, deliveryChannel, deliveryTo, openClawSessions, agentId])

  const schedule: CronSchedule = useMemo(() => {
    if (scheduleKind === 'at') {
      const iso = new Date(at).toISOString()
      return { kind: 'at', at: iso, ...(tz.trim() ? { tz: tz.trim() } : {}) }
    }
    if (scheduleKind === 'every') {
      return { kind: 'every', everyMs: Math.max(1, everyMinutes) * 60_000 }
    }
    return { kind: 'cron', expr: expr.trim(), ...(tz.trim() ? { tz: tz.trim() } : {}) }
  }, [scheduleKind, at, tz, everyMinutes, expr])

  const payload = useMemo(() => {
    if (sessionTarget === 'main') {
      return { kind: 'systemEvent' as const, text: systemText.trim() }
    }
    return { kind: 'agentTurn' as const, message: message.trim(), lightContext: true }
  }, [sessionTarget, systemText, message])

  const delivery = useMemo(() => {
    if (deliveryMode === 'none') return { mode: 'none' as const }
    if (deliveryMode === 'webhook') return { mode: 'webhook' as const, to: webhookUrl.trim() }
    return {
      mode: 'announce' as const,
      channel: deliveryChannel.trim() || 'last',
      ...(deliveryTo.trim() ? { to: deliveryTo.trim() } : {}),
      bestEffort: true,
    }
  }, [deliveryMode, deliveryChannel, deliveryTo, webhookUrl])

  const canSubmit = useMemo(() => {
    if (!name.trim()) return false
    if (scheduleKind === 'cron' && !expr.trim()) return false
    if (sessionTarget === 'main' && !systemText.trim()) return false
    if (sessionTarget !== 'main' && !message.trim()) return false
    if (deliveryMode === 'webhook' && !webhookUrl.trim()) return false
    return true
  }, [name, scheduleKind, expr, sessionTarget, systemText, message, deliveryMode, webhookUrl])

  const handleSubmit = async () => {
    if (!canSubmit) return
    const base = {
      name: name.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
      agentId: agentId || undefined,
      enabled,
      schedule,
      sessionTarget,
      wakeMode,
      payload,
      delivery,
    }

    if (isEdit && initial?.jobId) {
      await updateCronJob(initial.jobId, base as Partial<CronJob>)
      onClose()
      return
    }
    await addCronJob(base as Omit<CronJob, 'jobId'>)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="glass rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 w-full sm:max-w-md max-h-[92dvh] overflow-y-auto overscroll-contain shadow-2xl animate-slide-in gradient-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-slate-200">
            {isEdit ? t('kanban.cron.edit') : t('kanban.cron.add')}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              {t('kanban.cron.name')} <span className="text-red-400">*</span>
            </label>
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleSubmit()}
              placeholder={t('kanban.cron.name_placeholder')}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600
                         focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">{t('kanban.cron.agent')}</label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200
                         focus:outline-none focus:border-indigo-500/50 transition-all"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">{t('kanban.cron.description')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('kanban.cron.description_placeholder')}
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600
                         focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">{t('kanban.cron.session')}</label>
              <select
                value={sessionTarget}
                onChange={(e) => setSessionTarget(e.target.value as CronSessionTarget)}
                className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200
                           focus:outline-none focus:border-indigo-500/50 transition-all"
              >
                <option value="isolated">{t('kanban.cron.session_isolated')}</option>
                <option value="main">{t('kanban.cron.session_main')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">{t('kanban.cron.wake')}</label>
              <select
                value={wakeMode}
                onChange={(e) => setWakeMode(e.target.value as CronWakeMode)}
                className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200
                           focus:outline-none focus:border-indigo-500/50 transition-all"
              >
                <option value="now">{t('kanban.cron.wake_now')}</option>
                <option value="next-heartbeat">{t('kanban.cron.wake_next')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">{t('kanban.cron.schedule')}</label>
              <select
                value={scheduleKind}
                onChange={(e) => setScheduleKind(e.target.value as CronSchedule['kind'])}
                className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200
                           focus:outline-none focus:border-indigo-500/50 transition-all"
              >
                <option value="cron">{t('kanban.cron.schedule_cron')}</option>
                <option value="at">{t('kanban.cron.schedule_at')}</option>
                <option value="every">{t('kanban.cron.schedule_every')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">{t('kanban.cron.tz')}</label>
              <input
                value={tz}
                onChange={(e) => setTz(e.target.value)}
                placeholder={t('kanban.cron.tz_placeholder')}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600
                           focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
              />
            </div>
          </div>

          {scheduleKind === 'cron' && (
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                {t('kanban.cron.expr')} <span className="text-red-400">*</span>
              </label>
              <input
                value={expr}
                onChange={(e) => setExpr(e.target.value)}
                placeholder="0 9 * * *"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600
                           focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all font-mono"
              />
            </div>
          )}

          {scheduleKind === 'at' && (
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                {t('kanban.cron.at')} <span className="text-red-400">*</span>
              </label>
              <input
                type="datetime-local"
                value={at}
                onChange={(e) => setAt(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600
                           focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
              />
            </div>
          )}

          {scheduleKind === 'every' && (
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                {t('kanban.cron.every_minutes')} <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min={1}
                value={everyMinutes}
                onChange={(e) => setEveryMinutes(Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600
                           focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
              />
            </div>
          )}

          {sessionTarget === 'main' ? (
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                {t('kanban.cron.system_event')} <span className="text-red-400">*</span>
              </label>
              <textarea
                value={systemText}
                onChange={(e) => setSystemText(e.target.value)}
                placeholder={t('kanban.cron.system_event_placeholder')}
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600
                           focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all resize-none"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                {t('kanban.cron.message')} <span className="text-red-400">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('kanban.cron.message_placeholder')}
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600
                           focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all resize-none"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">{t('kanban.cron.delivery')}</label>
              <select
                value={deliveryMode}
                onChange={(e) => setDeliveryMode(e.target.value as CronDeliveryMode)}
                className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200
                           focus:outline-none focus:border-indigo-500/50 transition-all"
              >
                <option value="none">{t('kanban.cron.delivery_none')}</option>
                <option value="announce">{t('kanban.cron.delivery_announce')}</option>
                <option value="webhook">{t('kanban.cron.delivery_webhook')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">{t('kanban.cron.enabled')}</label>
              <select
                value={enabled ? 'on' : 'off'}
                onChange={(e) => setEnabled(e.target.value === 'on')}
                className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200
                           focus:outline-none focus:border-indigo-500/50 transition-all"
              >
                <option value="on">{t('kanban.cron.enabled_on')}</option>
                <option value="off">{t('kanban.cron.enabled_off')}</option>
              </select>
            </div>
          </div>

          {deliveryMode === 'announce' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">{t('kanban.cron.delivery_channel')}</label>
                <input
                  value={deliveryChannel}
                  onChange={(e) => setDeliveryChannel(e.target.value)}
                  placeholder="last"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600
                             focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">{t('kanban.cron.delivery_to')}</label>
                <input
                  value={deliveryTo}
                  onChange={(e) => setDeliveryTo(e.target.value)}
                  placeholder={t('kanban.cron.delivery_to_placeholder')}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600
                             focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                />
              </div>
            </div>
          )}

          {deliveryMode === 'webhook' && (
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">{t('kanban.cron.webhook')}</label>
              <input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://example.com/webhook"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600
                           focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 transition-all"
          >
            {t('kanban.cron.cancel')}
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium
                       bg-indigo-500 hover:bg-indigo-400 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={13} />
            {isEdit ? t('kanban.cron.save') : t('kanban.cron.create')}
          </button>
        </div>
      </div>
    </div>
  )
}

