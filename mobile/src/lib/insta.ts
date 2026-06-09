import { api } from "./api"

export type InstaLoginResponse = {
  ok: true
  headless: boolean
  success: boolean
  url: string
  challengeRequired?: boolean
  challengeType?: "security_code" | "two_factor" | "unknown"
  message?: string
}

export async function postInstaLoginForSession(sessionId: string, username: string, password: string) {
  return api.post<InstaLoginResponse>(`/insta/sessions/${encodeURIComponent(sessionId)}/connect-login`, {
    username,
    password,
  })
}

export async function postInstaSubmitSecurityCodeForSession(
  sessionId: string,
  code: string,
  username: string,
) {
  return api.post<InstaLoginResponse>(
    `/insta/sessions/${encodeURIComponent(sessionId)}/submit-security-code`,
    { code, username },
  )
}

export type InstaSessionItem = {
  id: string
  isActive: boolean
  isRuntimeOn?: boolean
  requiresRelogin?: boolean
  instagramUsername: string | null
  instagramFullName: string | null
  instagramProfilePicUrl: string | null
}

export type InstaSessionsResponse = {
  ok: true
  activeSessionId: string | null
  sessions: InstaSessionItem[]
  isInstagramAuthenticated?: boolean
  runtimeStatusMessage?: string
  loginUrl?: string
}

export async function getInstaSessions() {
  return api.get<InstaSessionsResponse>("/insta/sessions")
}

export async function postCreateInstaSession(setAsActive = true) {
  return api.post<InstaSessionsResponse>("/insta/sessions", { setAsActive })
}

export async function patchInstaActiveSession(sessionId: string) {
  return api.patch<InstaSessionsResponse>("/insta/sessions/active", { sessionId })
}

export async function postStartInstaSessionRuntime(sessionId: string) {
  return api.post<InstaSessionsResponse>(`/insta/sessions/${encodeURIComponent(sessionId)}/runtime/start`)
}

export async function postStopInstaSessionRuntime(sessionId: string) {
  return api.post<InstaSessionsResponse>(`/insta/sessions/${encodeURIComponent(sessionId)}/runtime/stop`)
}

export async function deleteInstaSession(sessionId: string) {
  return api.delete<InstaSessionsResponse>(`/insta/sessions/${encodeURIComponent(sessionId)}`)
}

export type AutoFollowPrivacyFilter = "any" | "public" | "private"

export type AutoFollowResultItem = {
  username: string
  userId?: string
  isPrivate?: boolean
  success: boolean
  following?: boolean
  error?: string
  fullName?: string | null
  href?: string | null
  profilePicUrl?: string | null
  isVerified?: boolean | null
  reason?: string | null
}

export type AutoFollowResponse = {
  ok: true
  headless: boolean
  requested: number
  attempted: number
  followed: number
  privacyFilter: AutoFollowPrivacyFilter
  results: AutoFollowResultItem[]
}

export async function postAutoFollowSuggested(quantity: number, privacyFilter: AutoFollowPrivacyFilter) {
  return api.post<AutoFollowJobAcceptedResponse>("/insta/auto-follow", { quantity, privacyFilter })
}

export type AutoFollowFollowersResponse = {
  ok: true
  headless: boolean
  targetUsername: string
  targetUserId: string
  profileOpenedVia: "search" | "direct"
  requested: number
  attempted: number
  followed: number
  privacyFilter: AutoFollowPrivacyFilter
  results: AutoFollowResultItem[]
}

export async function postAutoFollowFollowers(
  targetUsername: string,
  quantity: number,
  privacyFilter: AutoFollowPrivacyFilter,
) {
  return api.post<AutoFollowJobAcceptedResponse>("/insta/auto-follow-followers", {
    targetUsername,
    quantity,
    privacyFilter,
  })
}

export type AutoFollowJobAcceptedResponse = {
  ok: true
  jobId: string
  status: "pending" | "running" | "completed" | "failed"
  createdAt: string
}

export type AutoFollowJobStatusResponse = {
  ok: true
  job: {
    id: string
    type: "suggested" | "followers"
    status: "pending" | "running" | "completed" | "failed"
    sessionId: string
    createdAt: string
    startedAt: string | null
    finishedAt: string | null
    error: string | null
    result: AutoFollowResponse | AutoFollowFollowersResponse | null
  }
}

export async function getAutoFollowJobStatus(jobId: string) {
  return api.get<AutoFollowJobStatusResponse>(`/insta/auto-follow-jobs/${encodeURIComponent(jobId)}`)
}

export type InstaPreviewProfileResponse = {
  ok: true
  found: boolean
  username: string
  fullName: string | null
  profilePicUrl: string | null
  profileUrl: string
}

export async function getInstaPreviewProfile(username: string) {
  return api.get<InstaPreviewProfileResponse>("/insta/preview-profile", {
    params: { username },
  })
}

export type FollowsMetricsResponse = {
  ok: true
  days: number
  totals: {
    allTime: number
    inWindow: number
  }
  perDay: Array<{
    date: string
    count: number
  }>
  recent: Array<{
    username: string
    fullName: string | null
    profilePicUrl: string | null
    href: string | null
    instagramUserId: string | null
    followedByInstagramUsername: string | null
    isPrivate: boolean | null
    isVerified: boolean | null
    reason: string | null
    sessionId: string
    followedAt: string
  }>
}

export async function getFollowsMetrics(days = 30, sessionId?: string) {
  return api.get<FollowsMetricsResponse>("/insta/metrics/follows", {
    params: {
      days,
      ...(sessionId ? { sessionId } : {}),
    },
  })
}
