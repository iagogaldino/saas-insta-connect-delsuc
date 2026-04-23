export type InstaLinkResult =
  | { success: true; url: string }
  | {
      success: false
      challengeRequired: true
      challengeType?: "security_code" | "two_factor" | "unknown"
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
