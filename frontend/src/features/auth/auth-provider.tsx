import { useCallback, useMemo, useState, type ReactNode } from "react"
import { AuthContext } from "./auth-context"
import type { AuthValue } from "./auth-types"

const AUTH_KEY = "saas_auth"

function readSession(): boolean {
  try {
    return sessionStorage.getItem(AUTH_KEY) === "1"
  } catch {
    return false
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => readSession())

  const login = useCallback((email: string, password: string) => {
    if (!email.trim() || !password) return false
    sessionStorage.setItem(AUTH_KEY, "1")
    setIsAuthenticated(true)
    return true
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(AUTH_KEY)
    setIsAuthenticated(false)
  }, [])

  const value = useMemo<AuthValue>(
    () => ({ isAuthenticated, login, logout }),
    [isAuthenticated, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
