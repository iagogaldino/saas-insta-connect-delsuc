import { toast } from "sonner"
import type { FollowOutboundSuccessPayload } from "../../lib/insta"

const DEBOUNCE_MS = 400
const TOAST_STABLE_ID = "follow-outbound-aggregate"
const MAX_HANDLES_IN_SUMMARY = 3

type QueuedItem = FollowOutboundSuccessPayload & { handle: string }

let buffer: QueuedItem[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

function dedupeKey(sessionId: string, handle: string) {
  return `${sessionId}::${handle}`
}

function parsePayload(raw: unknown): QueuedItem | null {
  const payload = raw as FollowOutboundSuccessPayload
  const usernameRaw = typeof payload?.username === "string" ? payload.username : ""
  const sessionId = typeof payload?.sessionId === "string" ? payload.sessionId : ""
  const handle = usernameRaw.trim().toLowerCase()
  if (!handle || !sessionId) {
    return null
  }
  const followedAt = typeof payload?.followedAt === "string" ? payload.followedAt : ""
  const fullName = typeof payload.fullName === "string" ? payload.fullName : null
  const profilePicUrl = typeof payload.profilePicUrl === "string" ? payload.profilePicUrl : null
  return {
    sessionId,
    username: usernameRaw.trim(),
    fullName,
    profilePicUrl,
    followedAt,
    handle,
  }
}

function flushFollowOutboundBuffer() {
  const items = buffer
  buffer = []
  if (items.length === 0) {
    return
  }

  try {
    if (items.length === 1) {
      const p = items[0]
      const label = p.fullName?.trim() || `@${p.handle}`
      toast.custom(
        (id) => (
          <div className="pointer-events-auto flex w-[min(100vw-2rem,22rem)] items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-lg">
            {p.profilePicUrl ? (
              <img src={p.profilePicUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                @{p.handle.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Novo follow</p>
              <p className="truncate text-sm font-semibold text-slate-900">{label}</p>
              <p className="truncate text-xs text-slate-600">@{p.handle}</p>
            </div>
            <button
              type="button"
              onClick={() => toast.dismiss(id)}
              className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Fechar"
            >
              ×
            </button>
          </div>
        ),
        { id: TOAST_STABLE_ID, duration: 6_000, position: "bottom-right" },
      )
      return
    }

    const n = items.length
    const handles = items.map((i) => i.handle)
    const shown = handles.slice(0, MAX_HANDLES_IN_SUMMARY)
    const rest = n - shown.length
    const listText = shown.map((h) => `@${h}`).join(", ")
    const suffix = rest > 0 ? ` e mais ${rest}` : ""

    toast.custom(
      (id) => (
        <div className="pointer-events-auto flex w-[min(100vw-2rem,22rem)] items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-lg">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-800">
            {n}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Novos follows</p>
            <p className="truncate text-sm font-semibold text-slate-900">{n} contas seguidas</p>
            <p className="break-words text-xs leading-snug text-slate-600">
              {listText}
              {suffix}
            </p>
          </div>
          <button
            type="button"
            onClick={() => toast.dismiss(id)}
            className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
      ),
      { id: TOAST_STABLE_ID, duration: 6_000, position: "bottom-right" },
    )
  } catch {
    /* evita quebrar o handler do socket */
  }
}

function scheduleFlush() {
  if (flushTimer !== null) {
    clearTimeout(flushTimer)
  }
  flushTimer = setTimeout(() => {
    flushTimer = null
    flushFollowOutboundBuffer()
  }, DEBOUNCE_MS)
}

/** Limpa fila e timer (ex.: logout / desconexão do socket). */
export function resetFollowOutboundToastState() {
  if (flushTimer !== null) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  buffer = []
}

/** Acumula eventos de follow e exibe um único toast (resumo em lote ou cartão individual). */
export function showFollowOutboundToast(raw: unknown) {
  const item = parsePayload(raw)
  if (!item) {
    return
  }
  const key = dedupeKey(item.sessionId, item.handle)
  const idx = buffer.findIndex((x) => dedupeKey(x.sessionId, x.handle) === key)
  if (idx >= 0) {
    buffer[idx] = item
  } else {
    buffer.push(item)
  }
  scheduleFlush()
}
