import { useMemo, useState, type FC } from 'react'
import { Lock, Zap } from 'lucide-react'
import { getExpectedAppToken, isAppAuthEnabled, setAppAuthed, validateAppToken } from '../../lib/app-auth'
import { t } from '../../i18n'

export const AuthView: FC<{ onAuthed?: () => void }> = ({ onAuthed }) => {
  const enabled = isAppAuthEnabled()
  const expectedHint = useMemo(() => {
    const t = getExpectedAppToken()
    if (!t) return null
    return `${t.slice(0, 3)}…${t.slice(-2)}`
  }, [])

  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (!enabled) {
      setAppAuthed(true)
      onAuthed?.()
      return
    }
    if (validateAppToken(token)) {
      setAppAuthed(true)
      onAuthed?.()
      return
    }
    setError(t('auth.error.invalid_token'))
  }

  return (
    <div className="min-h-dvh w-full bg-surface-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md glass border border-white/10 rounded-2xl shadow-2xl p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center">
            <Lock size={16} className="text-indigo-300" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-200 leading-tight">{t('auth.title')}</div>
            <div className="text-[11px] text-slate-500 leading-tight">
              {enabled ? t('auth.subtitle.enabled') : t('auth.subtitle.disabled')}
            </div>
          </div>
          <div className="flex-1" />
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-medium text-slate-400">{t('auth.token.label')}</label>
          <input
            value={token}
            onChange={(e) => {
              setToken(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
            placeholder={
              enabled ? t('auth.token.placeholder.enabled') : t('auth.token.placeholder.disabled')
            }
            className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            autoFocus
          />
          {enabled && expectedHint && (
            <div className="text-[10px] text-slate-600">
              {t('auth.token.hint', { hint: expectedHint })}
            </div>
          )}
          {error && <div className="text-[11px] text-red-300">{error}</div>}
        </div>

        <button
          type="button"
          onClick={submit}
          className="mt-4 w-full py-3 rounded-xl bg-indigo-500/25 text-indigo-100 font-medium text-sm hover:bg-indigo-500/35 transition-colors min-h-[48px]"
        >
          {t('auth.submit')}
        </button>

        <div className="mt-4 text-[10px] text-slate-600 leading-relaxed">
          {enabled ? t('auth.footer.enabled') : t('auth.footer.disabled')}
        </div>
      </div>
    </div>
  )
}

