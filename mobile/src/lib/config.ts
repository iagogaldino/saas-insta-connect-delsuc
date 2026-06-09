const raw = process.env.EXPO_PUBLIC_API_BASE_URL

/** Base URL do backend (Express), ex.: `http://10.0.2.2:3000` no emulador Android. */
export const apiBaseUrl: string =
  typeof raw === "string" && raw.length > 0 ? raw : "http://0.0.0.0:3000"

/** Origem do Socket.IO (mesmo host/porta que o REST). */
export function getInstaRealtimeSocketUrl(): string {
  try {
    return new URL(apiBaseUrl).origin
  } catch {
    return apiBaseUrl.replace(/\/$/, "")
  }
}

export const authLoginPath = "/auth/login"
export const authRegisterPath = "/auth/register"
export const authTokenStorageKey = "insta_connect_token"
