import { useContext } from "react"
import { AuthContext } from "./auth-context"
import type { AuthValue } from "./auth-types"

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return ctx
}
