import { useEffect, useState } from 'react'
import { TopBar } from './components/layout/TopBar'
import { AgentSidebar } from './components/layout/AgentSidebar'
import { KanbanBoard } from './components/kanban/KanbanBoard'
import { ChatView } from './components/chat/ChatView'
import { WorkspaceView } from './components/workspace/WorkspaceView'
import { useStore } from './store'
import { AuthView } from './components/auth/AuthView'
import { isAppAuthed } from './lib/app-auth'
import { setAppAuthed } from './lib/app-auth'

export default function App() {
  const { initWS, disconnectWS, activeView, loadKanbanFromDb } = useStore()
  const [authed, setAuthed] = useState(() => isAppAuthed())

  useEffect(() => {
    if (!authed) return
    void loadKanbanFromDb()
    initWS()
    return () => disconnectWS()
  }, [authed, initWS, disconnectWS, loadKanbanFromDb])

  if (!authed) {
    return <AuthView onAuthed={() => setAuthed(true)} />
  }

  return (
    <div className="flex flex-col h-full min-h-0 flex-1 bg-surface-950">
      {/* Top navigation */}
      <TopBar
        onLogout={() => {
          setAppAuthed(false)
          setAuthed(false)
        }}
      />

      {/* Body */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Left sidebar — agents */}
        <AgentSidebar />

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-hidden">
          {activeView === 'kanban' ? (
            <KanbanBoard />
          ) : activeView === 'workspace' ? (
            <WorkspaceView />
          ) : (
            <ChatView />
          )}
        </main>
      </div>

      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-indigo-900/5 rounded-full blur-3xl" />
      </div>
    </div>
  )
}
