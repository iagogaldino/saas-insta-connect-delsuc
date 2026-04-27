import { api } from "./api"

/** Resposta de `POST /insta/open-login` com credenciais (chama `client.login` no backend). */
export type InstaLoginResponse = {
  ok: true
  headless: boolean
  success: boolean
  url: string
  challengeRequired?: boolean
  challengeType?: "security_code" | "two_factor" | "unknown"
  message?: string
}

/**
 * Inicia o Chromium se necessário e submete o login no site do Instagram (Puppeteer no backend).
 */
export async function postInstaLogin(username: string, password: string) {
  return api.post<InstaLoginResponse>("/insta/open-login", { username, password })
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
  incomingWebhookUrl?: string | null
  incomingWebhookEnabled?: boolean
  incomingWebhookLastStatus?: "ok" | "error" | null
  incomingWebhookLastError?: string | null
  incomingWebhookLastSentAt?: string | null
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

export async function deleteInstaSession(sessionId: string) {
  return api.delete<InstaSessionsResponse>(`/insta/sessions/${encodeURIComponent(sessionId)}`)
}

export async function postStartInstaSessionRuntime(sessionId: string) {
  return api.post<InstaSessionsResponse>(`/insta/sessions/${encodeURIComponent(sessionId)}/runtime/start`)
}

export async function postStopInstaSessionRuntime(sessionId: string) {
  return api.post<InstaSessionsResponse>(`/insta/sessions/${encodeURIComponent(sessionId)}/runtime/stop`)
}

export type UpdateIncomingWebhookPayload = {
  incomingWebhookUrl: string
  incomingWebhookEnabled: boolean
}

export async function putInstaIncomingWebhookConfig(
  sessionId: string,
  payload: UpdateIncomingWebhookPayload,
) {
  return api.put<InstaSessionsResponse>(`/insta/sessions/${encodeURIComponent(sessionId)}/incoming-webhook`, payload)
}

export async function postInstaIncomingWebhookTest(sessionId: string) {
  return api.post<InstaSessionsResponse>(`/insta/sessions/${encodeURIComponent(sessionId)}/incoming-webhook/test`)
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

export async function getFollowsMetrics(days = 30) {
  return api.get<FollowsMetricsResponse>("/insta/metrics/follows", { params: { days } })
}

export type ConversationItem = {
  title: string
  preview: string
  href: string
}

export type ConversationsListResponse = {
  ok: true
  count: number
  limit: number
  conversations: ConversationItem[]
}

export async function getConversations(limit = 30) {
  return api.get<ConversationsListResponse>("/insta/conversations", {
    params: { limit },
  })
}

export function threadIdFromHref(href: string): string | null {
  const m = href.match(/\/direct\/t\/([^/?#]+)/i)
  return m ? m[1] : null
}

export type OpenConversationResponse = {
  ok: true
  conversationTitle: string
}

export async function postOpenConversation(conversationTitle: string, dedicatedTab = false) {
  return api.post<OpenConversationResponse>("/insta/open-conversation", {
    conversationTitle,
    dedicatedTab,
  })
}

export type MessageRow = {
  text: string
  sender: "me" | "other"
  timestamp: string | null
}

export type ThreadMessagesResponse = {
  ok: true
  threadId: string
  count: number
  messages: MessageRow[]
}

export async function getThreadMessages(threadId: string, limit = 30) {
  return api.get<ThreadMessagesResponse>("/insta/messages", {
    params: { threadId, limit },
  })
}

export type SendMessageResponse = {
  ok: true
  conversationTitle: string
  text: string
}

export async function postSendMessage(conversationTitle: string, text: string, dedicatedTab = false) {
  return api.post<SendMessageResponse>("/insta/messages", {
    conversationTitle,
    text,
    dedicatedTab,
  })
}
