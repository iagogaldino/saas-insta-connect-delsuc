/** Sessão “Instagram ligado” no client (só o browser; o backend continua a sessão do Puppeteer). */
const KEY = "insta_session_ok"

export function readInstaLinked(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1"
  } catch {
    return false
  }
}

export function writeInstaLinked(connected: boolean) {
  try {
    if (connected) {
      sessionStorage.setItem(KEY, "1")
    } else {
      sessionStorage.removeItem(KEY)
    }
  } catch {
    // ignore
  }
}

export function clearInstaLinked() {
  writeInstaLinked(false)
}
