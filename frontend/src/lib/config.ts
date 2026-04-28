const raw = import.meta.env.VITE_API_BASE_URL
/** Base URL do backend (Express), ex.: `http://127.0.0.1:3000` */
export const apiBaseUrl: string = typeof raw === "string" && raw.length > 0 ? raw : "http://127.0.0.1:3000"

const rawAppBasePath = import.meta.env.VITE_APP_BASE_PATH

function normalizeBasePath(value: string | undefined): string {
  if (!value || value.trim().length === 0 || value.trim() === "/") {
    return "/"
  }
  let normalized = value.trim()
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`
  }
  if (!normalized.endsWith("/")) {
    normalized = `${normalized}/`
  }
  return normalized
}

/** Base path público da SPA (ex.: `/insta-connect/`). */
export const appBasePath: string = normalizeBasePath(rawAppBasePath)

const rawLoginPath = import.meta.env.VITE_AUTH_LOGIN_PATH
const rawRegisterPath = import.meta.env.VITE_AUTH_REGISTER_PATH
const rawTokenStorageKey = import.meta.env.VITE_AUTH_TOKEN_STORAGE_KEY

export const authLoginPath: string =
  typeof rawLoginPath === "string" && rawLoginPath.length > 0 ? rawLoginPath : "/auth/login"

export const authRegisterPath: string =
  typeof rawRegisterPath === "string" && rawRegisterPath.length > 0 ? rawRegisterPath : "/auth/register"

export const authTokenStorageKey: string =
  typeof rawTokenStorageKey === "string" && rawTokenStorageKey.length > 0
    ? rawTokenStorageKey
    : "insta_connect_token"
