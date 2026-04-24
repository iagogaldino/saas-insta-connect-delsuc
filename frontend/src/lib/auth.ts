import { api } from "./api"
import { authLoginPath, authRegisterPath } from "./config"

type AuthRequest = {
  email: string
  password: string
}

export type AuthResponse = {
  ok: boolean
  token: string
  user: {
    id: string
    email: string
  }
}

export type IntegrationTokenResponse = {
  ok: boolean
  token: string
  user: {
    id: string
    email: string
  }
  tokenType: "integration"
  expiresIn: string
}

export async function postAuthLogin(payload: AuthRequest) {
  return api.post<AuthResponse>(authLoginPath, payload)
}

export async function postAuthRegister(payload: AuthRequest) {
  return api.post<AuthResponse>(authRegisterPath, payload)
}

export async function postCreateIntegrationToken() {
  return api.post<IntegrationTokenResponse>("/auth/integration-token")
}
