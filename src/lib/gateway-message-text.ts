/** Extrait du texte affichable depuis un message gateway / historique (blocs content). */
export function textFromGatewayContent(content: unknown): string {
  if (content == null) return ''
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  const parts: string[] = []
  for (const block of content) {
    if (!block || typeof block !== 'object') continue
    const o = block as Record<string, unknown>
    if (o.type === 'text' && typeof o.text === 'string') {
      parts.push(o.text)
    }
  }
  return parts.join('')
}

/** Message tel que renvoyé par chat.history (structure souple). */
export function textFromGatewayMessage(message: unknown): string {
  if (message == null) return ''
  if (typeof message === 'string') return message
  if (typeof message !== 'object') return ''
  const m = message as Record<string, unknown>
  if (typeof m.text === 'string') return m.text
  return textFromGatewayContent(m.content)
}
