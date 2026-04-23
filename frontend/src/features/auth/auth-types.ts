export type AuthValue = {
  isAuthenticated: boolean
  /** Acesso ao painel (SAAS) — independente do Instagram */
  login: (email: string, password: string) => boolean
  logout: () => void
}
