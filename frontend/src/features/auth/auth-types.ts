export type AuthActionResult = {
  ok: boolean
  error?: string
}

export type AuthValue = {
  isAuthenticated: boolean
  userEmail: string | null
  login: (email: string, password: string) => Promise<AuthActionResult>
  register: (email: string, password: string) => Promise<AuthActionResult>
  logout: () => void
}
