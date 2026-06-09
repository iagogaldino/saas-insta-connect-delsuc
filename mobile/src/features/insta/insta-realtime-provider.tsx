import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { Socket } from "socket.io-client"
import { createInstaRealtimeSocket } from "@/src/lib/insta-realtime-socket"
import { readAuthToken } from "@/src/lib/storage"
import { useAuth } from "../auth/use-auth"

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

    let active = true
    let currentSocket: Socket | null = null

    const connect = async () => {
      const token = await readAuthToken()
      if (!active) return
      if (!token) {
        currentSocket?.disconnect()
        currentSocket = null
        setSocket(null)
        return
      }
      currentSocket?.disconnect()
      currentSocket = createInstaRealtimeSocket(token)
      setSocket(currentSocket)
    }

    void connect()

    return () => {
      active = false
      currentSocket?.disconnect()
      currentSocket = null
      setSocket(null)
    }
  }, [isAuthenticated])

  const value = useMemo<InstaRealtimeContextValue>(() => ({ socket }), [socket])

  return <InstaRealtimeContext.Provider value={value}>{children}</InstaRealtimeContext.Provider>
}

export function useInstaRealtime() {
  const ctx = useContext(InstaRealtimeContext)
  if (!ctx) {
    throw new Error("useInstaRealtime deve ser usado dentro de InstaRealtimeProvider")
  }
  return ctx
}
