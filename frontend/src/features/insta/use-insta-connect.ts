import { useContext } from "react"
import { InstaConnectContext } from "./insta-connect-context"
import type { InstaConnectValue } from "./insta-connect-context"

export function useInstaConnect(): InstaConnectValue {
  const ctx = useContext(InstaConnectContext)
  if (!ctx) {
    throw new Error("useInstaConnect must be used within InstaConnectProvider")
  }
  return ctx
}
