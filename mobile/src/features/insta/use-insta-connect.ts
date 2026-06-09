import { useContext } from "react"
import { InstaConnectContext } from "./insta-connect-context"

export function useInstaConnect() {
  const ctx = useContext(InstaConnectContext)
  if (!ctx) {
    throw new Error("useInstaConnect deve ser usado dentro de InstaConnectProvider")
  }
  return ctx
}
