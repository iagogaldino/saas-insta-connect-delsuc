export type InstaLinkResult =
  | { success: true; url: string }
  | { success: false; error: string }

export type InstaSessionItem = {
  id: string
  isActive: boolean
}

export type InstaSessionsResult =
  | { success: true; sessions: InstaSessionItem[]; activeSessionId: string }
  | { success: false; error: string }
