import axios from "axios"
import { triggerUnauthorized } from "./auth-nav"
import { apiBaseUrl } from "./config"
import { clearAuthSession, readAuthToken } from "./storage"

export const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 120_000,
  headers: {
    "Content-Type": "application/json",
  },
})

api.interceptors.request.use(async (config) => {
  const token = await readAuthToken()
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`)
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      const hasToken = Boolean(await readAuthToken())
      if ((status === 401 || status === 403) && hasToken) {
        await clearAuthSession()
        triggerUnauthorized()
      }
    }
    return Promise.reject(error)
  },
)
