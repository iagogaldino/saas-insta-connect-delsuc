import { authTokenStorageKey } from "./config"

const EMAIL_KEY = `${authTokenStorageKey}_email`

export function readAuthToken(): string | null {
  try {
    return localStorage.getItem(authTokenStorageKey)
  } catch {
    return null
  }
}

export function readAuthEmail(): string | null {
  try {
    return localStorage.getItem(EMAIL_KEY)
  } catch {
    return null
  }
}

export function writeAuthSession(token: string, email: string) {
  localStorage.setItem(authTokenStorageKey, token)
  localStorage.setItem(EMAIL_KEY, email)
}

export function clearAuthSession() {
  localStorage.removeItem(authTokenStorageKey)
  localStorage.removeItem(EMAIL_KEY)
}
