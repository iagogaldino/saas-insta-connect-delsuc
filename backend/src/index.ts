import "dotenv/config";
import { createServer } from "node:http";
import { rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import express from "express";
import type { Request, Response } from "express";
import { createInstaConnect, type DmTapEvent, type InstaConnect } from "insta-connect-delsuc";
import { connectDatabase } from "./config/database";
import { env } from "./config/env";
import { UserModel } from "./modules/auth/user.model";
import { FollowHistoryModel } from "./modules/insta/follow-history.model";
import { FollowScheduleModel } from "./modules/insta/follow-schedule.model";
import { InstaSessionProfileModel } from "./modules/insta/session-profile.model";
import {
  computeNextRunAtZoned,
  dateKeyInTimeZone,
  FOLLOW_SCHEDULE_INTERVAL_MAX_MINUTES,
  FOLLOW_SCHEDULE_INTERVAL_MIN_MINUTES,
  isIntervalSchedule,
  normalizeIntervalMinutes,
  normalizeScheduleTimeZoneInput,
  resolveOneOffRunDateToExecuteZoned,
  resolveScheduleTimeZone,
} from "./modules/insta/follow-schedule-time";
import { authRoutes } from "./modules/auth/auth.routes";
import { requireAuth } from "./modules/auth/auth.middleware";
import { initInstaRealtime, type InstaRealtimeHandles } from "./realtime/insta-realtime";

const app = express();
const port = env.PORT;

/** Pasta do pacote backend (`src/` ou `dist/` → um nível acima = raiz do backend). `process.cwd()` varia com monorepo/npm e quebrava o caminho `.session/`. */
const BACKEND_ROOT = path.resolve(__dirname, "..");

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Insta-Session-Id");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

const headless = process.env.INSTA_HEADLESS === "1" || process.env.INSTA_HEADLESS === "true";
const disableChromeSandbox = env.INSTA_DISABLE_CHROME_SANDBOX;

function withInstaLaunchOptions(launch: { args?: string[]; slowMo?: number }) {
  const nextArgs = Array.isArray(launch.args) ? [...launch.args] : [];
  if (disableChromeSandbox) {
    if (!nextArgs.includes("--no-sandbox")) nextArgs.push("--no-sandbox");
    if (!nextArgs.includes("--disable-setuid-sandbox")) nextArgs.push("--disable-setuid-sandbox");
    if (!nextArgs.includes("--disable-dev-shm-usage")) nextArgs.push("--disable-dev-shm-usage");
  }
  return {
    ...launch,
    slowMo: 0,
    args: nextArgs,
  };
}

type InstaRuntime = {
  sessionId: string;
  client: InstaConnect;
  dmTapSseClients: Set<Response>;
  dmTapEnsurePromise: Promise<void> | null;
};

const instaRuntimes = new Map<string, InstaRuntime>();
const autoFollowJobs = new Map<string, AutoFollowJob>();

let instaRealtime: InstaRealtimeHandles | null = null;

function emitFollowScheduleTouch(userId: string, sessionId: string, reason: "executed" | "mutated"): void {
  instaRealtime?.emitFollowScheduleTouch(userId, sessionId, reason);
}

type UserSessionState = {
  sessionIds: string[];
  activeSessionId: string | null;
};

type InstagramPublicProfile = {
  fullName: string | null;
  profilePicUrl: string | null;
  found: boolean;
  /** `username` no payload da API (quando disponível). */
  resolvedUsername: string | null;
};

type IncomingWebhookStatus = "ok" | "error" | null;

type IncomingWebhookPayload = {
  event: "instagram.dm.received";
  sessionId: string;
  instagramUsername: string | null;
  threadId: string | null;
  messageText: string | null;
  senderUsername: string | null;
  receivedAt: string;
  raw: unknown;
};

type AutoFollowJobType = "suggested" | "followers";
type AutoFollowJobStatus = "pending" | "running" | "completed" | "failed";
type FollowScheduleStatus = "active" | "paused" | "completed";
type FollowScheduleFlowType = "suggested" | "followers";

type AutoFollowJob = {
  id: string;
  userId: string;
  sessionId: string;
  type: AutoFollowJobType;
  status: AutoFollowJobStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  result: unknown | null;
};

function logInstaAuth(event: string, meta?: Record<string, unknown>): void {
  const payload = meta ? ` ${JSON.stringify(meta)}` : "";
  console.log(`[${new Date().toISOString()}] [insta-auth] ${event}${payload}`);
}

function logFollowSchedule(event: string, meta?: Record<string, unknown>): void {
  const payload = meta ? ` ${JSON.stringify(meta)}` : "";
  console.log(`[${new Date().toISOString()}] [follow-schedule] ${event}${payload}`);
}

function resolveChallengeFromLoginResult(result: { url?: string; challengeRequired?: boolean; challengeType?: unknown }) {
  const explicitChallenge = result.challengeRequired === true;
  const url = String(result.url || "");
  const urlSuggestsChallenge =
    url.includes("/accounts/login/two_factor") ||
    url.includes("/accounts/two_factor") ||
    url.includes("/challenge/");
  const challengeRequired = explicitChallenge || urlSuggestsChallenge;
  const challengeType =
    typeof result.challengeType === "string" && result.challengeType
      ? result.challengeType
      : url.includes("two_factor")
        ? "two_factor"
        : url.includes("/challenge/")
          ? "security_code"
          : "unknown";
  return { challengeRequired, challengeType };
}

function uniqueSessionIds(items: Array<string | null | undefined>): string[] {
  return [...new Set(items.filter((item): item is string => typeof item === "string" && item.trim().length > 0))];
}

/** App id usado pelo Instagram Web (mesmo do site) — a API pública rejeita requests sem isso. */
const INSTAGRAM_WEB_APP_ID = "936619743392459";

function webProfileInfoRequestHeaders(usernameForReferer: string): Record<string, string> {
  const u = encodeURIComponent(usernameForReferer);
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7",
    "X-IG-App-ID": INSTAGRAM_WEB_APP_ID,
    "X-ASBD-ID": "198387",
    "X-IG-WWW-Claim": "0",
    Origin: "https://www.instagram.com",
    Referer: `https://www.instagram.com/${u}/`,
  };
}

type WebProfileInfoJson = {
  status?: string;
  message?: string;
  data?: {
    user?: {
      username?: string;
      full_name?: string;
      profile_pic_url_hd?: string;
      profile_pic_url?: string;
    } | null;
  };
};

async function fetchInstagramPublicProfile(username: string): Promise<InstagramPublicProfile> {
  const empty: InstagramPublicProfile = {
    fullName: null,
    profilePicUrl: null,
    found: false,
    resolvedUsername: null,
  };
  try {
    const response = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
      { headers: webProfileInfoRequestHeaders(username) },
    );
    if (!response.ok) {
      return empty;
    }
    const data = (await response.json()) as WebProfileInfoJson;
    if (data.status === "fail") {
      return empty;
    }
    const msg = typeof data.message === "string" ? data.message.toLowerCase() : "";
    if (msg.includes("user not found") || msg.includes("not found")) {
      return empty;
    }
    const user = data.data?.user;
    if (!user) {
      return empty;
    }
    return {
      fullName: typeof user.full_name === "string" ? user.full_name : null,
      profilePicUrl:
        typeof user.profile_pic_url_hd === "string"
          ? user.profile_pic_url_hd
          : typeof user.profile_pic_url === "string"
            ? user.profile_pic_url
            : null,
      found: true,
      resolvedUsername: typeof user.username === "string" ? user.username : null,
    };
  } catch {
    return empty;
  }
}

async function buildSessionsResponse(userId: string, state: UserSessionState) {
  const profiles = await InstaSessionProfileModel.find({
    userId,
    sessionId: { $in: state.sessionIds },
  })
    .select(
      "sessionId instagramUsername instagramFullName instagramProfilePicUrl requiresRelogin incomingWebhookUrl incomingWebhookEnabled incomingWebhookLastStatus incomingWebhookLastError incomingWebhookLastSentAt",
    )
    .lean();

  const bySession = new Map(profiles.map((profile) => [profile.sessionId, profile] as const));
  return {
    ok: true as const,
    activeSessionId: state.activeSessionId,
    sessions: state.sessionIds.map((id) => {
      const profile = bySession.get(id);
      return {
        id,
        isActive: id === state.activeSessionId,
        isRuntimeOn: instaRuntimes.has(id),
        instagramUsername: profile?.instagramUsername ?? null,
        instagramFullName: profile?.instagramFullName ?? null,
        instagramProfilePicUrl: profile?.instagramProfilePicUrl ?? null,
        requiresRelogin: Boolean(profile?.requiresRelogin),
        incomingWebhookUrl: profile?.incomingWebhookUrl ?? null,
        incomingWebhookEnabled: Boolean(profile?.incomingWebhookEnabled),
        incomingWebhookLastStatus: (profile?.incomingWebhookLastStatus as IncomingWebhookStatus) ?? null,
        incomingWebhookLastError: profile?.incomingWebhookLastError ?? null,
        incomingWebhookLastSentAt: profile?.incomingWebhookLastSentAt ?? null,
      };
    }),
  };
}

async function markSessionRequiresRelogin(userId: string, sessionId: string, reason: string): Promise<void> {
  await InstaSessionProfileModel.updateOne(
    { userId, sessionId },
    { $set: { requiresRelogin: true } },
    { upsert: false },
  ).catch(() => null);
  logInstaAuth("session:requires-relogin", { userId, sessionId, reason });
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

function isIncomingDmTapEvent(evt: DmTapEvent): boolean {
  const raw = evt as unknown as Record<string, unknown>;
  const direction = String(raw.direction ?? raw.messageDirection ?? raw.type ?? "").toLowerCase();
  const sender = String(raw.sender ?? "").toLowerCase();
  const isFromMe = raw.isFromMe;
  const isIncoming = raw.isIncoming;
  if (typeof isIncoming === "boolean") return isIncoming;
  if (typeof isFromMe === "boolean") return !isFromMe;
  if (sender === "me") return false;
  if (sender === "other") return true;
  if (direction.includes("outgoing") || direction === "me") return false;
  if (direction.includes("incoming") || direction.includes("received")) return true;
  return true;
}

function buildIncomingWebhookPayload(sessionId: string, instagramUsername: string | null, evt: DmTapEvent): IncomingWebhookPayload {
  const raw = evt as unknown as Record<string, unknown>;
  const senderObj =
    raw.sender && typeof raw.sender === "object" && raw.sender !== null
      ? (raw.sender as Record<string, unknown>)
      : null;
  return {
    event: "instagram.dm.received",
    sessionId,
    instagramUsername,
    threadId: pickString(raw.threadId, raw.thread_id, raw.conversationId, raw.chatId),
    messageText: pickString(raw.text, raw.message, raw.body, raw.content),
    senderUsername: pickString(raw.senderUsername, raw.fromUsername, raw.username, senderObj?.username),
    receivedAt: new Date().toISOString(),
    raw: evt,
  };
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function postIncomingWebhook(profileId: unknown, url: string, payload: IncomingWebhookPayload): Promise<void> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Webhook respondeu ${response.status} ${response.statusText}`);
    }
    await InstaSessionProfileModel.updateOne(
      { _id: profileId },
      {
        $set: {
          incomingWebhookLastStatus: "ok",
          incomingWebhookLastError: null,
          incomingWebhookLastSentAt: new Date(),
        },
      },
    ).catch(() => null);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await InstaSessionProfileModel.updateOne(
      { _id: profileId },
      {
        $set: {
          incomingWebhookLastStatus: "error",
          incomingWebhookLastError: message.slice(0, 500),
        },
      },
    ).catch(() => null);
  }
}

async function dispatchIncomingDmWebhook(sessionId: string, evt: DmTapEvent): Promise<void> {
  if (!isIncomingDmTapEvent(evt)) {
    return;
  }
  const profile = await InstaSessionProfileModel.findOne({ sessionId })
    .select("_id instagramUsername incomingWebhookUrl incomingWebhookEnabled")
    .lean();
  if (!profile?.incomingWebhookEnabled || !profile.incomingWebhookUrl) {
    return;
  }
  if (!isValidHttpUrl(profile.incomingWebhookUrl)) {
    await InstaSessionProfileModel.updateOne(
      { _id: profile._id },
      { $set: { incomingWebhookLastStatus: "error", incomingWebhookLastError: "URL de webhook inválida." } },
    ).catch(() => null);
    return;
  }
  const payload = buildIncomingWebhookPayload(sessionId, profile.instagramUsername ?? null, evt);
  await postIncomingWebhook(profile._id, profile.incomingWebhookUrl, payload);
}

async function isIncomingWebhookEnabledForSession(sessionId: string): Promise<boolean> {
  const profile = await InstaSessionProfileModel.findOne({ sessionId })
    .select("incomingWebhookEnabled incomingWebhookUrl")
    .lean();
  return Boolean(profile?.incomingWebhookEnabled && profile?.incomingWebhookUrl);
}

async function cleanupSessionFiles(sessionId: string): Promise<void> {
  const targets = [
    path.resolve(BACKEND_ROOT, ".session", sessionId),
    path.resolve(BACKEND_ROOT, "..", "..", "lib-insta-connect", ".session", sessionId),
  ];

  await Promise.all(
    targets.map(async (target) => {
      try {
        await rm(target, { recursive: true, force: true });
      } catch {
        // Ignore filesystem cleanup errors to avoid blocking API response.
      }
    }),
  );
}

async function getOrCreateUserSessionState(userId: string): Promise<UserSessionState> {
  type UserSessionStateRecord = {
    instaSessionIds?: string[] | null;
    // Legacy fields kept only for read + migration cleanup.
    instaSessionId?: string | null;
    activeInstaSessionId?: string | null;
  };

  const existing = (await UserModel.findById(userId)
    .select("instaSessionId instaSessionIds activeInstaSessionId")
    .lean()) as UserSessionStateRecord | null;
  if (!existing) {
    throw new Error("Authenticated user not found.");
  }

  const fromLegacy = typeof existing.instaSessionId === "string" ? existing.instaSessionId : null;
  const fromArray = Array.isArray(existing.instaSessionIds) ? existing.instaSessionIds : [];
  const activeCandidate =
    typeof existing.activeInstaSessionId === "string" ? existing.activeInstaSessionId : null;
  const withoutLegacy = uniqueSessionIds([...fromArray, fromLegacy]);
  const finalSessionIds =
    activeCandidate && withoutLegacy.includes(activeCandidate)
      ? uniqueSessionIds([activeCandidate, ...withoutLegacy])
      : withoutLegacy;
  const finalActiveSessionId = finalSessionIds[0] ?? null;

  const needsSync =
    finalSessionIds.length !== fromArray.length ||
    finalSessionIds.some((sessionId, index) => sessionId !== fromArray[index]) ||
    fromLegacy !== null ||
    existing.activeInstaSessionId !== undefined;

  if (needsSync) {
    await UserModel.updateOne(
      { _id: userId },
      {
        $set: {
          instaSessionIds: finalSessionIds,
        },
        $unset: {
          activeInstaSessionId: "",
          instaSessionId: "",
        },
      },
    );
  }

  return {
    sessionIds: finalSessionIds,
    activeSessionId: finalActiveSessionId,
  };
}

async function createUserSession(userId: string, setAsActive: boolean): Promise<UserSessionState> {
  const current = await getOrCreateUserSessionState(userId);
  const newSessionId = randomUUID();
  const nextSessionIds = setAsActive
    ? uniqueSessionIds([newSessionId, ...current.sessionIds])
    : uniqueSessionIds([...current.sessionIds, newSessionId]);
  const nextActiveSessionId = nextSessionIds[0] ?? null;

  await UserModel.updateOne(
    { _id: userId },
    {
      $set: {
        instaSessionIds: nextSessionIds,
      },
      $unset: {
        activeInstaSessionId: "",
        instaSessionId: "",
      },
    },
  );

  return {
    sessionIds: nextSessionIds,
    activeSessionId: nextActiveSessionId,
  };
}

async function setActiveUserSession(userId: string, sessionId: string): Promise<UserSessionState> {
  const current = await getOrCreateUserSessionState(userId);
  if (!current.sessionIds.includes(sessionId)) {
    throw new Error("SESSION_NOT_FOUND");
  }

  const sessionProfile = await InstaSessionProfileModel.findOne({ userId, sessionId })
    .select("instagramUsername")
    .lean();
  if (!sessionProfile?.instagramUsername) {
    throw new Error("SESSION_NOT_CONNECTED");
  }

  await UserModel.updateOne(
    { _id: userId },
    {
      $set: {
        instaSessionIds: [sessionId, ...current.sessionIds.filter((id) => id !== sessionId)],
      },
      $unset: {
        activeInstaSessionId: "",
        instaSessionId: "",
      },
    },
  );

  return {
    sessionIds: current.sessionIds,
    activeSessionId: sessionId,
  };
}

async function removeUserSession(userId: string, sessionId: string): Promise<UserSessionState> {
  const current = await getOrCreateUserSessionState(userId);
  if (!current.sessionIds.includes(sessionId)) {
    throw new Error("SESSION_NOT_FOUND");
  }

  const remaining = current.sessionIds.filter((id) => id !== sessionId);
  const nextSessionIds = remaining;
  const nextActiveSessionId = current.activeSessionId === sessionId ? (nextSessionIds[0] ?? null) : current.activeSessionId;

  await UserModel.updateOne(
    { _id: userId },
    {
      $set: {
        instaSessionIds: nextSessionIds,
      },
      $pull: {
        instaRestoreRuntimeSessionIds: sessionId,
      },
      $unset: {
        activeInstaSessionId: "",
        instaSessionId: "",
      },
    },
  );

  return {
    sessionIds: nextSessionIds,
    activeSessionId: nextActiveSessionId,
  };
}

function effectiveSessionIdsFromUserLean(u: {
  instaSessionIds?: string[] | null;
  instaSessionId?: string | null;
  activeInstaSessionId?: string | null;
}): string[] {
  const fromArray = Array.isArray(u.instaSessionIds) ? u.instaSessionIds : [];
  const fromLegacy = typeof u.instaSessionId === "string" ? u.instaSessionId : null;
  const fromActive = typeof u.activeInstaSessionId === "string" ? u.activeInstaSessionId : null;
  return uniqueSessionIds([...fromArray, fromLegacy, fromActive]);
}

async function markInstaRuntimeRestoreDesired(userId: string, sessionId: string): Promise<void> {
  const r = await UserModel.updateOne({ _id: userId }, { $addToSet: { instaRestoreRuntimeSessionIds: sessionId } });
  if (r.matchedCount === 0) {
    logInstaAuth("runtime:restore-flag:no-user", { userId, sessionId });
  }
}

async function clearInstaRuntimeRestoreDesired(userId: string, sessionId: string): Promise<void> {
  await UserModel.updateOne({ _id: userId }, { $pull: { instaRestoreRuntimeSessionIds: sessionId } });
}

type StartInstaRuntimeResult = {
  loginUrl: string;
  isInstagramAuthenticated: boolean;
  runtimeStatusMessage: string;
};

async function startInstaRuntimeForUser(userId: string, sessionId: string): Promise<StartInstaRuntimeResult> {
  const runtime = getOrCreateInstaRuntimeBySessionId(sessionId);
  await runtime.client.launch();
  const loginUrl = await runtime.client.openLoginPage();
  const isInstagramAuthenticated = !loginUrl.includes("/accounts/login");
  const runtimeStatusMessage = isInstagramAuthenticated
    ? "Instância ligada e sessão autenticada no Instagram."
    : "Instância ligada, mas esta sessão não está logada no Instagram.";
  if (!isInstagramAuthenticated) {
    await markSessionRequiresRelogin(userId, sessionId, "runtime_started_but_not_authenticated");
  }

  let webhookListenerStarted = false;
  let webhookListenerError: string | null = null;
  if (isInstagramAuthenticated) {
    const webhookEnabled = await isIncomingWebhookEnabledForSession(sessionId);
    if (webhookEnabled) {
      try {
        await ensureDmTapForSse(runtime);
        webhookListenerStarted = true;
      } catch (e) {
        webhookListenerError = e instanceof Error ? e.message : String(e);
        logInstaAuth("incoming-webhook:listener-start-failed", {
          userId,
          sessionId,
          error: webhookListenerError,
        });
      }
    }
  }

  const runtimeStatusParts = [runtimeStatusMessage];
  if (webhookListenerStarted) {
    runtimeStatusParts.push("Escuta de mensagens para webhook iniciada.");
  } else if (webhookListenerError) {
    runtimeStatusParts.push(`Falha ao iniciar escuta de webhook: ${webhookListenerError}`);
  }

  return {
    loginUrl,
    isInstagramAuthenticated,
    runtimeStatusMessage: runtimeStatusParts.join(" "),
  };
}

async function restorePersistedInstaRuntimes(): Promise<void> {
  logInstaAuth("runtime:boot-restore:begin", { backendRoot: BACKEND_ROOT });
  const users = await UserModel.find({
    $expr: { $gt: [{ $size: { $ifNull: ["$instaRestoreRuntimeSessionIds", []] } }, 0] },
  })
    .select("_id instaRestoreRuntimeSessionIds instaSessionIds instaSessionId activeInstaSessionId")
    .lean();

  logInstaAuth("runtime:boot-restore:users-matched", { count: users.length });

  for (const u of users) {
    const userId = String(u._id);
    const allowed = new Set(effectiveSessionIdsFromUserLean(u));
    const restoreList = u.instaRestoreRuntimeSessionIds ?? [];
    const stale = restoreList.filter((id) => !allowed.has(id));
    if (stale.length > 0) {
      await UserModel.updateOne({ _id: u._id }, { $pull: { instaRestoreRuntimeSessionIds: { $in: stale } } });
    }
    const toRestore = restoreList.filter((id) => allowed.has(id));
    for (const sessionId of toRestore) {
      if (instaRuntimes.has(sessionId)) {
        logInstaAuth("runtime:boot-restore:skip-already-in-memory", { userId, sessionId });
        continue;
      }
      try {
        logInstaAuth("runtime:boot-restore:start", { userId, sessionId });
        await startInstaRuntimeForUser(userId, sessionId);
        logInstaAuth("runtime:boot-restore:ok", { userId, sessionId });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        logInstaAuth("runtime:boot-restore:failed", { userId, sessionId, error: message });
      }
    }
  }

  if (users.length === 0) {
    logInstaAuth("runtime:boot-restore:empty", {
      hint: "Nenhum id em instaRestoreRuntimeSessionIds. Chame POST /insta/sessions/:id/runtime/start ao menos uma vez após deploy para gravar a preferência.",
    });
  }
}

async function getInstaRuntimeForRequest(req: Request): Promise<InstaRuntime> {
  const userId = req.authUser?.id;
  if (!userId) {
    throw new Error("Authenticated user missing in request.");
  }

  const state = await getOrCreateUserSessionState(userId);
  const headerSessionId =
    typeof req.header("x-insta-session-id") === "string" ? req.header("x-insta-session-id")?.trim() : "";
  const querySessionId = typeof req.query.sessionId === "string" ? req.query.sessionId.trim() : "";
  const requestedSessionId = headerSessionId || querySessionId || "";
  if (requestedSessionId && !state.sessionIds.includes(requestedSessionId)) {
    throw new Error("SESSION_NOT_FOUND");
  }
  const sessionId = requestedSessionId || state.activeSessionId;
  if (!sessionId) {
    throw new Error("NO_ACTIVE_SESSION");
  }
  return getOrCreateInstaRuntimeBySessionId(sessionId);
}

function getOrCreateInstaRuntimeBySessionId(sessionId: string): InstaRuntime {
  const existingRuntime = instaRuntimes.get(sessionId);
  if (existingRuntime) {
    return existingRuntime;
  }

  const runtime: InstaRuntime = {
    sessionId,
    client: createInstaConnect(
      {
        basePath: BACKEND_ROOT,
        // Sessão dedicada por usuário, persistida em disco para próximos logins.
        sessionDir: `.session/${sessionId}/chrome-profile`,
        seenMessagesFile: `.session/${sessionId}/seen-message-ids.json`,
        headless,
      },
      (launch) => withInstaLaunchOptions(launch),
    ),
    dmTapSseClients: new Set<Response>(),
    dmTapEnsurePromise: null,
  };
  instaRuntimes.set(sessionId, runtime);
  return runtime;
}

async function tryGetActiveInstaClient(req: Request): Promise<InstaConnect | null> {
  const userId = req.authUser?.id;
  if (!userId) {
    return null;
  }
  const state = await getOrCreateUserSessionState(userId);
  if (!state.activeSessionId) {
    return null;
  }
  return getOrCreateInstaRuntimeBySessionId(state.activeSessionId).client;
}

/**
 * Se a API pública bloquear, usa a busca do Instagram logado (mesma sessão do `searchUsers`,
 * requer browser/sessão ok). Foto pode vir vazia — os tipos do resultado de busca não trazem sempre.
 */
async function tryInstaSearchProfilePreview(
  client: InstaConnect,
  username: string,
): Promise<InstagramPublicProfile | null> {
  const normalized = username.toLowerCase();
  try {
    const result = await client.searchUsers(username, { limit: 40 });
    const u = result.users.find((x) => x.username.toLowerCase() === normalized);
    if (!u) {
      return null;
    }
    const extra = u as { profilePicUrl?: string };
    return {
      found: true,
      fullName: u.fullName?.trim() ? u.fullName : null,
      profilePicUrl: typeof extra.profilePicUrl === "string" ? extra.profilePicUrl : null,
      resolvedUsername: u.username,
    };
  } catch {
    return null;
  }
}

async function getInstaRuntimeOrSendError(req: Request, res: Response): Promise<InstaRuntime | null> {
  try {
    return await getInstaRuntimeForRequest(req);
  } catch (e) {
    if (e instanceof Error && e.message === "NO_ACTIVE_SESSION") {
      res.status(400).json({ ok: false, error: "Nenhuma sessão ativa. Crie uma nova sessão." });
      return null;
    }
    if (e instanceof Error && e.message === "SESSION_NOT_FOUND") {
      res.status(404).json({ ok: false, error: "Sessão não encontrada para este usuário." });
      return null;
    }
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
    return null;
  }
}

function writeSse(res: Response, event: string, payload: unknown) {
  if (res.writableEnded) return;
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcastDmTap(runtime: InstaRuntime, evt: DmTapEvent) {
  void dispatchIncomingDmWebhook(runtime.sessionId, evt);
  for (const r of runtime.dmTapSseClients) {
    if (r.writableEnded) {
      runtime.dmTapSseClients.delete(r);
      continue;
    }
    try {
      writeSse(r, "dmtap", evt);
    } catch {
      runtime.dmTapSseClients.delete(r);
    }
  }
}

async function ensureDmTapForSse(runtime: InstaRuntime) {
  const client = runtime.client;
  if (client.isDmTapActive()) return;
  if (runtime.dmTapEnsurePromise) {
    await runtime.dmTapEnsurePromise;
    return;
  }
  runtime.dmTapEnsurePromise = (async () => {
    if (client.isDmTapActive()) return;
    await client.startDmTap((evt) => broadcastDmTap(runtime, evt), undefined);
  })();
  try {
    await runtime.dmTapEnsurePromise;
  } finally {
    runtime.dmTapEnsurePromise = null;
  }
}

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/auth", authRoutes);
app.use("/insta", requireAuth);

app.get("/insta/sessions", async (req, res) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ ok: false, error: "Unauthorized." });
      return;
    }
    const state = await getOrCreateUserSessionState(userId);
    res.json(await buildSessionsResponse(userId, state));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

app.post("/insta/sessions", async (req, res) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ ok: false, error: "Unauthorized." });
      return;
    }
    const setAsActive = req.body?.setAsActive !== false;
    const state = await createUserSession(userId, setAsActive);
    res.status(201).json(await buildSessionsResponse(userId, state));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

app.patch("/insta/sessions/active", async (req, res) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ ok: false, error: "Unauthorized." });
      return;
    }
    const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
    if (!sessionId) {
      res.status(400).json({ ok: false, error: "sessionId é obrigatório." });
      return;
    }
    const state = await setActiveUserSession(userId, sessionId);
    res.json(await buildSessionsResponse(userId, state));
  } catch (e) {
    if (e instanceof Error && e.message === "SESSION_NOT_FOUND") {
      res.status(404).json({ ok: false, error: "Sessão não encontrada para este usuário." });
      return;
    }
    if (e instanceof Error && e.message === "SESSION_NOT_CONNECTED") {
      res.status(409).json({ ok: false, error: "Sessão sem Instagram conectado. Conecte antes de usar." });
      return;
    }
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

app.post("/insta/sessions/:sessionId/runtime/start", async (req, res) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ ok: false, error: "Unauthorized." });
      return;
    }

    const sessionId = typeof req.params.sessionId === "string" ? req.params.sessionId.trim() : "";
    if (!sessionId) {
      res.status(400).json({ ok: false, error: "sessionId é obrigatório." });
      return;
    }

    const state = await getOrCreateUserSessionState(userId);
    if (!state.sessionIds.includes(sessionId)) {
      res.status(404).json({ ok: false, error: "Sessão não encontrada para este usuário." });
      return;
    }

    const { loginUrl, isInstagramAuthenticated, runtimeStatusMessage } = await startInstaRuntimeForUser(
      userId,
      sessionId,
    );
    await markInstaRuntimeRestoreDesired(userId, sessionId);

    res.json({
      ...(await buildSessionsResponse(userId, state)),
      isInstagramAuthenticated,
      runtimeStatusMessage,
      loginUrl,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

app.post("/insta/sessions/:sessionId/runtime/stop", async (req, res) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ ok: false, error: "Unauthorized." });
      return;
    }

    const sessionId = typeof req.params.sessionId === "string" ? req.params.sessionId.trim() : "";
    if (!sessionId) {
      res.status(400).json({ ok: false, error: "sessionId é obrigatório." });
      return;
    }

    const state = await getOrCreateUserSessionState(userId);
    if (!state.sessionIds.includes(sessionId)) {
      res.status(404).json({ ok: false, error: "Sessão não encontrada para este usuário." });
      return;
    }

    const runtime = instaRuntimes.get(sessionId);
    if (runtime) {
      try {
        runtime.client.stopDmTap();
      } catch {
        // noop
      }
      await runtime.client.close().catch(() => null);
      instaRuntimes.delete(sessionId);
    }

    await clearInstaRuntimeRestoreDesired(userId, sessionId);

    res.json({
      ...(await buildSessionsResponse(userId, state)),
      isInstagramAuthenticated: false,
      runtimeStatusMessage: "Instância desligada com sucesso.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

app.put("/insta/sessions/:sessionId/incoming-webhook", async (req, res) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ ok: false, error: "Unauthorized." });
      return;
    }

    const sessionId = typeof req.params.sessionId === "string" ? req.params.sessionId.trim() : "";
    if (!sessionId) {
      res.status(400).json({ ok: false, error: "sessionId é obrigatório." });
      return;
    }

    const state = await getOrCreateUserSessionState(userId);
    if (!state.sessionIds.includes(sessionId)) {
      res.status(404).json({ ok: false, error: "Sessão não encontrada para este usuário." });
      return;
    }

    const incomingWebhookUrlRaw =
      typeof req.body?.incomingWebhookUrl === "string" ? req.body.incomingWebhookUrl.trim() : "";
    const incomingWebhookEnabled = req.body?.incomingWebhookEnabled === true;
    const incomingWebhookUrl = incomingWebhookUrlRaw.length > 0 ? incomingWebhookUrlRaw : null;
    if (incomingWebhookUrl && !isValidHttpUrl(incomingWebhookUrl)) {
      res.status(400).json({ ok: false, error: "incomingWebhookUrl deve ser uma URL http(s) válida." });
      return;
    }

    await InstaSessionProfileModel.updateOne(
      { userId, sessionId },
      {
        $set: {
          incomingWebhookUrl,
          incomingWebhookEnabled: incomingWebhookEnabled && Boolean(incomingWebhookUrl),
          incomingWebhookLastStatus: null,
          incomingWebhookLastError: null,
        },
      },
      { upsert: true },
    );

    res.json(await buildSessionsResponse(userId, state));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

app.post("/insta/sessions/:sessionId/incoming-webhook/test", async (req, res) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ ok: false, error: "Unauthorized." });
      return;
    }

    const sessionId = typeof req.params.sessionId === "string" ? req.params.sessionId.trim() : "";
    if (!sessionId) {
      res.status(400).json({ ok: false, error: "sessionId é obrigatório." });
      return;
    }

    const state = await getOrCreateUserSessionState(userId);
    if (!state.sessionIds.includes(sessionId)) {
      res.status(404).json({ ok: false, error: "Sessão não encontrada para este usuário." });
      return;
    }

    const profile = await InstaSessionProfileModel.findOne({ userId, sessionId })
      .select("_id instagramUsername incomingWebhookUrl incomingWebhookEnabled")
      .lean();
    if (!profile?.incomingWebhookEnabled || !profile.incomingWebhookUrl) {
      res.status(409).json({ ok: false, error: "Webhook da sessão está desabilitado ou sem URL configurada." });
      return;
    }
    if (!isValidHttpUrl(profile.incomingWebhookUrl)) {
      res.status(400).json({ ok: false, error: "incomingWebhookUrl inválida." });
      return;
    }

    const payload: IncomingWebhookPayload = {
      event: "instagram.dm.received",
      sessionId,
      instagramUsername: profile.instagramUsername ?? null,
      threadId: "test-thread",
      messageText: "Mensagem de teste do webhook da sessão Instagram.",
      senderUsername: "instagram-test-user",
      receivedAt: new Date().toISOString(),
      raw: {
        kind: "test",
        note: "Evento de teste disparado manualmente pela API.",
      },
    };

    await postIncomingWebhook(profile._id, profile.incomingWebhookUrl, payload);
    res.json({
      ...(await buildSessionsResponse(userId, state)),
      webhookTest: { ok: true, sentAt: payload.receivedAt },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

app.post("/insta/sessions/:sessionId/connect-login", async (req, res) => {
  try {
    const userId = req.authUser?.id;
    const sessionId = typeof req.params.sessionId === "string" ? req.params.sessionId.trim() : "";
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    logInstaAuth("connect-login:start", {
      userId,
      sessionId,
      username,
      passwordProvided: Boolean(password),
      passwordLength: password.length,
    });

    if (!userId) {
      logInstaAuth("connect-login:unauthorized", { sessionId, username });
      res.status(401).json({ ok: false, error: "Unauthorized." });
      return;
    }
    if (!sessionId || !username || !password) {
      logInstaAuth("connect-login:bad-request", {
        userId,
        sessionId,
        username,
        hasPassword: Boolean(password),
      });
      res.status(400).json({ ok: false, error: "sessionId, username e password são obrigatórios." });
      return;
    }

    const state = await getOrCreateUserSessionState(userId);
    if (!state.sessionIds.includes(sessionId)) {
      logInstaAuth("connect-login:session-not-found", { userId, sessionId, username });
      res.status(404).json({ ok: false, error: "Sessão não encontrada para este usuário." });
      return;
    }

    const runtime = getOrCreateInstaRuntimeBySessionId(sessionId);
    const result = await runtime.client.login(username, password);
    const challengeInfo = resolveChallengeFromLoginResult(result as any);
    const challengeRequired = challengeInfo.challengeRequired;
    logInstaAuth("connect-login:result", {
      userId,
      sessionId,
      username,
      success: result.success,
      challengeRequired,
      challengeType: challengeInfo.challengeType,
      url: result.url,
      message: (result as any)?.message,
    });
    if (challengeRequired) {
      await markSessionRequiresRelogin(userId, sessionId, "challenge_required_on_login");
      res.json({
        ok: true,
        headless,
        ...result,
        challengeRequired: true,
        challengeType: challengeInfo.challengeType,
        activeSessionId: sessionId,
      });
      return;
    }
    if (!result.success) {
      res.status(409).json({ ok: false, error: "Instagram não confirmou o login para esta sessão.", ...result });
      return;
    }

    const profile = await fetchInstagramPublicProfile(username.toLowerCase());
    await InstaSessionProfileModel.updateOne(
      { userId, sessionId },
      {
        $set: {
          instagramUsername: username.toLowerCase(),
          instagramFullName: profile.fullName,
          instagramProfilePicUrl: profile.profilePicUrl,
          lastLoginAt: new Date(),
          requiresRelogin: false,
        },
      },
      { upsert: true },
    );

    await setActiveUserSession(userId, sessionId);
    logInstaAuth("connect-login:completed", { userId, sessionId, username });
    res.json({ ok: true, headless, ...result, activeSessionId: sessionId });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logInstaAuth("connect-login:error", { error: message });
    res.status(500).json({ ok: false, error: message });
  }
});

app.post("/insta/sessions/:sessionId/submit-security-code", async (req, res) => {
  try {
    const userId = req.authUser?.id;
    const sessionId = typeof req.params.sessionId === "string" ? req.params.sessionId.trim() : "";
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    const username = typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : "";
    logInstaAuth("submit-security-code:start", {
      userId,
      sessionId,
      username,
      codeProvided: Boolean(code),
      codeLength: code.length,
    });

    if (!userId) {
      logInstaAuth("submit-security-code:unauthorized", { sessionId, username });
      res.status(401).json({ ok: false, error: "Unauthorized." });
      return;
    }
    if (!sessionId || !code || !username) {
      logInstaAuth("submit-security-code:bad-request", {
        userId,
        sessionId,
        username,
        hasCode: Boolean(code),
      });
      res.status(400).json({ ok: false, error: "sessionId, code e username são obrigatórios." });
      return;
    }

    const state = await getOrCreateUserSessionState(userId);
    if (!state.sessionIds.includes(sessionId)) {
      logInstaAuth("submit-security-code:session-not-found", { userId, sessionId, username });
      res.status(404).json({ ok: false, error: "Sessão não encontrada para este usuário." });
      return;
    }

    const runtime = getOrCreateInstaRuntimeBySessionId(sessionId);
    const submitSecurityCode = (runtime.client as any)?.submitSecurityCode;
    if (typeof submitSecurityCode !== "function") {
      logInstaAuth("submit-security-code:not-supported", { userId, sessionId, username });
      res.status(409).json({
        ok: false,
        error:
          "A versão atual da biblioteca insta-connect-delsuc não suporta submitSecurityCode. Atualize a lib para uma versão com suporte a 2FA.",
      });
      return;
    }
    const result = await submitSecurityCode.call(runtime.client, code);
    logInstaAuth("submit-security-code:result", {
      userId,
      sessionId,
      username,
      success: Boolean(result?.success),
      challengeRequired: Boolean(result?.challengeRequired),
      challengeType: result?.challengeType,
      url: result?.url,
      message: result?.message,
    });

    if (result.success) {
      const profile = await fetchInstagramPublicProfile(username);
      await InstaSessionProfileModel.updateOne(
        { userId, sessionId },
        {
          $set: {
            instagramUsername: username,
            instagramFullName: profile.fullName,
            instagramProfilePicUrl: profile.profilePicUrl,
            lastLoginAt: new Date(),
            requiresRelogin: false,
          },
        },
        { upsert: true },
      );
      await setActiveUserSession(userId, sessionId);
      logInstaAuth("submit-security-code:completed", { userId, sessionId, username });
    }

    res.json({ ok: true, headless, ...result, activeSessionId: sessionId });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logInstaAuth("submit-security-code:error", { error: message });
    res.status(500).json({ ok: false, error: message });
  }
});

app.delete("/insta/sessions/:sessionId", async (req, res) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ ok: false, error: "Unauthorized." });
      return;
    }

    const sessionId = typeof req.params.sessionId === "string" ? req.params.sessionId.trim() : "";
    if (!sessionId) {
      res.status(400).json({ ok: false, error: "sessionId é obrigatório." });
      return;
    }

    const state = await removeUserSession(userId, sessionId);
    await InstaSessionProfileModel.deleteOne({ userId, sessionId }).catch(() => null);

    const runtime = instaRuntimes.get(sessionId);
    if (runtime) {
      try {
        runtime.client.stopDmTap();
      } catch {
        // ignore cleanup failures
      }
      await runtime.client.close().catch(() => null);
      instaRuntimes.delete(sessionId);
    }
    await cleanupSessionFiles(sessionId);

    res.json(await buildSessionsResponse(userId, state));
  } catch (e) {
    if (e instanceof Error && e.message === "SESSION_NOT_FOUND") {
      res.status(404).json({ ok: false, error: "Sessão não encontrada para este usuário." });
      return;
    }
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

app.get("/insta/metrics/follows", async (req, res) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ ok: false, error: "Unauthorized." });
      return;
    }

    const rawDays = typeof req.query.days === "string" ? parseInt(req.query.days, 10) : 30;
    const days = Number.isFinite(rawDays) ? Math.min(Math.max(rawDays, 1), 365) : 30;
    const sessionIdForRecent =
      typeof req.query.sessionId === "string" && req.query.sessionId.trim() ? req.query.sessionId.trim() : "";
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    const recentFilter: { userId: string; sessionId?: string } = { userId };
    if (sessionIdForRecent) {
      recentFilter.sessionId = sessionIdForRecent;
    }

    const [totalAllTime, totalInWindow, perDayRaw, lastFollows] = await Promise.all([
      FollowHistoryModel.countDocuments({ userId }),
      FollowHistoryModel.countDocuments({ userId, followedAt: { $gte: since } }),
      FollowHistoryModel.aggregate<{
        _id: string;
        count: number;
      }>([
        { $match: { userId, followedAt: { $gte: since } } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$followedAt",
              },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      FollowHistoryModel.find(recentFilter)
        .sort({ followedAt: -1 })
        .limit(sessionIdForRecent ? 50 : 20)
        .lean(),
    ]);

    const dayMap = new Map(perDayRaw.map((item) => [item._id, item.count] as const));
    const perDay: Array<{ date: string; count: number }> = [];
    for (let i = 0; i < days; i += 1) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      perDay.push({ date: key, count: dayMap.get(key) ?? 0 });
    }

    res.json({
      ok: true,
      days,
      totals: {
        allTime: totalAllTime,
        inWindow: totalInWindow,
      },
      perDay,
      recent: lastFollows.map((item) => ({
        username: item.username,
        fullName: item.fullName,
        profilePicUrl: item.profilePicUrl,
        href: item.href,
        instagramUserId: item.instagramUserId,
        followedByInstagramUsername: item.followedByInstagramUsername,
        isPrivate: item.isPrivate,
        isVerified: item.isVerified,
        reason: item.reason,
        sessionId: item.sessionId,
        followedAt: item.followedAt,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

/**
 * Dados do perfil para confirmar o @ antes de `auto-follow-followers`.
 * 1) `web_profile_info` com cabeçalhos de navegador (igual ao site) — o Instagram rejeita requests mínimas.
 * 2) Se falhar, tenta a busca logada via sessão ativa (Puppeteer; pode abrir o Chromium na primeira chamada).
 */
app.get("/insta/preview-profile", async (req, res) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ ok: false, error: "Unauthorized." });
      return;
    }
    const raw = req.query.username;
    const input = typeof raw === "string" ? raw.replace(/^@+/g, "").trim() : "";
    if (!input) {
      res.status(400).json({ ok: false, error: "Query `username` é obrigatório." });
      return;
    }
    let profile = await fetchInstagramPublicProfile(input.toLowerCase());
    if (!profile.found) {
      const client = await tryGetActiveInstaClient(req);
      if (client) {
        const viaSearch = await tryInstaSearchProfilePreview(client, input);
        if (viaSearch) {
          profile = viaSearch;
        }
      }
    }
    const username = profile.resolvedUsername ?? input.toLowerCase();
    res.json({
      ok: true as const,
      found: profile.found,
      username,
      fullName: profile.fullName,
      profilePicUrl: profile.profilePicUrl,
      profileUrl: `https://www.instagram.com/${encodeURIComponent(username)}/`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

/** Confirma que a biblioteca está resolvida (sem abrir o Chromium). */
app.get("/test/insta-connect", (_req, res) => {
  res.json({
    ok: true,
    createInstaConnect: typeof createInstaConnect,
    hint: "Use POST /test/insta-connect/launch para subir e derrubar o Chromium (factory do README).",
  });
});

/**
 * Teste mínimo do README: `createInstaConnect` + `launch` + `close`.
 * A primeira execução pode demorar (download do Chromium pelo puppeteer).
 */
app.post("/test/insta-connect/launch", async (_req, res) => {
  const client = createInstaConnect(
    { basePath: BACKEND_ROOT, headless: true },
    (launch) => withInstaLaunchOptions(launch),
  );
  try {
    await client.launch();
    await client.close();
    res.json({ ok: true, message: "Chromium iniciou e fechou; integração básica OK." });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

/**
 * Body JSON opcional: `{ "username", "password" }` — chama `login()` (submissão do formulário).
 * Se os dois forem omitidos ou vazios, só chama `openLoginPage()`.
 * Reutiliza a mesma instância; `INSTA_HEADLESS=1` desativa a janela do Chrome.
 */
app.post("/insta/open-login", async (req, res) => {
  const runtime = await getInstaRuntimeOrSendError(req, res);
  if (!runtime) return;
  const client = runtime.client;
  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const hasUser = username.length > 0;
  const hasPass = password.length > 0;
  if (hasUser !== hasPass) {
    res.status(400).json({
      ok: false,
      error: "Inclua `username` e `password` juntos no JSON, ou envie body vazio `{}` para só abrir a tela de login.",
    });
    return;
  }
  try {
    if (hasUser && hasPass) {
      const userId = req.authUser?.id;
      const result = await client.login(username, password);
      const challengeInfo = resolveChallengeFromLoginResult(result as any);
      const challengeRequired = challengeInfo.challengeRequired;
      if (challengeRequired) {
        if (userId) {
          await markSessionRequiresRelogin(userId, runtime.sessionId, "challenge_required_on_open_login");
        }
        res.json({
          ok: true,
          headless,
          ...result,
          challengeRequired: true,
          challengeType: challengeInfo.challengeType,
        });
        return;
      }
      if (!result.success) {
        res.status(409).json({ ok: false, error: "Instagram não confirmou o login.", ...result });
        return;
      }
      if (userId) {
        const profile = await fetchInstagramPublicProfile(username.toLowerCase());
        await InstaSessionProfileModel.updateOne(
          { userId, sessionId: runtime.sessionId },
          {
            $set: {
              instagramUsername: username.toLowerCase(),
              instagramFullName: profile.fullName,
              instagramProfilePicUrl: profile.profilePicUrl,
              lastLoginAt: new Date(),
              requiresRelogin: false,
            },
          },
          { upsert: true },
        );
      }
      res.json({ ok: true, headless, ...result });
      return;
    }
    const url = await client.openLoginPage();
    res.json({ ok: true, url, headless });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const userId = req.authUser?.id;
    if (userId && /sess[aã]o n[aã]o autenticada/i.test(message)) {
      await markSessionRequiresRelogin(userId, runtime.sessionId, "auto_follow_not_authenticated");
    }
    res.status(500).json({ ok: false, error: message });
  }
});

/**
 * Body: `{ "conversationTitle", "dedicatedTab"?: boolean }` — abre a thread no Chromium (navegação /direct/t/...).
 * `conversationTitle` é o mesmo título visto em `listConversations` (ex.: nome da pessoa no inbox).
 */
app.post("/insta/open-conversation", async (req, res) => {
  const runtime = await getInstaRuntimeOrSendError(req, res);
  if (!runtime) return;
  const client = runtime.client;
  const conversationTitle =
    typeof req.body?.conversationTitle === "string" ? req.body.conversationTitle.trim() : "";
  if (!conversationTitle) {
    res.status(400).json({ ok: false, error: "conversationTitle é obrigatório." });
    return;
  }
  const dedicatedTab = req.body?.dedicatedTab === true;
  try {
    const result = await client.openConversationByTitle(conversationTitle, { dedicatedTab });
    res.json({ ok: true, conversationTitle: result.conversationTitle });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

/** `GET /insta/messages?threadId=...&limit=20` — mensagens visíveis na thread (Puppeteer no DOM). */
app.get("/insta/messages", async (req, res) => {
  const runtime = await getInstaRuntimeOrSendError(req, res);
  if (!runtime) return;
  const client = runtime.client;
  const raw = req.query.threadId;
  const threadId = typeof raw === "string" ? raw.trim() : "";
  if (!threadId) {
    res.status(400).json({ ok: false, error: "Query `threadId` é obrigatório." });
    return;
  }
  const limitParam = req.query.limit;
  let limit = 30;
  if (typeof limitParam === "string" && limitParam.length > 0) {
    const n = parseInt(limitParam, 10);
    if (!Number.isFinite(n) || n < 1 || n > 200) {
      res.status(400).json({ ok: false, error: "Query `limit` deve ser entre 1 e 200." });
      return;
    }
    limit = n;
  } else if (Array.isArray(limitParam)) {
    res.status(400).json({ ok: false, error: "Use um único parâmetro `limit`." });
    return;
  }
  try {
    const result = await client.listMessagesByThreadId(threadId, limit);
    res.json({ ok: true, threadId: result.threadId, count: result.count, messages: result.messages });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

/** `GET /insta/conversations?limit=20` — requer sessão autenticada (login prévio no mesmo processo). */
app.get("/insta/conversations", async (req, res) => {
  const runtime = await getInstaRuntimeOrSendError(req, res);
  if (!runtime) return;
  const client = runtime.client;
  const limitParam = req.query.limit;
  let limit = 20;
  if (typeof limitParam === "string" && limitParam.length > 0) {
    const n = parseInt(limitParam, 10);
    if (!Number.isFinite(n) || n < 1 || n > 200) {
      res.status(400).json({ ok: false, error: "Query `limit` deve ser um número entre 1 e 200." });
      return;
    }
    limit = n;
  } else if (Array.isArray(limitParam)) {
    res.status(400).json({ ok: false, error: "Use um único parâmetro `limit`." });
    return;
  }
  try {
    const conversations = await client.listConversations(limit);
    res.json({ ok: true, count: conversations.length, limit, conversations });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

/** `GET /insta/search-users?query=...&limit=20` — busca de usuários usando rede + DOM. */
app.get("/insta/search-users", async (req, res) => {
  const runtime = await getInstaRuntimeOrSendError(req, res);
  if (!runtime) return;
  const client = runtime.client;
  const rawQuery = req.query.query;
  const query = typeof rawQuery === "string" ? rawQuery.trim() : "";
  if (!query) {
    res.status(400).json({ ok: false, error: "Query `query` é obrigatória." });
    return;
  }

  const limitParam = req.query.limit;
  let limit = 20;
  if (typeof limitParam === "string" && limitParam.length > 0) {
    const n = parseInt(limitParam, 10);
    if (!Number.isFinite(n) || n < 1 || n > 100) {
      res.status(400).json({ ok: false, error: "Query `limit` deve ser um número entre 1 e 100." });
      return;
    }
    limit = n;
  } else if (Array.isArray(limitParam)) {
    res.status(400).json({ ok: false, error: "Use um único parâmetro `limit`." });
    return;
  }

  try {
    const result = await client.searchUsers(query, { limit });
    res.json({ ok: true, count: result.users.length, headless, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

/** `GET /insta/suggested-people?limit=20` — lista sugestões da aba Explore People. */
app.get("/insta/suggested-people", async (req, res) => {
  const runtime = await getInstaRuntimeOrSendError(req, res);
  if (!runtime) return;
  const client = runtime.client;
  const limitParam = req.query.limit;
  let limit = 20;
  if (typeof limitParam === "string" && limitParam.length > 0) {
    const n = parseInt(limitParam, 10);
    if (!Number.isFinite(n) || n < 1 || n > 100) {
      res.status(400).json({ ok: false, error: "Query `limit` deve ser um número entre 1 e 100." });
      return;
    }
    limit = n;
  } else if (Array.isArray(limitParam)) {
    res.status(400).json({ ok: false, error: "Use um único parâmetro `limit`." });
    return;
  }

  try {
    const result = await client.listSuggestedPeople({ limit });
    res.json({ ok: true, count: result.users.length, headless, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

function normalizePrivacyFilter(value: unknown): "any" | "public" | "private" | null {
  const privacyFilter =
    typeof value === "string" && value.trim().length > 0 ? value.trim().toLowerCase() : "any";
  if (!["any", "public", "private"].includes(privacyFilter)) {
    return null;
  }
  return privacyFilter as "any" | "public" | "private";
}

type FollowScheduleEntryInput = {
  date: string;
  quantity: number;
};

type FollowScheduleEntryWithDispatch = {
  date: string;
  quantity: number;
  dispatchedAt?: Date | null;
};

type FollowScheduleDocLike = {
  _id: { toString(): string };
  userId: string;
  sessionId: string;
  flowType: FollowScheduleFlowType;
  targetUsername?: string | null;
  privacyFilter: "any" | "public" | "private";
  entries: FollowScheduleEntryWithDispatch[];
  keepActive: boolean;
  weeklyDays: number[];
  runAtHour: number;
  runAtMinute: number;
  oneOffRemainingDates: string[];
  status: FollowScheduleStatus;
  nextRunAt?: Date | null;
  lastRunAt?: Date | null;
  recurrenceLastRunAt?: Date | null;
  intervalMinutes?: number | null;
  intervalFirstRunAt?: Date | null;
  scheduleTimeZone?: string | null;
  stopAfterTotalFollowed?: number | null;
  followedCountTotal?: number;
};

function parseEntryDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function normalizeScheduleEntries(input: unknown): FollowScheduleEntryInput[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  const dedupe = new Map<string, number>();
  for (const row of input) {
    if (!row || typeof row !== "object") return null;
    const item = row as Record<string, unknown>;
    const dateRaw = typeof item.date === "string" ? item.date : "";
    const quantity = Number(item.quantity);
    const parsedDate = parseEntryDate(dateRaw);
    if (!parsedDate || !Number.isFinite(quantity) || quantity < 1 || quantity > 100) {
      return null;
    }
    dedupe.set(dateRaw.trim(), Math.floor(quantity));
  }
  return [...dedupe.entries()]
    .map(([date, quantity]) => ({ date, quantity }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function normalizeWeeklyDays(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const all = value
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v >= 0 && v <= 6)
    .map((v) => Number(v));
  return [...new Set(all)].sort((a, b) => a - b);
}

function normalizeRunTime(value: unknown): { hour: number; minute: number } {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value.trim())) {
    return { hour: 10, minute: 0 };
  }
  const [h, m] = value.split(":").map((v) => Number(v));
  if (!Number.isInteger(h) || h < 0 || h > 23 || !Number.isInteger(m) || m < 0 || m > 59) {
    return { hour: 10, minute: 0 };
  }
  return { hour: h, minute: m };
}

function parseIntervalFirstRunAtIso(raw: unknown): Date | null {
  if (raw === null || raw === undefined || raw === "") {
    return null;
  }
  if (typeof raw !== "string") {
    return null;
  }
  const d = new Date(raw.trim());
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d;
}

function oneOffDatesFromEntries(entries: FollowScheduleEntryWithDispatch[]): string[] {
  return entries
    .filter((e) => !e.dispatchedAt)
    .map((e) => e.date)
    .sort((a, b) => a.localeCompare(b));
}

const STOP_AFTER_TOTAL_FOLLOWED_MAX = 1_000_000;

function pickStopAfterTotalFollowedFromBody(body: Record<string, unknown>): {
  value: number | null;
  error: string | null;
} {
  const key = "stopAfterTotalFollowed";
  if (!(key in body)) {
    return { value: null, error: null };
  }
  const raw = body[key];
  if (raw === null || raw === undefined || raw === "") {
    return { value: null, error: null };
  }
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) {
    return { value: null, error: "`stopAfterTotalFollowed` deve ser um número inteiro válido." };
  }
  const f = Math.floor(n);
  if (f < 1 || f > STOP_AFTER_TOTAL_FOLLOWED_MAX) {
    return {
      value: null,
      error: `\`stopAfterTotalFollowed\` deve estar entre 1 e ${STOP_AFTER_TOTAL_FOLLOWED_MAX}.`,
    };
  }
  return { value: f, error: null };
}

function isFollowScheduleCapSatisfied(schedule: FollowScheduleDocLike): boolean {
  const cap = schedule.stopAfterTotalFollowed;
  if (cap == null || typeof cap !== "number" || cap < 1) {
    return false;
  }
  return (schedule.followedCountTotal ?? 0) >= cap;
}

function followedCountFromAutoFollowJobResult(result: unknown): number {
  if (!result || typeof result !== "object") {
    return 0;
  }
  const f = Number((result as { followed?: unknown }).followed);
  if (!Number.isFinite(f)) {
    return 0;
  }
  return Math.max(0, Math.floor(f));
}

function pickIntervalMinutesFromBody(body: Record<string, unknown>): {
  value: number | null;
  error: string | null;
} {
  const key = "intervalMinutes";
  if (!(key in body)) {
    return { value: null, error: null };
  }
  const raw = body[key];
  if (raw === null || raw === undefined || raw === "") {
    return { value: null, error: null };
  }
  const n = normalizeIntervalMinutes(raw);
  if (n === null) {
    return {
      value: null,
      error: `\`intervalMinutes\` deve ser um inteiro ≥ ${FOLLOW_SCHEDULE_INTERVAL_MIN_MINUTES} (limite superior ${FOLLOW_SCHEDULE_INTERVAL_MAX_MINUTES} min).`,
    };
  }
  return { value: n, error: null };
}

function computeNextRunAt(schedule: FollowScheduleDocLike, from: Date): Date | null {
  return computeNextRunAtZoned(
    {
      intervalMinutes: schedule.intervalMinutes ?? null,
      intervalFirstRunAt: schedule.intervalFirstRunAt ?? null,
      recurrenceLastRunAt: schedule.recurrenceLastRunAt ?? null,
      lastRunAt: schedule.lastRunAt ?? null,
      keepActive: schedule.keepActive,
      weeklyDays: schedule.weeklyDays,
      runAtHour: schedule.runAtHour,
      runAtMinute: schedule.runAtMinute,
      oneOffRemainingDates: schedule.oneOffRemainingDates,
      entries: schedule.entries,
    },
    from,
    schedule.scheduleTimeZone,
  );
}

async function persistFollowHistory(userId: string, sessionId: string, items: Array<{
  username: string;
  userId?: string;
  isPrivate?: boolean;
  isVerified?: boolean | null;
  fullName?: string | null;
  href?: string | null;
  profilePicUrl?: string | null;
  reason?: string | null;
  success: boolean;
}>): Promise<void> {
  const sessionProfile = await InstaSessionProfileModel.findOne({ userId, sessionId })
    .select("instagramUsername")
    .lean();
  const followedRows = items
    .filter((item) => Boolean(item.success))
    .map((item) => ({
      userId,
      sessionId,
      username: item.username,
      fullName: item.fullName ?? null,
      profilePicUrl: item.profilePicUrl ?? null,
      href: item.href ?? null,
      instagramUserId: item.userId ?? null,
      followedByInstagramUsername: sessionProfile?.instagramUsername ?? null,
      isPrivate: typeof item.isPrivate === "boolean" ? item.isPrivate : null,
      isVerified: typeof item.isVerified === "boolean" ? item.isVerified : null,
      reason: item.reason ?? null,
      followedAt: new Date(),
    }));
  if (followedRows.length > 0) {
    await FollowHistoryModel.insertMany(followedRows, { ordered: false });
    for (const row of followedRows) {
      instaRealtime?.emitFollowOutboundSuccess(userId, {
        sessionId: row.sessionId,
        username: row.username,
        fullName: row.fullName,
        profilePicUrl: row.profilePicUrl,
        followedAt: row.followedAt.toISOString(),
      });
    }
  }
}

async function runAutoFollowSuggestedJob(userId: string, runtime: InstaRuntime, quantity: number, privacyFilter: "any" | "public" | "private") {
  const client = runtime.client;
  const result = await client.autoFollowSuggestedUsers(quantity, { privacyFilter });
  const suggested = await client.listSuggestedPeople({ limit: 200 }).catch(() => ({ users: [] as Array<{
    username: string;
    fullName: string;
    href: string;
    userId?: string;
    reason?: string;
    isVerified?: boolean;
    isPrivate?: boolean;
    profilePicUrl?: string;
  }> }));
  const byUsername = new Map(suggested.users.map((u) => [String(u.username || "").toLowerCase(), u] as const));
  const enrichedResults = result.results.map((item) => {
    const meta = byUsername.get(String(item.username || "").toLowerCase());
    return {
      ...item,
      fullName: meta?.fullName ?? null,
      href: meta?.href ?? null,
      profilePicUrl: meta?.profilePicUrl ?? null,
      isVerified: typeof meta?.isVerified === "boolean" ? meta.isVerified : null,
      reason: meta?.reason ?? null,
    };
  });
  await persistFollowHistory(userId, runtime.sessionId, enrichedResults);
  return { ok: true, ...result, results: enrichedResults };
}

async function runAutoFollowFollowersJob(
  userId: string,
  runtime: InstaRuntime,
  targetUsername: string,
  quantity: number,
  privacyFilter: "any" | "public" | "private",
) {
  const client = runtime.client;
  const result = await client.autoFollowFollowersOfUser(targetUsername, quantity, { privacyFilter });
  const enrichedResults = result.results.map((item) => {
    const uname = String(item.username || "").trim();
    return {
      ...item,
      fullName: null as string | null,
      href: uname ? `https://www.instagram.com/${uname}/` : null,
      profilePicUrl: null as string | null,
      isVerified: null as boolean | null,
      reason: null as string | null,
    };
  });
  await persistFollowHistory(userId, runtime.sessionId, enrichedResults);
  return { ok: true, ...result, results: enrichedResults };
}

function createAutoFollowJob(userId: string, sessionId: string, type: AutoFollowJobType): AutoFollowJob {
  const job: AutoFollowJob = {
    id: randomUUID(),
    userId,
    sessionId,
    type,
    status: "pending",
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    error: null,
    result: null,
  };
  autoFollowJobs.set(job.id, job);
  return job;
}

function runAutoFollowJobInBackground(job: AutoFollowJob, task: () => Promise<unknown>) {
  void (async () => {
    job.status = "running";
    job.startedAt = new Date().toISOString();
    try {
      job.result = await task();
      job.status = "completed";
    } catch (e) {
      job.status = "failed";
      job.error = e instanceof Error ? e.message : String(e);
    } finally {
      job.finishedAt = new Date().toISOString();
      instaRealtime?.emitAutofollowJobToSubscribers(job);
    }
  })();
}

/** `POST /insta/auto-follow` — cria job assíncrono de auto-follow por sugeridos. */
app.post("/insta/auto-follow", async (req, res) => {
  const runtime = await getInstaRuntimeOrSendError(req, res);
  if (!runtime) return;
  const userId = req.authUser?.id;
  if (!userId) {
    res.status(401).json({ ok: false, error: "Unauthorized." });
    return;
  }
  const quantity = Number(req.body?.quantity);
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 100) {
    res.status(400).json({ ok: false, error: "`quantity` deve ser um número entre 1 e 100." });
    return;
  }
  const privacyFilter = normalizePrivacyFilter(req.body?.privacyFilter);
  if (!privacyFilter) {
    res.status(400).json({ ok: false, error: "`privacyFilter` deve ser `any`, `public` ou `private`." });
    return;
  }

  const job = createAutoFollowJob(userId, runtime.sessionId, "suggested");
  runAutoFollowJobInBackground(job, () => runAutoFollowSuggestedJob(userId, runtime, quantity, privacyFilter));
  res.status(202).json({ ok: true, jobId: job.id, status: job.status, createdAt: job.createdAt });
});

/** `POST /insta/auto-follow-followers` — cria job assíncrono para seguidores de perfil. */
app.post("/insta/auto-follow-followers", async (req, res) => {
  const runtime = await getInstaRuntimeOrSendError(req, res);
  if (!runtime) return;
  const userId = req.authUser?.id;
  if (!userId) {
    res.status(401).json({ ok: false, error: "Unauthorized." });
    return;
  }
  const targetUsername = typeof req.body?.targetUsername === "string" ? req.body.targetUsername.trim() : "";
  if (!targetUsername) {
    res.status(400).json({ ok: false, error: "`targetUsername` é obrigatório (string não vazia)." });
    return;
  }
  const quantity = Number(req.body?.quantity);
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 100) {
    res.status(400).json({ ok: false, error: "`quantity` deve ser um número entre 1 e 100." });
    return;
  }
  const privacyFilter = normalizePrivacyFilter(req.body?.privacyFilter);
  if (!privacyFilter) {
    res.status(400).json({ ok: false, error: "`privacyFilter` deve ser `any`, `public` ou `private`." });
    return;
  }

  const job = createAutoFollowJob(userId, runtime.sessionId, "followers");
  runAutoFollowJobInBackground(job, () =>
    runAutoFollowFollowersJob(userId, runtime, targetUsername, quantity, privacyFilter),
  );
  res.status(202).json({ ok: true, jobId: job.id, status: job.status, createdAt: job.createdAt });
});

app.get("/insta/auto-follow-jobs/:jobId", async (req, res) => {
  const userId = req.authUser?.id;
  if (!userId) {
    res.status(401).json({ ok: false, error: "Unauthorized." });
    return;
  }
  const jobId = typeof req.params.jobId === "string" ? req.params.jobId.trim() : "";
  const job = autoFollowJobs.get(jobId);
  if (!job || job.userId !== userId) {
    res.status(404).json({ ok: false, error: "Job não encontrado." });
    return;
  }
  res.json({
    ok: true,
    job: {
      id: job.id,
      type: job.type,
      status: job.status,
      sessionId: job.sessionId,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      error: job.error,
      result: job.result,
    },
  });
});

function serializeFollowSchedule(item: {
  _id: { toString(): string };
  flowType: FollowScheduleFlowType;
  privacyFilter: "any" | "public" | "private";
  targetUsername?: string | null;
  status: FollowScheduleStatus;
  keepActive: boolean;
  weeklyDays: number[];
  runAtHour: number;
  runAtMinute: number;
  scheduleTimeZone?: string | null;
  intervalMinutes?: number | null;
  intervalFirstRunAt?: Date | null;
  entries: FollowScheduleEntryWithDispatch[];
  oneOffRemainingDates: string[];
  nextRunAt?: Date | null;
  lastRunAt?: Date | null;
  lastRunStatus?: string | null;
  lastRunError?: string | null;
  recurrenceLastRunAt?: Date | null;
  stopAfterTotalFollowed?: number | null;
  followedCountTotal?: number;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  const intervalMinutes =
    typeof item.intervalMinutes === "number" && item.intervalMinutes > 0 ? item.intervalMinutes : null;
  const stopCap =
    typeof item.stopAfterTotalFollowed === "number" && item.stopAfterTotalFollowed > 0
      ? Math.floor(item.stopAfterTotalFollowed)
      : null;
  const followedAccum = typeof item.followedCountTotal === "number" ? Math.max(0, Math.floor(item.followedCountTotal)) : 0;
  return {
    id: item._id.toString(),
    flowType: item.flowType,
    privacyFilter: item.privacyFilter,
    targetUsername: item.targetUsername ?? null,
    status: item.status,
    keepActive: item.keepActive,
    weeklyDays: item.weeklyDays,
    runTime: `${String(item.runAtHour).padStart(2, "0")}:${String(item.runAtMinute).padStart(2, "0")}`,
    timeZone: resolveScheduleTimeZone(item.scheduleTimeZone),
    intervalMinutes,
    intervalFirstRunAt: item.intervalFirstRunAt ? new Date(item.intervalFirstRunAt).toISOString() : null,
    entries: item.entries.map((e) => {
      const at = e.dispatchedAt;
      return {
        date: e.date,
        quantity: e.quantity,
        dispatchedAt: at ? new Date(at).toISOString() : null,
        dispatched: Boolean(at),
      };
    }),
    oneOffRemainingDates: item.oneOffRemainingDates,
    nextRunAt: item.nextRunAt?.toISOString() ?? null,
    lastRunAt: item.lastRunAt?.toISOString() ?? null,
    lastRunStatus: item.lastRunStatus ?? null,
    lastRunError: item.lastRunError ?? null,
    recurrenceLastRunAt: item.recurrenceLastRunAt ? new Date(item.recurrenceLastRunAt).toISOString() : null,
    stopAfterTotalFollowed: stopCap,
    followedCountTotal: followedAccum,
    createdAt: item.createdAt?.toISOString() ?? null,
    updatedAt: item.updatedAt?.toISOString() ?? null,
  };
}

async function executeSingleFollowSchedule(schedule: FollowScheduleDocLike): Promise<void> {
  const scheduleId = schedule._id.toString();

  if (isFollowScheduleCapSatisfied(schedule)) {
    logFollowSchedule("execute:skip-cap-already-met", {
      scheduleId,
      followedCountTotal: schedule.followedCountTotal ?? 0,
      stopAfterTotalFollowed: schedule.stopAfterTotalFollowed ?? null,
    });
    await FollowScheduleModel.updateOne(
      { _id: schedule._id },
      { $set: { status: "completed", nextRunAt: null, lockedAt: null, lockOwner: null } },
    );
    emitFollowScheduleTouch(schedule.userId, schedule.sessionId, "executed");
    return;
  }

  const runtime = getOrCreateInstaRuntimeBySessionId(schedule.sessionId);
  const now = new Date();
  const intervalMode = isIntervalSchedule(schedule);

  let runDate: string;
  let quantity: number;

  if (intervalMode) {
    const first = schedule.entries[0];
    if (!first || first.quantity < 1 || first.quantity > 100) {
      logFollowSchedule("execute:skip-no-quantity", {
        scheduleId,
        intervalMode: true,
        sessionId: schedule.sessionId,
      });
      throw new Error("Modo intervalo: é necessário ao menos uma entrada com quantity entre 1 e 100.");
    }
    quantity = first.quantity;
    runDate = dateKeyInTimeZone(now, schedule.scheduleTimeZone);
  } else if (schedule.keepActive) {
    runDate = dateKeyInTimeZone(now, schedule.scheduleTimeZone);
    const todayEntry = schedule.entries.find((e) => e.date === runDate);
    const fromEntry = todayEntry ?? schedule.entries[0];
    if (!fromEntry || fromEntry.quantity < 1 || fromEntry.quantity > 100) {
      logFollowSchedule("execute:skip-no-quantity", { scheduleId, runDate, keepActive: true, sessionId: schedule.sessionId });
      throw new Error(`Sem quantidade válida no agendamento recorrente para a data ${runDate}.`);
    }
    quantity = fromEntry.quantity;
  } else {
    const resolved = resolveOneOffRunDateToExecuteZoned(schedule, now, schedule.scheduleTimeZone);
    if (!resolved) {
      logFollowSchedule("execute:skip-nothing-due", { scheduleId, sessionId: schedule.sessionId });
      throw new Error("Nenhum slot one-off pendente (sem atraso ou já disparado).");
    }
    runDate = resolved;
    const entry = schedule.entries.find((e) => e.date === runDate);
    quantity = entry?.quantity ?? 0;
    if (quantity < 1 || quantity > 100) {
      throw new Error(`Quantidade inválida para a data ${runDate}.`);
    }
  }

  logFollowSchedule("execute:start", {
    scheduleId,
    flowType: schedule.flowType,
    sessionId: schedule.sessionId,
    runDate,
    keepActive: schedule.keepActive,
    intervalMode,
    quantity,
    targetUsername: schedule.targetUsername ?? null,
  });

  const job = createAutoFollowJob(schedule.userId, schedule.sessionId, schedule.flowType);
  job.status = "running";
  job.startedAt = now.toISOString();

  let runError: string | null = null;
  try {
    if (schedule.flowType === "suggested") {
      job.result = await runAutoFollowSuggestedJob(schedule.userId, runtime, quantity, schedule.privacyFilter);
    } else {
      const target = String(schedule.targetUsername ?? "").trim();
      if (!target) {
        throw new Error("Agenda de seguidores sem targetUsername.");
      }
      job.result = await runAutoFollowFollowersJob(schedule.userId, runtime, target, quantity, schedule.privacyFilter);
    }
    job.status = "completed";
  } catch (e) {
    job.status = "failed";
    runError = e instanceof Error ? e.message : String(e);
    job.error = runError;
  } finally {
    job.finishedAt = new Date().toISOString();
  }

  const success = !runError;
  const nextEntries: FollowScheduleEntryWithDispatch[] = schedule.entries.map((e) => {
    if (!schedule.keepActive && !intervalMode && success && e.date === runDate) {
      return { ...e, dispatchedAt: new Date() };
    }
    return { ...e };
  });

  const nextOneOff = intervalMode
    ? schedule.oneOffRemainingDates
    : schedule.keepActive
      ? schedule.oneOffRemainingDates
      : success
        ? schedule.oneOffRemainingDates.filter((d) => d !== runDate)
        : schedule.oneOffRemainingDates;

  const justAfter = new Date();
  const followedThisRun = success ? followedCountFromAutoFollowJobResult(job.result) : 0;
  const newFollowedTotal = Math.max(0, (schedule.followedCountTotal ?? 0) + followedThisRun);
  let nextRunAt = computeNextRunAt(
    {
      ...schedule,
      entries: nextEntries,
      oneOffRemainingDates: nextOneOff,
      ...(intervalMode && success
        ? { recurrenceLastRunAt: justAfter, intervalFirstRunAt: null }
        : {}),
    },
    justAfter,
  );
  if (runError) {
    nextRunAt = new Date(Date.now() + 60_000);
  }

  let statusResolved: FollowScheduleStatus = intervalMode
    ? nextRunAt
      ? "active"
      : "paused"
    : schedule.keepActive
      ? nextRunAt
        ? "active"
        : "paused"
      : nextOneOff.length === 0
        ? "completed"
        : nextRunAt
          ? "active"
          : "paused";

  const capDone =
    Boolean(success && schedule.stopAfterTotalFollowed != null && typeof schedule.stopAfterTotalFollowed === "number") &&
    newFollowedTotal >= (schedule.stopAfterTotalFollowed as number);
  if (capDone) {
    statusResolved = "completed";
    nextRunAt = null;
  }

  logFollowSchedule(runError ? "execute:done-failed" : "execute:done-ok", {
    scheduleId,
    jobId: job.id,
    runError: runError ?? null,
    nextStatus: statusResolved,
    nextRunAt: nextRunAt?.toISOString() ?? null,
    dispatched: success && !schedule.keepActive && !intervalMode,
    followedThisRun,
    newFollowedTotal,
    stopCapReached: capDone,
  });

  const patch: Record<string, unknown> = {
    followedCountTotal: newFollowedTotal,
    oneOffRemainingDates: nextOneOff,
    entries: nextEntries,
    status: statusResolved,
    nextRunAt,
    lastRunAt: new Date(),
    lastRunStatus: runError ? "failed" : "completed",
    lastRunError: runError,
    lockedAt: null,
    lockOwner: null,
  };
  if (success && (schedule.keepActive || intervalMode)) {
    patch.recurrenceLastRunAt = new Date();
  }
  if (intervalMode && success) {
    patch.intervalFirstRunAt = null;
  }

  await FollowScheduleModel.updateOne(
    { _id: schedule._id },
    {
      $set: patch,
      $push: {
        runLogs: {
          $each: [
            {
              ranAt: new Date(),
              success: !runError,
              message: runError,
            },
          ],
          $slice: -20,
        },
      },
    },
  );
  emitFollowScheduleTouch(schedule.userId, schedule.sessionId, "executed");
}

const schedulerWorkerId = randomUUID();
let schedulerTickInFlight = false;

/** Recalcula `nextRunAt` com a lógica de fuso atual (útil após upgrade ou mudança de env). */
async function realignAllFollowScheduleNextRunAt(): Promise<void> {
  const rows = await FollowScheduleModel.find({}).lean();
  for (const row of rows) {
    const doc = row as FollowScheduleDocLike;
    if (isFollowScheduleCapSatisfied(doc)) {
      await FollowScheduleModel.updateOne(
        { _id: row._id },
        {
          $set: {
            status: "completed" as FollowScheduleStatus,
            nextRunAt: null,
          },
        },
      );
      continue;
    }
    const next = computeNextRunAt(doc, new Date());
    let nextStatus: FollowScheduleStatus = doc.status;
    if (doc.status === "active" && !next) {
      nextStatus = "paused";
    }
    const statusChanged = nextStatus !== doc.status;
    await FollowScheduleModel.updateOne(
      { _id: row._id },
      {
        $set: {
          nextRunAt: next,
          ...(statusChanged ? { status: nextStatus } : {}),
        },
      },
    );
  }
  if (rows.length > 0) {
    logFollowSchedule("boot:nextRunAt-realigned", { count: rows.length });
  }
}

async function processDueFollowSchedulesTick(): Promise<void> {
  if (schedulerTickInFlight) {
    logFollowSchedule("tick:skipped-overlap", {});
    return;
  }
  schedulerTickInFlight = true;
  try {
    const now = new Date();
    const lockExpiration = new Date(now.getTime() - 5 * 60 * 1000);
    const due = await FollowScheduleModel.find({
      status: "active",
      nextRunAt: { $lte: now },
      $or: [{ lockedAt: null }, { lockedAt: { $lte: lockExpiration } }],
    })
      .sort({ nextRunAt: 1 })
      .limit(10)
      .lean();

    const upcomingFilter = { status: "active" as const, nextRunAt: { $gt: now } };
    const upcomingTotal = await FollowScheduleModel.countDocuments(upcomingFilter);
    const upcomingMaxPreview = 25;
    const upcomingRows = await FollowScheduleModel.find(upcomingFilter)
      .sort({ nextRunAt: 1 })
      .limit(upcomingMaxPreview)
      .select({ _id: 1, nextRunAt: 1, flowType: 1, targetUsername: 1, sessionId: 1, keepActive: 1 })
      .lean();

    logFollowSchedule("tick", {
      dueCount: due.length,
      at: now.toISOString(),
      upcomingTotal,
      upcomingPreviewTruncated: upcomingTotal > upcomingRows.length,
      upcomingPreview: upcomingRows.map((s) => ({
        scheduleId: String(s._id),
        nextRunAt: s.nextRunAt ? new Date(s.nextRunAt).toISOString() : null,
        flowType: s.flowType,
        targetUsername: s.targetUsername ?? null,
        sessionId: s.sessionId,
        keepActive: s.keepActive,
      })),
    });

    for (const candidate of due) {
      const locked = await FollowScheduleModel.findOneAndUpdate(
        {
          _id: candidate._id,
          status: "active",
          nextRunAt: { $lte: new Date() },
          $or: [{ lockedAt: null }, { lockedAt: { $lte: lockExpiration } }],
        },
        { $set: { lockedAt: new Date(), lockOwner: schedulerWorkerId } },
        { new: true },
      ).lean<FollowScheduleDocLike | null>();
      if (!locked) {
        logFollowSchedule("lock:miss", { scheduleId: String(candidate._id) });
        continue;
      }
      logFollowSchedule("lock:acquired", { scheduleId: locked._id.toString(), nextRunAt: locked.nextRunAt?.toISOString() });
      try {
        await executeSingleFollowSchedule(locked);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        logFollowSchedule("execute:exception", { scheduleId: locked._id.toString(), message });
        await FollowScheduleModel.updateOne(
          { _id: locked._id },
          {
            $set: {
              lastRunAt: new Date(),
              lastRunStatus: "failed",
              lastRunError: message,
              lockedAt: null,
              lockOwner: null,
              nextRunAt: computeNextRunAt(locked, new Date()) ?? new Date(Date.now() + 60_000),
            },
            $push: {
              runLogs: {
                $each: [{ ranAt: new Date(), success: false, message }],
                $slice: -20,
              },
            },
          },
        );
        emitFollowScheduleTouch(locked.userId, locked.sessionId, "executed");
      }
    }
  } finally {
    schedulerTickInFlight = false;
  }
}

app.post("/insta/follow-schedules", async (req, res) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ ok: false, error: "Unauthorized." });
      return;
    }

    const runtime = await getInstaRuntimeOrSendError(req, res);
    if (!runtime) return;

    const flowType = req.body?.flowType === "followers" ? "followers" : req.body?.flowType === "suggested" ? "suggested" : null;
    if (!flowType) {
      res.status(400).json({ ok: false, error: "`flowType` deve ser `suggested` ou `followers`." });
      return;
    }
    const privacyFilter = normalizePrivacyFilter(req.body?.privacyFilter);
    if (!privacyFilter) {
      res.status(400).json({ ok: false, error: "`privacyFilter` deve ser `any`, `public` ou `private`." });
      return;
    }

    const entries = normalizeScheduleEntries(req.body?.entries);
    if (!entries) {
      res.status(400).json({ ok: false, error: "`entries` deve conter ao menos uma data válida com quantity (1..100)." });
      return;
    }

    const bodyRecord = req.body as Record<string, unknown>;
    const { value: parsedIntervalMinutes, error: intervalParseError } = pickIntervalMinutesFromBody(bodyRecord);
    if (intervalParseError) {
      res.status(400).json({ ok: false, error: intervalParseError });
      return;
    }
    const { value: parsedStopCap, error: stopCapError } = pickStopAfterTotalFollowedFromBody(bodyRecord);
    if (stopCapError) {
      res.status(400).json({ ok: false, error: stopCapError });
      return;
    }
    const intervalMode = parsedIntervalMinutes !== null;

    const keepActiveReq = req.body?.keepActive === true;
    const weeklyDaysRequested = normalizeWeeklyDays(req.body?.weeklyDays);
    const keepActive = intervalMode ? false : keepActiveReq;
    const weeklyDays = keepActive ? weeklyDaysRequested : [];

    if (intervalMode) {
      if (keepActiveReq) {
        res.status(400).json({
          ok: false,
          error: "`keepActive` (recorrência semanal) não pode ser combinado com `intervalMinutes`.",
        });
        return;
      }
      if (weeklyDaysRequested.length > 0) {
        res.status(400).json({
          ok: false,
          error: "`weeklyDays` não pode ser combinado com `intervalMinutes`.",
        });
        return;
      }
    }

    if (keepActive && weeklyDays.length === 0) {
      res.status(400).json({ ok: false, error: "Selecione ao menos um dia da semana para manter a agenda ativa." });
      return;
    }
    const runAt = normalizeRunTime(req.body?.runTime);
    const oneOffRemainingDates = intervalMode ? [] : entries.map((item) => item.date);

    let intervalFirstRunAt: Date | null = null;
    if (intervalMode) {
      const rawFirst = bodyRecord.intervalFirstRunAt;
      intervalFirstRunAt = parseIntervalFirstRunAtIso(rawFirst);
      if (rawFirst !== null && rawFirst !== undefined && rawFirst !== "") {
        if (!intervalFirstRunAt) {
          res.status(400).json({
            ok: false,
            error: "`intervalFirstRunAt` deve ser uma data ISO-8601 válida (UTC ou com offset).",
          });
          return;
        }
      }
    }

    const targetUsername = typeof req.body?.targetUsername === "string" ? req.body.targetUsername.trim() : "";
    if (flowType === "followers" && !targetUsername) {
      res.status(400).json({ ok: false, error: "`targetUsername` é obrigatório para fluxo `followers`." });
      return;
    }

    const scheduleTimeZone = normalizeScheduleTimeZoneInput(
      req.body?.timeZone ?? req.body?.scheduleTimeZone,
    );

    const schedule = await FollowScheduleModel.create({
      userId,
      sessionId: runtime.sessionId,
      flowType,
      privacyFilter,
      targetUsername: flowType === "followers" ? targetUsername : null,
      entries: entries.map((e) => ({ date: e.date, quantity: e.quantity, dispatchedAt: null })),
      oneOffRemainingDates,
      keepActive,
      weeklyDays,
      runAtHour: runAt.hour,
      runAtMinute: runAt.minute,
      scheduleTimeZone,
      intervalMinutes: intervalMode ? parsedIntervalMinutes : null,
      intervalFirstRunAt: intervalMode ? intervalFirstRunAt : null,
      status: "active",
      nextRunAt: null,
      lastRunAt: null,
      lastRunStatus: null,
      lastRunError: null,
      runLogs: [],
      recurrenceLastRunAt: null,
      stopAfterTotalFollowed: parsedStopCap,
      followedCountTotal: 0,
    });

    const computedNextRun = computeNextRunAt(schedule.toObject() as FollowScheduleDocLike, new Date());
    const nextStatus: FollowScheduleStatus = computedNextRun ? "active" : "paused";
    schedule.nextRunAt = computedNextRun;
    schedule.status = nextStatus;
    await schedule.save();

    emitFollowScheduleTouch(userId, runtime.sessionId, "mutated");
    res.status(201).json({ ok: true, schedule: serializeFollowSchedule(schedule.toObject()) });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

app.get("/insta/follow-schedules", async (req, res) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ ok: false, error: "Unauthorized." });
      return;
    }
    const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId.trim() : "";
    const flowType =
      req.query.flowType === "suggested" || req.query.flowType === "followers"
        ? (req.query.flowType as FollowScheduleFlowType)
        : null;
    const query: Record<string, unknown> = { userId };
    if (sessionId) query.sessionId = sessionId;
    if (flowType) query.flowType = flowType;
    const rows = await FollowScheduleModel.find(query).sort({ createdAt: -1 }).lean();
    res.json({ ok: true, schedules: rows.map((item) => serializeFollowSchedule(item)) });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

app.patch("/insta/follow-schedules/:scheduleId", async (req, res) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ ok: false, error: "Unauthorized." });
      return;
    }
    const scheduleId = typeof req.params.scheduleId === "string" ? req.params.scheduleId.trim() : "";
    const current = await FollowScheduleModel.findOne({ _id: scheduleId, userId });
    if (!current) {
      res.status(404).json({ ok: false, error: "Agendamento não encontrado." });
      return;
    }

    if (typeof req.body?.status === "string") {
      if (req.body.status !== "active" && req.body.status !== "paused" && req.body.status !== "completed") {
        res.status(400).json({ ok: false, error: "`status` inválido." });
        return;
      }
      current.status = req.body.status;
    }
    if (typeof req.body?.privacyFilter !== "undefined") {
      const privacy = normalizePrivacyFilter(req.body.privacyFilter);
      if (!privacy) {
        res.status(400).json({ ok: false, error: "`privacyFilter` inválido." });
        return;
      }
      current.privacyFilter = privacy;
    }
    if (typeof req.body?.targetUsername === "string") {
      current.targetUsername = req.body.targetUsername.trim() || null;
    }
    if (typeof req.body?.keepActive === "boolean") {
      current.keepActive = req.body.keepActive;
    }
    if (Array.isArray(req.body?.weeklyDays)) {
      current.weeklyDays = normalizeWeeklyDays(req.body.weeklyDays);
    }
    if (typeof req.body?.runTime !== "undefined") {
      const runAt = normalizeRunTime(req.body.runTime);
      current.runAtHour = runAt.hour;
      current.runAtMinute = runAt.minute;
    }
    if (typeof req.body?.timeZone === "string" || typeof req.body?.scheduleTimeZone === "string") {
      (current as unknown as { scheduleTimeZone: string }).scheduleTimeZone = normalizeScheduleTimeZoneInput(
        req.body?.timeZone ?? req.body?.scheduleTimeZone,
      );
    }
    if (Array.isArray(req.body?.entries)) {
      const entries = normalizeScheduleEntries(req.body.entries);
      if (!entries) {
        res.status(400).json({ ok: false, error: "`entries` inválido." });
        return;
      }
      const prev = current.toObject() as { entries: FollowScheduleEntryWithDispatch[] };
      const dispatchedByDate = new Map(
        (prev.entries ?? []).map((e) => [e.date, e.dispatchedAt ?? null] as const),
      );
      const merged: FollowScheduleEntryWithDispatch[] = entries.map((e) => ({
        date: e.date,
        quantity: e.quantity,
        dispatchedAt: dispatchedByDate.get(e.date) ?? null,
      }));
      (current as unknown as { entries: FollowScheduleEntryWithDispatch[] }).entries = merged;
      const provisionalAfterEntries = current.toObject() as FollowScheduleDocLike;
      if (isIntervalSchedule(provisionalAfterEntries)) {
        current.oneOffRemainingDates = [];
      } else {
        current.oneOffRemainingDates = merged.filter((e) => !e.dispatchedAt).map((e) => e.date);
      }
    }

    const patchBodyRecord = req.body as Record<string, unknown>;
    if ("intervalMinutes" in patchBodyRecord) {
      const { value: nextIntervalMinutes, error: intervalErr } = pickIntervalMinutesFromBody(patchBodyRecord);
      if (intervalErr) {
        res.status(400).json({ ok: false, error: intervalErr });
        return;
      }
      (current as unknown as { intervalMinutes: number | null }).intervalMinutes = nextIntervalMinutes;
      if (nextIntervalMinutes !== null) {
        if (current.keepActive) {
          res.status(400).json({
            ok: false,
            error: "`intervalMinutes` não pode ser combinado com `keepActive`. Desative a recorrência semanal primeiro.",
          });
          return;
        }
        if (normalizeWeeklyDays(current.weeklyDays).length > 0) {
          res.status(400).json({
            ok: false,
            error: "`intervalMinutes` não pode ser combinado com `weeklyDays`. Limpe os dias da semana.",
          });
          return;
        }
        current.keepActive = false;
        current.weeklyDays = [];
        current.oneOffRemainingDates = [];
      } else {
        (current as unknown as { intervalFirstRunAt: Date | null }).intervalFirstRunAt = null;
        current.oneOffRemainingDates = oneOffDatesFromEntries(
          (current.toObject() as FollowScheduleDocLike).entries ?? [],
        );
      }
    }
    if (typeof patchBodyRecord.intervalFirstRunAt !== "undefined") {
      const docInterval = (current as unknown as { intervalMinutes?: number | null }).intervalMinutes;
      if (typeof docInterval !== "number" || docInterval <= 0) {
        res.status(400).json({
          ok: false,
          error: "`intervalFirstRunAt` só se aplica quando `intervalMinutes` está definido.",
        });
        return;
      }
      const rawFirstPatch = patchBodyRecord.intervalFirstRunAt;
      if (rawFirstPatch === null || rawFirstPatch === "") {
        (current as unknown as { intervalFirstRunAt: Date | null }).intervalFirstRunAt = null;
      } else {
        const parsedFirst = parseIntervalFirstRunAtIso(rawFirstPatch);
        if (!parsedFirst) {
          res.status(400).json({
            ok: false,
            error: "`intervalFirstRunAt` deve ser uma data ISO-8601 válida (UTC ou com offset).",
          });
          return;
        }
        (current as unknown as { intervalFirstRunAt: Date | null }).intervalFirstRunAt = parsedFirst;
      }
    }
    if ("stopAfterTotalFollowed" in patchBodyRecord) {
      const { value: nextStopCap, error: stopCapPatchErr } = pickStopAfterTotalFollowedFromBody(patchBodyRecord);
      if (stopCapPatchErr) {
        res.status(400).json({ ok: false, error: stopCapPatchErr });
        return;
      }
      (current as unknown as { stopAfterTotalFollowed: number | null }).stopAfterTotalFollowed = nextStopCap;
    }

    const afterPatchDoc = current.toObject() as FollowScheduleDocLike;
    if (isIntervalSchedule(afterPatchDoc)) {
      if (afterPatchDoc.keepActive || (afterPatchDoc.weeklyDays && afterPatchDoc.weeklyDays.length > 0)) {
        res.status(400).json({
          ok: false,
          error: "Agendamento em modo intervalo não pode ter `keepActive` nem dias em `weeklyDays`.",
        });
        return;
      }
    }

    const docLike = current.toObject() as FollowScheduleDocLike;
    if (isFollowScheduleCapSatisfied(docLike)) {
      current.status = "completed";
      current.nextRunAt = null;
    } else {
      current.nextRunAt = computeNextRunAt(docLike, new Date());
      if (current.status === "active" && !current.nextRunAt) {
        current.status = "paused";
      }
    }
    await current.save();

    emitFollowScheduleTouch(userId, String(current.sessionId), "mutated");
    res.json({ ok: true, schedule: serializeFollowSchedule(current.toObject()) });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

app.delete("/insta/follow-schedules/:scheduleId", async (req, res) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ ok: false, error: "Unauthorized." });
      return;
    }
    const scheduleId = typeof req.params.scheduleId === "string" ? req.params.scheduleId.trim() : "";
    const deleted = await FollowScheduleModel.findOneAndDelete({ _id: scheduleId, userId }).lean();
    if (!deleted) {
      res.status(404).json({ ok: false, error: "Agendamento não encontrado." });
      return;
    }
    emitFollowScheduleTouch(userId, String(deleted.sessionId), "mutated");
    res.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

/**
 * Body JSON: `{ "conversationTitle", "text", "dedicatedTab"?: boolean }` — título visível na inbox (igual a `listConversations`), texto da DM.
 * Requer sessão autenticada; a lib simula teclado no Web (pode levar ~15–25s).
 */
app.post("/insta/messages", async (req, res) => {
  const runtime = await getInstaRuntimeOrSendError(req, res);
  if (!runtime) return;
  const client = runtime.client;
  const conversationTitle =
    typeof req.body?.conversationTitle === "string" ? req.body.conversationTitle.trim() : "";
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  if (!conversationTitle || !text) {
    res.status(400).json({
      ok: false,
      error: "O body deve incluir `conversationTitle` (string não vazia) e `text` (string).",
    });
    return;
  }
  const dedicatedTab = req.body?.dedicatedTab === true;
  try {
    const result = await client.sendMessageToConversation(conversationTitle, text, { dedicatedTab });
    res.json({ ok: true, conversationTitle: result.conversationTitle, text: result.text });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

/**
 * Conexão longa (SSE). O servidor inicia o `startDmTap` da lib (MQTT/WebSocket do IG) e
 * reenvia cada DmTapEvent como `event: dmtap` no corpo. Requer sessão já logada; use em paralelo
 * com `POST /insta/open-login` antes. CORS: defina `CORS_ORIGIN` (padrão `*`) se o front for outro host.
 * No browser: `const es = new EventSource("http://127.0.0.1:3000/insta/realtime/dm");
 *   es.addEventListener("dmtap", (e) => console.log(JSON.parse((e as MessageEvent).data)));`
 */
app.get("/insta/realtime/dm", async (req, res) => {
  const runtime = await getInstaRuntimeOrSendError(req, res);
  if (!runtime) return;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof (res as Response & { flushHeaders?: () => void }).flushHeaders === "function") {
    (res as Response & { flushHeaders: () => void }).flushHeaders();
  }

  res.write(`: sse ok\n\n`);
  runtime.dmTapSseClients.add(res);

  const remove = () => {
    runtime.dmTapSseClients.delete(res);
  };
  req.on("close", remove);
  res.on("close", remove);

  try {
    await ensureDmTapForSse(runtime);
    writeSse(res, "system", { ok: true, message: "dmTap ativo; aguardando mensagens." });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    writeSse(res, "system", { ok: false, error: message });
    remove();
    res.end();
  }
});

/** Desliga o dmTap (para de alimentar o SSE com novas mensagens). Conexões SSE podem permanecer abertas, mas vazias. */
app.post("/insta/realtime/dm-tap/stop", async (req, res) => {
  try {
    const runtime = await getInstaRuntimeOrSendError(req, res);
    if (!runtime) return;
    runtime.client.stopDmTap();
    res.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

async function bootstrap() {
  try {
    await connectDatabase();
    await realignAllFollowScheduleNextRunAt();
    logFollowSchedule("scheduler:started", { intervalMs: 30_000, workerId: schedulerWorkerId });
    setInterval(() => {
      void processDueFollowSchedulesTick();
    }, 30_000);
    void processDueFollowSchedulesTick();
    const httpServer = createServer(app);
    instaRealtime = initInstaRealtime(httpServer, {
      getJob: (jobId) => autoFollowJobs.get(jobId),
    });
    httpServer.listen(port, () => {
      console.log(`Server listening on http://127.0.0.1:${port}`);
      void restorePersistedInstaRuntimes().catch((e) => {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`[insta-auth] runtime:boot-restore:unhandled ${message}`);
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to start server: ${message}`);
    process.exit(1);
  }
}

void bootstrap();
