import axios from "axios"
import { apiBaseUrl } from "./config"
import { clearAuthSession, readAuthToken } from "./auth-session-storage"

export const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 120_000,
  headers: {
    "Content-Type": "application/json",
  },
})

api.interceptors.request.use((config) => {
  const token = readAuthToken()
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`)
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      const hasToken = Boolean(readAuthToken())
      if ((status === 401 || status === 403) && hasToken) {
        clearAuthSession()
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.assign("/login")
        }
      }
    }
    return Promise.reject(error)
  },
)
