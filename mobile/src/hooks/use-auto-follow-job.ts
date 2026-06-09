import type { Socket } from "socket.io-client"
import { getAutoFollowJobStatus } from "@/src/lib/insta"
import {
  AUTOFOLLOW_SOCKET_FALLBACK_POLL,
  AUTOFOLLOW_SOCKET_WAIT_TIMEOUT,
  waitForAutofollowJobOnSocket,
  waitForSocketConnected,
} from "@/src/lib/insta-realtime-socket"

export async function waitForAutoFollowJobResult<T>(socket: Socket | null, jobId: string): Promise<T> {
  const deadline = Date.now() + 30 * 60 * 1000

  if (socket) {
    const ready = await waitForSocketConnected(socket, 5_000)
    if (ready) {
      try {
        return await waitForAutofollowJobOnSocket<T>(socket, jobId, Math.max(10_000, deadline - Date.now()))
      } catch (e) {
        if (
          e instanceof Error &&
          (e.message === AUTOFOLLOW_SOCKET_FALLBACK_POLL || e.message === AUTOFOLLOW_SOCKET_WAIT_TIMEOUT)
        ) {
          // fallback HTTP abaixo
        } else {
          throw e
        }
      }
    }
  }

  while (true) {
    const { data } = await getAutoFollowJobStatus(jobId)
    if (data.job.status === "completed") {
      return data.job.result as T
    }
    if (data.job.status === "failed") {
      throw new Error(data.job.error ?? "A automação falhou no processamento em background.")
    }
    if (Date.now() > deadline) {
      throw new Error("A automação excedeu o tempo máximo de espera (30 min).")
    }
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
}

export function isReloginError(message: string): boolean {
  return (
    message.includes("Sessao nao autenticada. Faca login antes de seguir.") ||
    message.includes("Sessão não autenticada. Faça login antes de seguir.")
  )
}
