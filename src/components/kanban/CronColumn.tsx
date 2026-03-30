import { type FC, useMemo, useState } from 'react'
import { Clock, Pencil, Plus, RefreshCcw, Trash2 } from 'lucide-react'
import { useStore } from '../../store'
import type { CronJob } from '../../types'
import { t } from '../../i18n'
import { CronJobModal } from './CronJobModal'

function fmtNextRun(v: CronJob['nextRunAt']): string | null {
  if (typeof v === 'number' && Number.isFinite(v)) return new Date(v).toLocaleString()
  if (typeof v === 'string' && v.trim()) {
    const d = new Date(v)
    if (!Number.isNaN(d.getTime())) return d.toLocaleString()
    return v
  }
  return null
}

function scheduleSummary(job: CronJob): string {
  const s = job.schedule
  if (s.kind === 'at') return `at ${s.at}`
  if (s.kind === 'every') return `every ${Math.round(s.everyMs / 60000)}m`
  return s.tz ? `${s.expr} (${s.tz})` : s.expr
}

interface Props {
  onCreate: () => void
}

export const CronColumn: FC<Props> = ({ onCreate }) => {
  const {
    agents,
    cronJobs,
    cronLoaded,
    activeAgentId,
    refreshCronJobs,
    removeCronJob,
    updateCronJob,
  } = useStore()

  const [editing, setEditing] = useState<CronJob | null>(null)

  const visibleCronJobs = useMemo(() => {
    if (!activeAgentId) return cronJobs
    return cronJobs.filter((j) => j.agentId === activeAgentId)
  }, [cronJobs, activeAgentId])

  const groups = useMemo(() => {
    const by = new Map<string, CronJob[]>()
    for (const j of visibleCronJobs) {
      const aid = j.agentId ?? '__default__'
      const arr = by.get(aid) ?? []
      arr.push(j)
      by.set(aid, arr)
    }
    const entries = [...by.entries()].map(([agentId, jobs]) => ({
      agentId,
      jobs: jobs.slice().sort((a, b) => a.name.localeCompare(b.name)),
    }))
    entries.sort((a, b) => a.agentId.localeCompare(b.agentId))
    return entries
  }, [visibleCronJobs])

  const agentName = (id: string) => {
    if (id === '__default__') return t('kanban.cron.default_agent')
    return agents.find((a) => a.id === id)?.name ?? id
  }

  const total = visibleCronJobs.length

  return (
    <>
      <div className="flex flex-col rounded-2xl glass w-full xl:min-w-[320px] xl:w-80 xl:flex-shrink-0 overflow-hidden transition-all duration-200 max-w-2xl xl:max-w-none mx-auto xl:mx-0">
        <div className="px-4 py-3.5 flex items-center gap-2 border-b border-white/5">
          <span className="w-2 h-2 rounded-full bg-fuchsia-400" />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            {t('kanban.cron.title')}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500 bg-white/5 px-1.5 py-0.5 rounded-md">
              {total}
            </span>
            <button
              onClick={() => void refreshCronJobs()}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 bg-white/5 hover:bg-white/10 transition-all"
              title={t('kanban.cron.refresh')}
            >
              <RefreshCcw size={14} className={!cronLoaded ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[100px] max-h-[min(55vh,420px)] xl:max-h-none xl:min-h-[120px]">
          {!cronLoaded && (
            <div className="flex items-center justify-center h-16 rounded-xl border border-dashed border-white/10">
              <span className="text-xs text-slate-600">{t('kanban.cron.loading')}</span>
            </div>
          )}

          {cronLoaded && total === 0 && (
            <div className="flex items-center justify-center h-16 rounded-xl border border-dashed border-white/10">
              <span className="text-xs text-slate-600">{t('kanban.cron.empty')}</span>
            </div>
          )}

          {cronLoaded &&
            groups.map((g) => (
              <div key={g.agentId} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="px-3 py-2 flex items-center gap-2 border-b border-white/10">
                  <span className="text-xs font-semibold text-slate-200 truncate">{agentName(g.agentId)}</span>
                  <span className="ml-auto text-[10px] font-mono text-slate-500 bg-black/20 px-1.5 py-0.5 rounded">
                    {g.jobs.length}
                  </span>
                </div>
                <div className="p-2 space-y-2">
                  {g.jobs.map((job) => {
                    const next = fmtNextRun(job.nextRunAt)
                    const isEnabled = job.enabled !== false
                    return (
                      <div
                        key={job.jobId}
                        className="rounded-lg bg-black/20 border border-white/10 px-2.5 py-2"
                      >
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-slate-200 truncate">{job.name}</span>
                              {!isEnabled && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-500">
                                  {t('kanban.cron.disabled')}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-[11px] text-slate-500 font-mono truncate">
                              {scheduleSummary(job)}
                            </div>
                            {next && (
                              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                                <Clock size={12} />
                                <span className="truncate">{t('kanban.cron.next', { at: next })}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => void updateCronJob(job.jobId, { enabled: !isEnabled })}
                              className="px-2 py-1 rounded-md text-[11px] bg-white/5 hover:bg-white/10 text-slate-200 transition-all"
                              title={isEnabled ? t('kanban.cron.disable') : t('kanban.cron.enable')}
                            >
                              {isEnabled ? t('kanban.cron.on') : t('kanban.cron.off')}
                            </button>
                            <button
                              onClick={() => setEditing(job)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 bg-white/5 hover:bg-white/10 transition-all"
                              title={t('kanban.cron.edit')}
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => void removeCronJob(job.jobId)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-red-300 bg-white/5 hover:bg-white/10 transition-all"
                              title={t('kanban.cron.delete')}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
        </div>

        <div className="p-3 border-t border-white/5">
          <button
            onClick={onCreate}
            className="w-full flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-300
                       hover:bg-white/5 transition-all group"
          >
            <Plus size={13} className="group-hover:text-fuchsia-400 transition-colors" />
            {t('kanban.cron.add_footer')}
          </button>
        </div>
      </div>

      {editing && <CronJobModal initial={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

