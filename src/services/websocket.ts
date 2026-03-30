import type { WsInMessage, WsOutMessage } from '../types'
import { buildDeviceAuthPayload } from '../lib/device-auth'
import { loadOrCreateDeviceIdentity, signDevicePayload } from '../lib/device-identity'

type MessageHandler = (msg: WsInMessage) => void
type StatusHandler = (status: 'disconnected' | 'connecting' | 'connected' | 'error') => void

type GatewayRes = {
  type: 'res'
  id: string
  ok: boolean
  payload?: unknown
  error?: { code: string; message: string; details?: unknown }
}

type GatewayEvent = {
  type: 'event'
  event: string
  payload?: unknown
}

const OPERATOR_SCOPES = [
  'operator.admin',
  'operator.read',
  'operator.write',
  'operator.approvals',
  'operator.pairing',
] as const

function randomUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `gw_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

class OpenClawWS {
  private ws: WebSocket | null = null
  private url: string
  private token: string
  private messageHandlers: Set<MessageHandler> = new Set()
  private statusHandlers: Set<StatusHandler> = new Set()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = 2000
  private maxReconnectDelay = 30000
  private shouldReconnect = true
  private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>()
  private connectSent = false
  private connectNonce: string | null = null
  private challengeTimer: ReturnType<typeof setTimeout> | null = null
  private readonly challengeTimeoutMs = 20000
  /** Prêt pour `agents.list` / `chat.send` après `hello-ok`. */
  private authenticated = false

  constructor(url: string, token: string) {
    this.url = url
    this.token = token
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return
    this.shouldReconnect = true
    this._connect()
  }

  private _clearChallengeTimer() {
    if (this.challengeTimer) {
      clearTimeout(this.challengeTimer)
      this.challengeTimer = null
    }
  }

  private _connect() {
    this.authenticated = false
    this._clearChallengeTimer()
    this.connectSent = false
    this.connectNonce = null
    this._setStatus('connecting')
    try {
      this.ws = new WebSocket(this.url)
    } catch {
      this._setStatus('error')
      this._scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      this.reconnectDelay = 2000
      this.challengeTimer = setTimeout(() => {
        this.challengeTimer = null
        if (!this.connectSent) {
          console.error('[OpenClaw] Pas de connect.challenge reçu à temps')
          this._setStatus('error')
          this.ws?.close()
        }
      }, this.challengeTimeoutMs)
    }

    this.ws.onmessage = (event) => {
      void this._handleRawMessage(String(event.data ?? ''))
    }

    this.ws.onerror = () => {
      this._setStatus('error')
    }

    this.ws.onclose = () => {
      this._clearChallengeTimer()
      if (this.shouldReconnect) {
        this._setStatus('disconnected')
        this._scheduleReconnect()
      }
    }
  }

  private async _handleRawMessage(raw: string) {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return
    }

    const frame = parsed as { type?: unknown }
    if (frame.type === 'event') {
      const evt = parsed as GatewayEvent
      if (evt.event === 'connect.challenge') {
        const nonce = (evt.payload as { nonce?: unknown } | undefined)?.nonce
        if (typeof nonce === 'string' && !this.connectSent) {
          this.connectNonce = nonce
          this._clearChallengeTimer()
          await this._sendConnect()
        }
        return
      }
      if (evt.event === 'chat') {
        const p = (evt.payload ?? {}) as Record<string, unknown>
        this._emitLegacy({
          type: 'gateway_chat',
          runId: String(p.runId ?? ''),
          sessionKey: String(p.sessionKey ?? ''),
          seq: typeof p.seq === 'number' ? p.seq : Number(p.seq ?? 0),
          state:
            p.state === 'delta' ||
            p.state === 'final' ||
            p.state === 'aborted' ||
            p.state === 'error'
              ? p.state
              : 'final',
          message: p.message,
          errorMessage: typeof p.errorMessage === 'string' ? p.errorMessage : undefined,
        })
        return
      }
      if (evt.event === 'sessions.changed') {
        this._emitLegacy({ type: 'sessions_changed', payload: evt.payload })
        return
      }
      this._maybeDispatchLegacyEvent(evt)
      return
    }

    if (frame.type === 'res') {
      const res = parsed as GatewayRes
      const pending = this.pending.get(res.id)
      if (pending) {
        this.pending.delete(res.id)
        if (res.ok) {
          pending.resolve(res.payload)
        } else {
          pending.reject(
            new Error(res.error?.message ?? res.error?.code ?? 'gateway request failed'),
          )
        }
      }
      return
    }

    this._maybeDispatchLegacyPayload(parsed)
  }

  /** Passe des frames « event » vers les handlers si le payload ressemble au proto simplifié du GUI. */
  private _maybeDispatchLegacyEvent(evt: GatewayEvent) {
    const p = evt.payload as Record<string, unknown> | undefined
    if (!p || typeof p !== 'object') return

    if (evt.event === 'agent.status' && Array.isArray(p.agents)) {
      this._emitLegacy({ type: 'agent_status', agents: p.agents } as WsInMessage)
      return
    }
    if (evt.event === 'task.update' && p.task && typeof p.task === 'object') {
      this._emitLegacy({ type: 'task_update', task: p.task } as WsInMessage)
    }
  }

  private _maybeDispatchLegacyPayload(parsed: unknown) {
    const msg = parsed as { type?: string }
    if (
      msg &&
      typeof msg === 'object' &&
      typeof msg.type === 'string' &&
      [
        'connected',
        'agent_status',
        'task_update',
        'chat_response',
        'error',
        'gateway_chat',
        'sessions_changed',
      ].includes(msg.type)
    ) {
      this._emitLegacy(parsed as WsInMessage)
    }
  }

  private _emitLegacy(msg: WsInMessage) {
    this.messageHandlers.forEach((h) => h(msg))
  }

  private async _sendConnect() {
    if (this.connectSent || !this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.connectSent = true

    const token = this.token.trim()
    const role = 'operator'
    const scopes = [...OPERATOR_SCOPES]
    const client = {
      id: 'openclaw-control-ui',
      version: '1.0.0',
      platform: typeof navigator !== 'undefined' ? navigator.platform : 'web',
      mode: 'webchat',
    }

    let device:
      | {
          id: string
          publicKey: string
          signature: string
          signedAt: number
          nonce: string
        }
      | undefined

    const deviceIdentity = await loadOrCreateDeviceIdentity()
    const nonce = this.connectNonce ?? ''
    const signedAtMs = Date.now()

    if (deviceIdentity) {
      const payload = buildDeviceAuthPayload({
        deviceId: deviceIdentity.deviceId,
        clientId: client.id,
        clientMode: client.mode,
        role,
        scopes,
        signedAtMs,
        token: token || null,
        nonce,
      })
      const signature = await signDevicePayload(deviceIdentity.privateKey, payload)
      device = {
        id: deviceIdentity.deviceId,
        publicKey: deviceIdentity.publicKey,
        signature,
        signedAt: signedAtMs,
        nonce,
      }
    }

    const params = {
      minProtocol: 3,
      maxProtocol: 3,
      client,
      role,
      scopes,
      device,
      caps: ['tool-events'],
      auth: token ? { token } : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'openclaw-gui/1.0.0',
      locale: typeof navigator !== 'undefined' ? navigator.language : 'en-US',
    }

    try {
      const payload = await this._doRequest<unknown>('connect', params)
      this._onHelloOk(payload)
    } catch (e) {
      console.error('[OpenClaw] Échec connect:', e)
      this._setStatus('error')
      this.connectSent = false
      this.ws?.close()
    }
  }

  private _onHelloOk(payload: unknown) {
    const hello = payload as {
      type?: string
      server?: { version?: string }
      auth?: { role?: string }
    }
    if (hello?.type !== 'hello-ok') {
      console.warn('[OpenClaw] Réponse connect inattendue:', hello)
    }
    this.authenticated = true
    this._setStatus('connected')
    const synthetic: WsInMessage = {
      type: 'connected',
      token_valid: true,
      server_version: hello.server?.version,
    }
    this.messageHandlers.forEach((h) => h(synthetic))
  }

  private _doRequest<T>(method: string, params: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('WebSocket fermé'))
    }
    const id = randomUuid()
    const frame = { type: 'req', id, method, params }
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
      })
      this.ws!.send(JSON.stringify(frame))
    })
  }

  /** Appels RPC gateway (`agents.list`, `chat.send`, …) — après connexion. */
  request<T>(method: string, params?: unknown): Promise<T> {
    if (!this.authenticated) {
      return Promise.reject(new Error('Gateway non connecté'))
    }
    return this._doRequest<T>(method, params ?? {})
  }

  disconnect() {
    this.authenticated = false
    this.shouldReconnect = false
    this._clearChallengeTimer()
    this.pending.forEach(({ reject }) => reject(new Error('déconnecté')))
    this.pending.clear()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.ws = null
    this.connectSent = false
    this._setStatus('disconnected')
  }

  send(msg: WsOutMessage) {
    this._sendRaw(msg)
  }

  private _sendRaw(msg: WsOutMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  onMessage(handler: MessageHandler) {
    this.messageHandlers.add(handler)
    return () => this.messageHandlers.delete(handler)
  }

  onStatus(handler: StatusHandler) {
    this.statusHandlers.add(handler)
    return () => this.statusHandlers.delete(handler)
  }

  get readyState() {
    return this.ws?.readyState ?? WebSocket.CLOSED
  }

  private _setStatus(status: Parameters<StatusHandler>[0]) {
    this.statusHandlers.forEach((h) => h(status))
  }

  private _scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.shouldReconnect) this._connect()
    }, this.reconnectDelay)
    this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay)
  }
}

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://127.0.0.1:18789'
const WS_TOKEN = import.meta.env.VITE_WS_TOKEN ?? ''

export const openClawWS = new OpenClawWS(WS_URL, WS_TOKEN)
