import { createContext } from "react"
import type { InstaLinkResult, InstaSessionItem, InstaSessionsResult } from "./insta-connect-types"

export type InstaConnectValue = {
  isLinked: boolean
  isManagingSessions: boolean
  sessions: InstaSessionItem[]
  activeSessionId: string | null
  refreshSessions: () => Promise<InstaSessionsResult>
  createSession: (setAsActive?: boolean) => Promise<InstaSessionsResult>
  setActiveSession: (sessionId: string) => Promise<InstaSessionsResult>
  removeSession: (sessionId: string) => Promise<InstaSessionsResult>
  connectInstagram: (username: string, password: string) => Promise<InstaLinkResult>
  connectInstagramToSession: (sessionId: string, username: string, password: string) => Promise<InstaLinkResult>
  submitSecurityCodeForSession: (sessionId: string, username: string, code: string) => Promise<InstaLinkResult>
  disconnectInstagram: () => void
}

export const InstaConnectContext = createContext<InstaConnectValue | null>(null)
