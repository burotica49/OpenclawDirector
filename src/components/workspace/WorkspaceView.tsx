import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Download,
  FileText,
  FolderOpen,
  Loader2,
  RefreshCw,
  Save,
  Search,
} from 'lucide-react'
import { useStore } from '../../store'
import {
  downloadTextFile,
  listWorkspaceFiles,
  readWorkspaceFile,
  writeWorkspaceFile,
} from '../../lib/workspace-tools'
import { t } from '../../i18n'

export const WorkspaceView: FC = () => {
  const { activeAgentId, agents, connectionStatus } = useStore()

  const agent = useMemo(
    () => agents.find((a) => a.id === activeAgentId) ?? null,
    [agents, activeAgentId],
  )

  const [files, setFiles] = useState<string[]>([])
  const [workspaceRoot, setWorkspaceRoot] = useState('')
  const [filter, setFilter] = useState('')
  const [loadingList, setLoadingList] = useState(false)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [editorContent, setEditorContent] = useState('')
  const [loadingFile, setLoadingFile] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)

  const loadSeqRef = useRef(0)
  const fileSeqRef = useRef(0)

  const loadList = useCallback(async () => {
    if (!activeAgentId || connectionStatus !== 'connected') {
      setListError('Sélectionnez un agent et connectez-vous à la gateway.')
      return
    }
    const seq = ++loadSeqRef.current
    setLoadingList(true)
    setListError(null)
    try {
      const { paths, workspaceRoot: root } = await listWorkspaceFiles(activeAgentId)
      if (seq !== loadSeqRef.current) return
      setFiles(paths)
      setWorkspaceRoot(root)
    } catch (e) {
      if (seq !== loadSeqRef.current) return
      const msg = e instanceof Error ? e.message : String(e)
      setListError(msg)
      setFiles([])
      setWorkspaceRoot('')
    } finally {
      if (seq === loadSeqRef.current) setLoadingList(false)
    }
  }, [activeAgentId, connectionStatus])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    loadSeqRef.current += 1
    fileSeqRef.current += 1
    setSelectedPath(null)
    setEditorContent('')
    setDirty(false)
    setError(null)
  }, [activeAgentId])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return files
    return files.filter((f) => f.toLowerCase().includes(q))
  }, [files, filter])

  const openFile = async (path: string) => {
    if (!activeAgentId) return
    const agentId = activeAgentId
    const seq = ++fileSeqRef.current
    setSelectedPath(path)
    setLoadingFile(true)
    setError(null)
    setDirty(false)
    try {
      const text = await readWorkspaceFile(agentId, path)
      if (seq !== fileSeqRef.current) return
      setEditorContent(text)
    } catch (e) {
      if (seq !== fileSeqRef.current) return
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setEditorContent('')
    } finally {
      if (seq === fileSeqRef.current) setLoadingFile(false)
    }
  }

  const handleSave = async () => {
    if (!activeAgentId || !selectedPath) return
    setSaving(true)
    setError(null)
    try {
      await writeWorkspaceFile(activeAgentId, selectedPath, editorContent)
      setDirty(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDownload = () => {
    if (!selectedPath) return
    downloadTextFile(selectedPath, editorContent)
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-3 sm:px-6 py-3 sm:py-4 flex-shrink-0 border-b border-white/5">
        <div className="flex items-center gap-2 min-w-0">
          <FolderOpen size={16} className="text-emerald-400 flex-shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-slate-200 truncate">{t('workspace.title')}</h1>
            <p className="text-[10px] text-slate-500 truncate font-mono" title={workspaceRoot}>
              {agent ? agent.name : t('workspace.no_agent')}
              {activeAgentId && <span className="text-slate-600"> · {activeAgentId}</span>}
              {workspaceRoot && (
                <>
                  <br />
                  <span className="text-slate-600">{workspaceRoot}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <button
            type="button"
            onClick={() => void loadList()}
            disabled={loadingList || connectionStatus !== 'connected' || !activeAgentId}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-40 min-h-[40px]"
          >
            {loadingList ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {t('workspace.refresh')}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-0 lg:gap-4 px-3 sm:px-6 pb-4 pt-2">
        <div className="flex flex-col w-full lg:w-[min(100%,320px)] lg:flex-shrink-0 min-h-[200px] lg:min-h-0 max-h-[40vh] lg:max-h-none rounded-2xl glass border border-white/10 overflow-hidden">
          <div className="p-2 border-b border-white/5">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t('workspace.filter_placeholder')}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/40"
              />
            </div>
          </div>
          {listError && (
            <p className="text-[11px] text-red-400/90 px-3 py-2 border-b border-white/5">{listError}</p>
          )}
          <div className="flex-1 overflow-y-auto overscroll-contain p-2 space-y-0.5">
            {filtered.length === 0 && !loadingList && (
              <p className="text-xs text-slate-600 px-2 py-4 text-center">{t('workspace.no_files')}</p>
            )}
            {filtered.map((path) => (
              <button
                key={path}
                type="button"
                onClick={() => void openFile(path)}
                className={`w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors min-h-[40px] ${
                  selectedPath === path
                    ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/25'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <FileText size={12} className="flex-shrink-0 opacity-70" />
                <span className="truncate font-mono">{path}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col rounded-2xl glass border border-white/10 overflow-hidden mt-3 lg:mt-0 min-h-[280px]">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-white/5 flex-shrink-0">
            <span className="text-[11px] text-slate-500 font-mono truncate flex-1 min-w-0">
              {selectedPath ?? t('workspace.select_file')}
            </span>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!selectedPath || loadingFile}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-40"
            >
              <Download size={12} />
              {t('workspace.download')}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!selectedPath || !dirty || saving || loadingFile}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-emerald-600/80 hover:bg-emerald-500 text-white disabled:opacity-40"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {t('workspace.save')}
            </button>
          </div>
          {error && (
            <p className="text-[11px] text-red-400/90 px-3 py-2 border-b border-white/5">{error}</p>
          )}
          <div className="flex-1 min-h-0 relative">
            {loadingFile && (
              <div className="absolute inset-0 flex items-center justify-center bg-surface-950/60 z-10">
                <Loader2 size={24} className="text-emerald-400 animate-spin" />
              </div>
            )}
            <textarea
              value={editorContent}
              onChange={(e) => {
                setEditorContent(e.target.value)
                setDirty(true)
              }}
              disabled={!selectedPath || loadingFile}
              spellCheck={false}
              className="w-full h-full min-h-[240px] lg:min-h-0 bg-transparent px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-600 resize-none focus:outline-none disabled:opacity-50"
              placeholder={t('workspace.file_content_placeholder')}
            />
          </div>
        </div>
      </div>

      <p className="px-3 sm:px-6 pb-3 text-[10px] text-slate-600 flex-shrink-0 leading-relaxed">
        RPC WebSocket : <code className="text-slate-500">agents.files.list</code>,{' '}
        <code className="text-slate-500">agents.files.get</code>,{' '}
        <code className="text-slate-500">agents.files.set</code> — fichiers gérés par la gateway (souvent les
        fichiers bootstrap / mémoire de l’agent), pas <code className="text-slate-500">exec</code>.
      </p>
    </div>
  )
}
