import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { Socket } from "socket.io-client"
import { Toaster, toast } from "sonner"
import { readAuthToken } from "../../lib/auth-session-storage"
import { createInstaRealtimeSocket } from "../../lib/insta-realtime-socket"
import type { FollowOutboundSuccessPayload } from "../../lib/insta"
import { useAuth } from "../auth/use-auth"

type InstaRealtimeContextValue = {
  socket: Socket | null
}

const InstaRealtimeContext = createContext<InstaRealtimeContextValue | null>(null)

function showFollowOutboundToast(raw: unknown) {
  const payload = raw as FollowOutboundSuccessPayload
  const usernameRaw = typeof payload?.username === "string" ? payload.username : ""
  const sessionId = typeof payload?.sessionId === "string" ? payload.sessionId : ""
  const followedAt = typeof payload?.followedAt === "string" ? payload.followedAt : ""
  const handle = usernameRaw.trim().toLowerCase()
  if (!handle || !sessionId) {
    return
  }
  const fullName = typeof payload.fullName === "string" ? payload.fullName : null
  const profilePicUrl = typeof payload.profilePicUrl === "string" ? payload.profilePicUrl : null
  const label = fullName?.trim() || `@${handle}`
  const toastId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? `follow-outbound-${crypto.randomUUID()}`
      : `follow-outbound-${sessionId}-${handle}-${followedAt}-${Date.now()}-${Math.random().toString(36).slice(2)}`

  try {
    toast.custom(
      (id) => (
        <div className="pointer-events-auto flex w-[min(100vw-2rem,22rem)] items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-lg">
          {profilePicUrl ? (
            <img src={profilePicUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
              @{handle.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Novo follow</p>
            <p className="truncate text-sm font-semibold text-slate-900">{label}</p>
            <p className="truncate text-xs text-slate-600">@{handle}</p>
          </div>
          <button
            type="button"
            onClick={() => toast.dismiss(id)}
            className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
      ),
      { id: toastId, duration: 6_000, position: "bottom-right" },
    )
  } catch {
    /* evita quebrar o handler do socket */
  }
}

export function InstaRealtimeProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      setSocket((prev) => {
        prev?.disconnect()
        return null
      })
      return
    }
    const token = readAuthToken()
    if (!token) {
      setSocket((prev) => {
        prev?.disconnect()
        return null
      })
      return
    }
    const s = createInstaRealtimeSocket(token, {
      onFollowOutboundSuccess: showFollowOutboundToast,
    })
    setSocket(s)
    return () => {
      s.disconnect()
      setSocket((cur) => (cur === s ? null : cur))
    }
  }, [isAuthenticated])

  const value = useMemo<InstaRealtimeContextValue>(() => ({ socket }), [socket])

  return (
    <InstaRealtimeContext.Provider value={value}>
      <Toaster position="bottom-right" visibleToasts={24} closeButton richColors />
      {children}
    </InstaRealtimeContext.Provider>
  )
}

export function useInstaRealtime(): InstaRealtimeContextValue {
  const ctx = useContext(InstaRealtimeContext)
  if (!ctx) {
    throw new Error("useInstaRealtime must be used within InstaRealtimeProvider")
  }
  return ctx
}
