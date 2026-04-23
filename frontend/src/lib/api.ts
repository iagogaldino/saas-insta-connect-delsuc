import axios from "axios"
import { apiBaseUrl } from "./config"
import { readAuthToken } from "./auth-session-storage"

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
