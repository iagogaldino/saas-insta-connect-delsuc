import axios from "axios"
import { useCallback, useMemo, useState, type ReactNode } from "react"
import { postAuthLogin, postAuthRegister } from "../../lib/auth"
import { clearAuthSession, readAuthEmail, readAuthToken, writeAuthSession } from "../../lib/auth-session-storage"
import { AuthContext } from "./auth-context"
import type { AuthActionResult, AuthValue } from "./auth-types"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(readAuthToken()))
  const [userEmail, setUserEmail] = useState<string | null>(() => readAuthEmail())

  const persistSession = useCallback((token: string, email: string) => {
    writeAuthSession(token, email)
    setIsAuthenticated(true)
    setUserEmail(email)
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<AuthActionResult> => {
    const normalizedEmail = email.trim()
    if (!normalizedEmail || !password) {
      return { ok: false, error: "Preencha e-mail e senha." }
    }
    try {
      const { data } = await postAuthLogin({ email: normalizedEmail, password })
      persistSession(data.token, data.user.email)
      return { ok: true }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const response = error.response?.data as { error?: string } | undefined
        return { ok: false, error: response?.error ?? "Falha ao autenticar." }
      }
      return { ok: false, error: error instanceof Error ? error.message : "Erro inesperado." }
    }
  }, [persistSession])

  const register = useCallback(async (email: string, password: string): Promise<AuthActionResult> => {
    const normalizedEmail = email.trim()
    if (!normalizedEmail || !password) {
      return { ok: false, error: "Preencha e-mail e senha." }
    }
    try {
      const { data } = await postAuthRegister({ email: normalizedEmail, password })
      persistSession(data.token, data.user.email)
      return { ok: true }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const response = error.response?.data as { error?: string } | undefined
        return { ok: false, error: response?.error ?? "Falha ao criar conta." }
      }
      return { ok: false, error: error instanceof Error ? error.message : "Erro inesperado." }
    }
  }, [persistSession])

  const logout = useCallback(() => {
    clearAuthSession()
    setIsAuthenticated(false)
    setUserEmail(null)
  }, [])

  const value = useMemo<AuthValue>(
    () => ({ isAuthenticated, userEmail, login, register, logout }),
    [isAuthenticated, userEmail, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
