export type InstaLinkResult =
  | { success: true; url: string }
  | { success: false; error: string }

export type InstaSessionItem = {
  id: string
  isActive: boolean
  instagramUsername: string | null
  instagramFullName: string | null
  instagramProfilePicUrl: string | null
}

export type InstaSessionsResult =
  | { success: true; sessions: InstaSessionItem[]; activeSessionId: string | null }
  | { success: false; error: string }
