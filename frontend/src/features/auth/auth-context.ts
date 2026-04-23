import { createContext } from "react"
import type { AuthValue } from "./auth-types"

export const AuthContext = createContext<AuthValue | null>(null)
