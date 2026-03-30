const AUTH_OK_KEY = 'openclaw:auth_ok'

export function getExpectedAppToken(): string | null {
  const t = (import.meta.env.VITE_APP_TOKEN as string | undefined)?.trim()
  return t ? t : null
}

export function isAppAuthEnabled(): boolean {
  return getExpectedAppToken() !== null
}

export function isAppAuthed(): boolean {
  if (!isAppAuthEnabled()) return true
  return localStorage.getItem(AUTH_OK_KEY) === '1'
}

export function setAppAuthed(ok: boolean) {
  if (ok) localStorage.setItem(AUTH_OK_KEY, '1')
  else localStorage.removeItem(AUTH_OK_KEY)
}

export function validateAppToken(input: string): boolean {
  const expected = getExpectedAppToken()
  if (!expected) return true
  return input.trim() === expected
}

