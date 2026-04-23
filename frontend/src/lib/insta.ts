import { api } from "./api"

/** Resposta de `POST /insta/open-login` com credenciais (chama `client.login` no backend). */
export type InstaLoginResponse = {
  ok: true
  headless: boolean
  success: boolean
  url: string
}

/**
 * Inicia o Chromium se necessário e submete o login no site do Instagram (Puppeteer no backend).
 */
export async function postInstaLogin(username: string, password: string) {
  return api.post<InstaLoginResponse>("/insta/open-login", { username, password })
}

export type InstaSessionItem = {
  id: string
  isActive: boolean
}

export type InstaSessionsResponse = {
  ok: true
  activeSessionId: string
  sessions: InstaSessionItem[]
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
  return api.post<AutoFollowResponse>("/insta/auto-follow", { quantity, privacyFilter })
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
  headless: boolean
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
  headless: boolean
  success: boolean
  conversationTitle: string
  url: string
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
  headless: boolean
  threadId: string
  count: number
  messages: MessageRow[]
  url: string
}

export async function getThreadMessages(threadId: string, limit = 30) {
  return api.get<ThreadMessagesResponse>("/insta/messages", {
    params: { threadId, limit },
  })
}

export type SendMessageResponse = {
  ok: true
  headless: boolean
  success: boolean
  conversationTitle: string
  text: string
  url: string
}

export async function postSendMessage(conversationTitle: string, text: string, dedicatedTab = false) {
  return api.post<SendMessageResponse>("/insta/messages", {
    conversationTitle,
    text,
    dedicatedTab,
  })
}
