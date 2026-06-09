import * as SecureStore from "expo-secure-store"
import { Platform } from "react-native"
import { authTokenStorageKey } from "./config"

const EMAIL_KEY = `${authTokenStorageKey}_email`

function useWebStorage(): boolean {
  return Platform.OS === "web"
}

async function secureStoreAvailable(): Promise<boolean> {
  try {
    return await SecureStore.isAvailableAsync()
  } catch {
    return false
  }
}

async function getItem(key: string): Promise<string | null> {
  if (useWebStorage()) {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  }
  if (!(await secureStoreAvailable())) return null
  try {
    return await SecureStore.getItemAsync(key)
  } catch {
    return null
  }
}

async function setItem(key: string, value: string): Promise<void> {
  if (useWebStorage()) {
    localStorage.setItem(key, value)
    return
  }
  if (!(await secureStoreAvailable())) {
    throw new Error("Armazenamento seguro indisponível neste dispositivo.")
  }
  await SecureStore.setItemAsync(key, value)
}

async function removeItem(key: string): Promise<void> {
  if (useWebStorage()) {
    localStorage.removeItem(key)
    return
  }
  if (!(await secureStoreAvailable())) return
  try {
    await SecureStore.deleteItemAsync(key)
  } catch {
    // noop
  }
}

export async function readAuthToken(): Promise<string | null> {
  return getItem(authTokenStorageKey)
}

export async function readAuthEmail(): Promise<string | null> {
  return getItem(EMAIL_KEY)
}

export async function writeAuthSession(token: string, email: string) {
  await setItem(authTokenStorageKey, token)
  await setItem(EMAIL_KEY, email)
}

export async function clearAuthSession() {
  await removeItem(authTokenStorageKey)
  await removeItem(EMAIL_KEY)
}
