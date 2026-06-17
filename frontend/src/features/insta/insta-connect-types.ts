export type InstaLoginChallengeType =

  | "security_code"

  | "two_factor"

  | "email_code"

  | "recaptcha"

  | "manual_interaction"

  | "unknown"



export function isManualInteractionChallenge(challengeType?: InstaLoginChallengeType): boolean {

  return challengeType === "recaptcha" || challengeType === "manual_interaction"

}



export function instaChallengeFormTitle(challengeType?: InstaLoginChallengeType): string {

  if (challengeType === "recaptcha" || challengeType === "manual_interaction") {

    return "Verificação visual do Instagram (reCAPTCHA)"

  }

  if (challengeType === "email_code") {

    return "Confirmar código enviado por e-mail"

  }

  if (challengeType === "two_factor") {

    return "Confirmar autenticação em duas etapas (2FA)"

  }

  return "Confirmar código de segurança"

}



export function instaChallengeDefaultMessage(challengeType?: InstaLoginChallengeType): string {

  if (challengeType === "recaptcha" || challengeType === "manual_interaction") {

    return "O Instagram pediu reCAPTCHA ou outra verificação visual. Abra a página de assistência remota, conclua o desafio e depois verifique o status aqui."

  }

  if (challengeType === "email_code") {

    return "Verifique seu e-mail e digite o código enviado pelo Instagram para concluir a conexão."

  }

  if (challengeType === "two_factor") {

    return "Digite o código de autenticação em duas etapas para concluir a conexão."

  }

  return "Instagram pediu código de segurança. Digite o código recebido para concluir a conexão."

}



export function buildChallengeAssistOpenUrl(challengeAssistUrl: string, accessToken: string): string {
  try {
    const url = new URL(challengeAssistUrl)
    url.searchParams.set("accessToken", accessToken)
    url.searchParams.set("embedded", "1")
    return url.toString()
  } catch {
    const joiner = challengeAssistUrl.includes("?") ? "&" : "?"
    return `${challengeAssistUrl}${joiner}accessToken=${encodeURIComponent(accessToken)}&embedded=1`
  }
}

export const CHALLENGE_LOGIN_SUCCESS_MESSAGE = "insta-connect:challenge-login-success" as const

export type ChallengeLoginSuccessPayload = {
  type: typeof CHALLENGE_LOGIN_SUCCESS_MESSAGE
  sessionId: string
}

export function parseChallengeAssistMessage(data: unknown): ChallengeLoginSuccessPayload | null {
  if (!data || typeof data !== "object") {
    if (typeof data === "string") {
      try {
        return parseChallengeAssistMessage(JSON.parse(data) as unknown)
      } catch {
        return null
      }
    }
    return null
  }
  const record = data as Record<string, unknown>
  if (record.type !== CHALLENGE_LOGIN_SUCCESS_MESSAGE) return null
  if (typeof record.sessionId !== "string" || !record.sessionId.trim()) return null
  return { type: CHALLENGE_LOGIN_SUCCESS_MESSAGE, sessionId: record.sessionId.trim() }
}



export type InstaLinkResult =

  | { success: true; url: string }

  | {

      success: false

      challengeRequired: true

      challengeType?: InstaLoginChallengeType

      manualInteractionRequired?: boolean

      challengeAssistUrl?: string

      message?: string

      url: string

      sessionId: string

      username: string

    }

  | { success: false; error: string }



export type InstaSessionItem = {

  id: string

  isActive: boolean

  isRuntimeOn?: boolean

  requiresRelogin?: boolean

  instagramUsername: string | null

  instagramFullName: string | null

  instagramProfilePicUrl: string | null

  incomingWebhookUrl?: string | null

  incomingWebhookEnabled?: boolean

  incomingWebhookLastStatus?: "ok" | "error" | null

  incomingWebhookLastError?: string | null

  incomingWebhookLastSentAt?: string | null

}



export type InstaSessionsResult =

  | {

      success: true

      sessions: InstaSessionItem[]

      activeSessionId: string | null

      isInstagramAuthenticated?: boolean

      runtimeStatusMessage?: string

    }

  | { success: false; error: string }


