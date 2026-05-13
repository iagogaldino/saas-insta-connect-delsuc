import { io, type Socket } from "socket.io-client"
import { getInstaRealtimeSocketUrl } from "./config"
import type {
  AutoFollowJobStatusResponse,
  FollowOutboundSuccessPayload,
  FollowScheduleTouchPayload,
} from "./insta"

export type InstaRealtimeSocketHandlers = {
  onFollowScheduleTouch?: (payload: FollowScheduleTouchPayload) => void
  onFollowOutboundSuccess?: (payload: FollowOutboundSuccessPayload) => void
}

export function createInstaRealtimeSocket(token: string, handlers: InstaRealtimeSocketHandlers = {}): Socket {
  const socket = io(getInstaRealtimeSocketUrl(), {
    path: "/socket.io/",
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 1_000,
  })
  if (handlers.onFollowScheduleTouch) {
    socket.on("followSchedule:touch", handlers.onFollowScheduleTouch)
  }
  if (handlers.onFollowOutboundSuccess) {
    socket.on("followOutbound:success", handlers.onFollowOutboundSuccess)
  }
  return socket
}

export function waitForSocketConnected(socket: Socket, timeoutMs: number): Promise<boolean> {
  if (socket.connected) {
    return Promise.resolve(true)
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(socket.connected), timeoutMs)
    const done = (ok: boolean) => {
      clearTimeout(timer)
      socket.off("connect", onConnect)
      socket.off("connect_error", onConnectError)
      resolve(ok)
    }
    const onConnect = () => done(true)
    const onConnectError = () => done(false)
    socket.once("connect", onConnect)
    socket.once("connect_error", onConnectError)
  })
}

/** Erro interno: caller deve fazer fallback para polling HTTP. */
export const AUTOFOLLOW_SOCKET_FALLBACK_POLL = "__FALLBACK_POLL__"
/** Erro interno: timeout na espera via socket; tentar polling HTTP. */
export const AUTOFOLLOW_SOCKET_WAIT_TIMEOUT = "__SOCKET_WAIT_TIMEOUT__"

export function waitForAutofollowJobOnSocket<T>(socket: Socket, jobId: string, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error(AUTOFOLLOW_SOCKET_WAIT_TIMEOUT))
    }, timeoutMs)

    function cleanup() {
      clearTimeout(timer)
      socket.off("autofollow:job", onJob)
      socket.off("autofollow:subscribe_error", onSubscribeErr)
    }

    function onSubscribeErr(raw: unknown) {
      const p = raw as { jobId?: string }
      if (p?.jobId !== jobId) return
      if (settled) return
      settled = true
      cleanup()
      reject(new Error(AUTOFOLLOW_SOCKET_FALLBACK_POLL))
    }

    function onJob(payload: AutoFollowJobStatusResponse) {
      if (!payload?.ok || payload.job.id !== jobId) return
      if (payload.job.status === "pending" || payload.job.status === "running") return
      if (settled) return
      settled = true
      cleanup()
      if (payload.job.status === "completed") {
        resolve(payload.job.result as T)
      } else {
        reject(new Error(payload.job.error ?? "A automação falhou no processamento em background."))
      }
    }

    socket.on("autofollow:subscribe_error", onSubscribeErr)
    socket.on("autofollow:job", onJob)
    socket.emit("autofollow:subscribe", jobId)
  })
}

export type { AutofollowJobSocketPayload } from "./insta"
