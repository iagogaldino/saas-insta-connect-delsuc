import Constants from "expo-constants"
import { Platform } from "react-native"

const DEFAULT_API_BASE_URL = "http://localhost:3000"

function getDevMachineHost(): string | null {
  if (Platform.OS === "web") return null

  const debuggerHost = Constants.expoGoConfig?.debuggerHost
  if (debuggerHost) {
    const host = debuggerHost.split(":")[0]?.trim()
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return host
    }
  }

  const hostUri = Constants.expoConfig?.hostUri
  if (hostUri) {
    const host = hostUri.split(":")[0]?.trim()
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return host
    }
  }

  return null
}

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0"
}

function resolveApiBaseUrl(raw: string | undefined): string {
  const base = typeof raw === "string" && raw.length > 0 ? raw : DEFAULT_API_BASE_URL

  try {
    const url = new URL(base)

    if (!isLocalHostname(url.hostname)) {
      return base.replace(/\/$/, "")
    }

    const devHost = getDevMachineHost()
    if (devHost) {
      url.hostname = devHost
      return url.toString().replace(/\/$/, "")
    }

    if (Platform.OS === "android") {
      url.hostname = "10.0.2.2"
      return url.toString().replace(/\/$/, "")
    }

    if (url.hostname === "0.0.0.0") {
      url.hostname = "localhost"
    }

    return url.toString().replace(/\/$/, "")
  } catch {
    return DEFAULT_API_BASE_URL
  }
}

/** Base URL do backend (Express). Em device físico, localhost vira o IP da máquina via Expo. */
export const apiBaseUrl = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL)

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
