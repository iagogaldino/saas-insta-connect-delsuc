import { X } from "lucide-react"
import { useEffect, useMemo } from "react"
import { readAuthToken } from "../../lib/auth-session-storage"
import { buildChallengeAssistOpenUrl, parseChallengeAssistMessage } from "./insta-connect-types"

type ChallengeAssistEmbedProps = {
  open: boolean
  challengeAssistUrl: string | null
  onClose: () => void
  onLoginSuccess: () => void
}

export function ChallengeAssistEmbed({
  open,
  challengeAssistUrl,
  onClose,
  onLoginSuccess,
}: ChallengeAssistEmbedProps) {
  const embedSrc = useMemo(() => {
    if (!open || !challengeAssistUrl) return null
    const token = readAuthToken()
    if (!token) return null
    return buildChallengeAssistOpenUrl(challengeAssistUrl, token)
  }, [open, challengeAssistUrl])

  useEffect(() => {
    if (!open) return

    function handleMessage(event: MessageEvent) {
      if (parseChallengeAssistMessage(event.data)) {
        onLoginSuccess()
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [open, onLoginSuccess])

  if (!open || !embedSrc) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-3">
        <span className="text-sm font-medium text-white">Verificação reCAPTCHA</span>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
          aria-label="Fechar verificação"
        >
          <X className="h-4 w-4" aria-hidden />
          Fechar
        </button>
      </div>
      <iframe
        src={embedSrc}
        title="Verificação reCAPTCHA"
        className="min-h-0 flex-1 w-full border-0 bg-black"
        allow="fullscreen"
      />
    </div>
  )
}
