import { createContext } from "react"
import type { InstaLinkResult, InstaSessionItem, InstaSessionsResult } from "./insta-connect-types"

export type InstaConnectValue = {
  isManagingSessions: boolean
  sessions: InstaSessionItem[]
  activeSessionId: string | null
  refreshSessions: () => Promise<InstaSessionsResult>
  createSession: (setAsActive?: boolean) => Promise<InstaSessionsResult>
  startSessionRuntime: (sessionId: string) => Promise<InstaSessionsResult>
  connectInstagramToSession: (sessionId: string, username: string, password: string) => Promise<InstaLinkResult>
  submitSecurityCodeForSession: (sessionId: string, username: string, code: string) => Promise<InstaLinkResult>
}

export const InstaConnectContext = createContext<InstaConnectValue | null>(null)
