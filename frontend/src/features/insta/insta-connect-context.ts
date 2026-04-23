import { createContext } from "react"
import type { InstaLinkResult } from "./insta-connect-types"

export type InstaConnectValue = {
  isLinked: boolean
  connectInstagram: (username: string, password: string) => Promise<InstaLinkResult>
  disconnectInstagram: () => void
}

export const InstaConnectContext = createContext<InstaConnectValue | null>(null)
