import axios from "axios"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { postAuthLogin, postAuthRegister } from "@/src/lib/auth"
import { clearAuthSession, readAuthEmail, readAuthToken, writeAuthSession } from "@/src/lib/storage"
import { AuthContext } from "./auth-context"
import type { AuthActionResult, AuthValue } from "./auth-types"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const bootstrap = async () => {
      const token = await readAuthToken()
      const email = await readAuthEmail()
      if (!active) return
      setIsAuthenticated(Boolean(token))
      setUserEmail(email)
      setIsLoading(false)
    }
    void bootstrap()
    return () => {
      active = false
    }
  }, [])

  const persistSession = useCallback(async (token: string, email: string) => {
    await writeAuthSession(token, email)
    setIsAuthenticated(true)
    setUserEmail(email)
  }, [])

  const login = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      const normalizedEmail = email.trim()
      if (!normalizedEmail || !password) {
        return { ok: false, error: "Preencha e-mail e senha." }
      }
      try {
        const { data } = await postAuthLogin({ email: normalizedEmail, password })
        await persistSession(data.token, data.user.email)
        return { ok: true }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const response = error.response?.data as { error?: string } | undefined
          return { ok: false, error: response?.error ?? "Falha ao autenticar." }
        }
        return { ok: false, error: error instanceof Error ? error.message : "Erro inesperado." }
      }
    },
    [persistSession],
  )

  const register = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      const normalizedEmail = email.trim()
      if (!normalizedEmail || !password) {
        return { ok: false, error: "Preencha e-mail e senha." }
      }
      try {
        const { data } = await postAuthRegister({ email: normalizedEmail, password })
        await persistSession(data.token, data.user.email)
        return { ok: true }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const response = error.response?.data as { error?: string } | undefined
          return { ok: false, error: response?.error ?? "Falha ao criar conta." }
        }
        return { ok: false, error: error instanceof Error ? error.message : "Erro inesperado." }
      }
    },
    [persistSession],
  )

  const logout = useCallback(async () => {
    await clearAuthSession()
    setIsAuthenticated(false)
    setUserEmail(null)
  }, [])

  const value = useMemo<AuthValue>(
    () => ({ isAuthenticated, isLoading, userEmail, login, register, logout }),
    [isAuthenticated, isLoading, userEmail, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
