import axios from "axios"
import { apiBaseUrl } from "./config"

const AUTH_KEY = "saas_auth"

export const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 120_000,
  headers: {
    "Content-Type": "application/json",
  },
})

api.interceptors.request.use((config) => {
  if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(AUTH_KEY) === "1") {
    config.headers.set("Authorization", "Bearer mock-token")
  }
  return config
})
