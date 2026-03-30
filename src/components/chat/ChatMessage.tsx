import type { FC } from 'react'
import ReactMarkdown from 'react-markdown'
import { Bot, User, Loader2 } from 'lucide-react'
import type { ChatMessage as CM } from '../../types'

interface Props { message: CM }

export const ChatMessage: FC<Props> = ({ message }) => {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 animate-fade-in ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
        isUser ? 'bg-indigo-500/20' : 'bg-white/5'
      }`}>
        {isUser
          ? <User size={13} className="text-indigo-300" />
          : <Bot  size={13} className="text-slate-400"  />
        }
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[min(92%,28rem)] sm:max-w-[78%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1 min-w-0`}
      >
        <div
          className={`rounded-2xl px-3.5 sm:px-4 py-2.5 text-sm leading-relaxed break-words [overflow-wrap:anywhere] ${
          isUser
            ? 'bg-indigo-500/20 text-slate-200 rounded-tr-sm'
            : 'bg-white/5 text-slate-300 rounded-tl-sm'
        }`}>
          {message.role === 'assistant' ? (
            <div className="prose-chat">
              <ReactMarkdown>{message.content || ' '}</ReactMarkdown>
              {message.streaming && (
                <span className="inline-flex items-center gap-1 ml-1 text-slate-500">
                  <Loader2 size={10} className="animate-spin" />
                </span>
              )}
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
        <span className="text-[10px] text-slate-600 px-1">
          {new Date(message.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          {message.model && !isUser && (
            <> · <span className="text-slate-500">{message.model.replace('claude-', '')}</span></>
          )}
        </span>
      </div>
    </div>
  )
}
