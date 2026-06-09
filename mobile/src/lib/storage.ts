import * as SecureStore from "expo-secure-store"
import { authTokenStorageKey } from "./config"

const EMAIL_KEY = `${authTokenStorageKey}_email`

export async function readAuthToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(authTokenStorageKey)
  } catch {
    return null
  }
}

export async function readAuthEmail(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(EMAIL_KEY)
  } catch {
    return null
  }
}

export async function writeAuthSession(token: string, email: string) {
  await SecureStore.setItemAsync(authTokenStorageKey, token)
  await SecureStore.setItemAsync(EMAIL_KEY, email)
}

export async function clearAuthSession() {
  await SecureStore.deleteItemAsync(authTokenStorageKey)
  await SecureStore.deleteItemAsync(EMAIL_KEY)
}
