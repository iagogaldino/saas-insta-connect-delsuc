import axios from "axios"
import { useCallback, useMemo, useState, type ReactNode } from "react"
import { readInstaLinked, writeInstaLinked } from "../../lib/insta-session-storage"
import { postInstaLogin } from "../../lib/insta"
import { InstaConnectContext, type InstaConnectValue } from "./insta-connect-context"
import type { InstaLinkResult } from "./insta-connect-types"

export function InstaConnectProvider({ children }: { children: ReactNode }) {
  const [isLinked, setIsLinked] = useState(() => readInstaLinked())

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

  const value = useMemo<InstaConnectValue>(
    () => ({ isLinked, connectInstagram, disconnectInstagram }),
    [isLinked, connectInstagram, disconnectInstagram],
  )

  return <InstaConnectContext.Provider value={value}>{children}</InstaConnectContext.Provider>
}
