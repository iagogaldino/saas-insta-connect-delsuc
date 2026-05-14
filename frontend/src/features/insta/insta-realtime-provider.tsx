import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { Socket } from "socket.io-client"
import { Toaster } from "sonner"
import { readAuthToken } from "../../lib/auth-session-storage"
import { createInstaRealtimeSocket } from "../../lib/insta-realtime-socket"
import { useAuth } from "../auth/use-auth"
import { resetFollowOutboundToastState, showFollowOutboundToast } from "./follow-outbound-toast"

type InstaRealtimeContextValue = {
  socket: Socket | null
}

const InstaRealtimeContext = createContext<InstaRealtimeContextValue | null>(null)

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
      resetFollowOutboundToastState()
      s.disconnect()
      setSocket((cur) => (cur === s ? null : cur))
    }
  }, [isAuthenticated])

  const value = useMemo<InstaRealtimeContextValue>(() => ({ socket }), [socket])

  return (
    <InstaRealtimeContext.Provider value={value}>
      <Toaster position="bottom-right" visibleToasts={4} closeButton richColors />
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
