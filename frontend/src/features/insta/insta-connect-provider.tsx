import axios from "axios"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { readInstaLinked, writeInstaLinked } from "../../lib/insta-session-storage"
import {
  deleteInstaSession,
  getInstaSessions,
  patchInstaActiveSession,
  postCreateInstaSession,
  postInstaLogin,
} from "../../lib/insta"
import { InstaConnectContext, type InstaConnectValue } from "./insta-connect-context"
import type { InstaLinkResult, InstaSessionsResult } from "./insta-connect-types"

export function InstaConnectProvider({ children }: { children: ReactNode }) {
  const [isLinked, setIsLinked] = useState(() => readInstaLinked())
  const [isManagingSessions, setIsManagingSessions] = useState(false)
  const [sessions, setSessions] = useState<InstaConnectValue["sessions"]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  const refreshSessions = useCallback(async (): Promise<InstaSessionsResult> => {
    setIsManagingSessions(true)
    try {
      const { data } = await getInstaSessions()
      setSessions(data.sessions)
      setActiveSessionId(data.activeSessionId)
      return { success: true, sessions: data.sessions, activeSessionId: data.activeSessionId }
    } catch (e) {
      if (axios.isAxiosError(e)) {
        const body = e.response?.data as { error?: string } | undefined
        return { success: false, error: body?.error ?? e.message }
      }
      return { success: false, error: e instanceof Error ? e.message : "Erro desconhecido." }
    } finally {
      setIsManagingSessions(false)
    }
  }, [])

  const createSession = useCallback(
    async (setAsActive = true): Promise<InstaSessionsResult> => {
      setIsManagingSessions(true)
      try {
        const { data } = await postCreateInstaSession(setAsActive)
        setSessions(data.sessions)
        setActiveSessionId(data.activeSessionId)
        if (setAsActive) {
          writeInstaLinked(false)
          setIsLinked(false)
        }
        return { success: true, sessions: data.sessions, activeSessionId: data.activeSessionId }
      } catch (e) {
        if (axios.isAxiosError(e)) {
          const body = e.response?.data as { error?: string } | undefined
          return { success: false, error: body?.error ?? e.message }
        }
        return { success: false, error: e instanceof Error ? e.message : "Erro desconhecido." }
      } finally {
        setIsManagingSessions(false)
      }
    },
    [],
  )

  const setActiveSession = useCallback(async (sessionId: string): Promise<InstaSessionsResult> => {
    setIsManagingSessions(true)
    try {
      const { data } = await patchInstaActiveSession(sessionId)
      setSessions(data.sessions)
      setActiveSessionId(data.activeSessionId)
      // Ao trocar a sessão ativa, exige novo vínculo de login IG para essa sessão.
      writeInstaLinked(false)
      setIsLinked(false)
      return { success: true, sessions: data.sessions, activeSessionId: data.activeSessionId }
    } catch (e) {
      if (axios.isAxiosError(e)) {
        const body = e.response?.data as { error?: string } | undefined
        return { success: false, error: body?.error ?? e.message }
      }
      return { success: false, error: e instanceof Error ? e.message : "Erro desconhecido." }
    } finally {
      setIsManagingSessions(false)
    }
  }, [])

  const removeSession = useCallback(async (sessionId: string): Promise<InstaSessionsResult> => {
    setIsManagingSessions(true)
    try {
      const { data } = await deleteInstaSession(sessionId)
      setSessions(data.sessions)
      setActiveSessionId(data.activeSessionId)
      // Se removeu sessão em uso, exige novo vínculo para a sessão ativa resultante.
      writeInstaLinked(false)
      setIsLinked(false)
      return { success: true, sessions: data.sessions, activeSessionId: data.activeSessionId }
    } catch (e) {
      if (axios.isAxiosError(e)) {
        const body = e.response?.data as { error?: string } | undefined
        return { success: false, error: body?.error ?? e.message }
      }
      return { success: false, error: e instanceof Error ? e.message : "Erro desconhecido." }
    } finally {
      setIsManagingSessions(false)
    }
  }, [])

  const connectInstagram = useCallback(
    async (username: string, password: string): Promise<InstaLinkResult> => {
      const u = username.trim()
      if (!u || !password) {
        return { success: false, error: "Preencha usuário e senha do Instagram." }
      }
      try {
        const { data } = await postInstaLogin(u, password)
        if (data.ok && data.success) {
          writeInstaLinked(true)
          setIsLinked(true)
          return { success: true, url: data.url }
        }
        if (data.ok && !data.success) {
          return {
            success: false,
            error:
              "O Instagram não confirmou o login. Verifique as credenciais, 2FA ou use o backend com janela visível. URL: " +
              (data.url.length > 120 ? data.url.slice(0, 120) + "…" : data.url),
          }
        }
        return { success: false, error: "Resposta inesperada do servidor." }
      } catch (e) {
        if (axios.isAxiosError(e)) {
          const body = e.response?.data as { error?: string } | undefined
          return { success: false, error: body?.error ?? e.message }
        }
        return { success: false, error: e instanceof Error ? e.message : "Erro desconhecido." }
      }
    },
    [],
  )

  const disconnectInstagram = useCallback(() => {
    writeInstaLinked(false)
    setIsLinked(false)
  }, [])

  useEffect(() => {
    void refreshSessions()
  }, [refreshSessions])

  const value = useMemo<InstaConnectValue>(
    () => ({
      isLinked,
      isManagingSessions,
      sessions,
      activeSessionId,
      refreshSessions,
      createSession,
      setActiveSession,
      removeSession,
      connectInstagram,
      disconnectInstagram,
    }),
    [
      isLinked,
      isManagingSessions,
      sessions,
      activeSessionId,
      refreshSessions,
      createSession,
      setActiveSession,
      removeSession,
      connectInstagram,
      disconnectInstagram,
    ],
  )

  return <InstaConnectContext.Provider value={value}>{children}</InstaConnectContext.Provider>
}
