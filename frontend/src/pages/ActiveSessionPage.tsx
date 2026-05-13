import axios from "axios"
import { CalendarClock, Loader2, Play, Users } from "lucide-react"
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { useInstaConnect } from "../features/insta/use-insta-connect"
import { readAuthToken } from "../lib/auth-session-storage"
import { formatDateTimeBr, formatIsoDateBr } from "../lib/format-br"
import {
  deleteFollowSchedule,
  getAutoFollowJobStatus,
  getFollowSchedules,
  getInstaPreviewProfile,
  patchFollowSchedule,
  postFollowSchedule,
  postInstaIncomingWebhookTest,
  postAutoFollowFollowers,
  postAutoFollowSuggested,
  putInstaIncomingWebhookConfig,
  type AutoFollowFollowersResponse,
  type AutoFollowPrivacyFilter,
  type AutoFollowResponse,
  type AutoFollowResultItem,
  type FollowScheduleItem,
  type InstaPreviewProfileResponse,
} from "../lib/insta"
import {
  AUTOFOLLOW_SOCKET_FALLBACK_POLL,
  AUTOFOLLOW_SOCKET_WAIT_TIMEOUT,
  createInstaRealtimeSocket,
  waitForAutofollowJobOnSocket,
  waitForSocketConnected,
} from "../lib/insta-realtime-socket"

type ResultPanelData = {
  requested: number
  followed: number
  attempted: number
  privacyFilter: string
  results: AutoFollowResultItem[]
}

type ScheduleDraftEntry = { date: string; quantity: number }

type ScheduleCadence = "dates" | "interval"

type ScheduleDraft = {
  cadence: ScheduleCadence
  entries: ScheduleDraftEntry[]
  dateInput: string
  quantityInput: number
  /** Ex.: 2 com unidade "hours" → 120 min (validado no envio). */
  intervalValue: number
  intervalUnit: "minutes" | "hours" | "days"
  /** `datetime-local` vazio = primeiro disparo o quanto antes. */
  intervalFirstRunAtInput: string
  runTime: string
  keepActive: boolean
  weeklyDays: number[]
  /** Meta opcional para concluir o agendamento; vazio = sem limite. */
  stopAfterFollowedInput: string
}

const SCHEDULE_STOP_CAP_MAX = 1_000_000

/** Alinhado ao backend (`follow-schedule-time.ts`). */
const FOLLOW_SCHEDULE_INTERVAL_MIN_MINUTES = 1
const FOLLOW_SCHEDULE_INTERVAL_MAX_MINUTES = 100 * 365 * 24 * 60

function formatFollowScheduleIntervalBr(totalMinutes: number): string {
  const m = Math.floor(totalMinutes)
  if (m >= 24 * 60 && m % (24 * 60) === 0) {
    const d = m / (24 * 60)
    return d === 1 ? "1 dia" : `${d} dias`
  }
  if (m >= 60 && m % 60 === 0) {
    const h = m / 60
    return h === 1 ? "1 hora" : `${h} horas`
  }
  return m === 1 ? "1 minuto" : `${m} minutos`
}

function draftIntervalToMinutes(draft: ScheduleDraft): number | null {
  const raw = draft.intervalValue
  const v = typeof raw === "number" && Number.isFinite(raw) ? Math.floor(raw) : NaN
  if (!Number.isFinite(v) || v < 1) return null
  let minutes: number
  if (draft.intervalUnit === "minutes") minutes = v
  else if (draft.intervalUnit === "hours") minutes = v * 60
  else minutes = v * 24 * 60
  if (minutes < FOLLOW_SCHEDULE_INTERVAL_MIN_MINUTES || minutes > FOLLOW_SCHEDULE_INTERVAL_MAX_MINUTES) {
    return null
  }
  return minutes
}

/** Converte valor de `<input type="datetime-local" />` para ISO UTC. */
function localDatetimeInputToIsoUtc(localValue: string): string | null {
  const s = localValue.trim()
  if (!s) return null
  const t = new Date(s)
  if (Number.isNaN(t.getTime())) return null
  return t.toISOString()
}

const weekDays: Array<{ value: number; label: string }> = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sab" },
]

type SessionFeatureTab = "autofollow" | "webhook" | "conversas"

/** Ordem do menu: funcionalidades novas primeiro. */
const SESSION_FEATURE_TABS: ReadonlyArray<{
  id: SessionFeatureTab
  label: string
  isNew: boolean
}> = [
  { id: "autofollow", label: "AutoFollow", isNew: true },
  { id: "webhook", label: "Webhook", isNew: true },
  { id: "conversas", label: "Conversas", isNew: false },
]

/** Sub-abas dentro de AutoFollow (execução manual e agendas). */
type AutofollowFlowSubTab = "suggested" | "followers"

const AUTOFOLLOW_MANUAL_SUB_TABS: ReadonlyArray<{ id: AutofollowFlowSubTab; label: string }> = [
  { id: "suggested", label: "Sugeridos (Explore)" },
  { id: "followers", label: "Seguidores de perfil" },
]

const AUTOFOLLOW_SCHEDULE_SUB_TABS: ReadonlyArray<{ id: AutofollowFlowSubTab; label: string }> = [
  { id: "suggested", label: "Seguir sugeridos" },
  { id: "followers", label: "Seguir seguidores de @" },
]

/** YYYY-MM-DD (fuso local) — alinha com <input type="date" />. */
function todayLocalYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** HH:mm (fuso local) — para min em <input type="time" /> no dia de hoje. */
function nowLocalHm(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

/** `new Date("YYYY-MM-DDTHH:mm:00")` em horário local. */
function isLocalDateTimeInThePast(ymd: string, hm: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || !/^\d{2}:\d{2}$/.test(hm)) return true
  const t = new Date(`${ymd}T${hm}:00`)
  if (Number.isNaN(t.getTime())) return true
  return t.getTime() < Date.now()
}

function minLocalDatetimeForDatetimeLocalInput(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function AutoFollowResultsPanel({
  result,
  resultTab,
  setResultTab,
  extraSummary = null,
}: {
  result: ResultPanelData
  resultTab: "followed" | "failed"
  setResultTab: (t: "followed" | "failed") => void
  extraSummary?: ReactNode
}) {
  const followedItems = result.results.filter((item) => item.success)
  const failedItems = result.results.filter((item) => !item.success)
  const visibleItems = resultTab === "followed" ? followedItems : failedItems

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-700">
      {extraSummary}
      <p className="text-sm text-slate-700">
        Resultado: seguiu <strong>{result.followed}</strong> de <strong>{result.requested}</strong> solicitados
        (tentativas: {result.attempted}, filtro: <code>{result.privacyFilter}</code>).
      </p>
      {result.results.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-800">Pessoas processadas</h4>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setResultTab("followed")}
                className={`rounded-md px-2 py-1 ${
                  resultTab === "followed" ? "bg-emerald-100 text-emerald-800" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Seguidos ({followedItems.length})
              </button>
              <button
                type="button"
                onClick={() => setResultTab("failed")}
                className={`rounded-md px-2 py-1 ${
                  resultTab === "failed" ? "bg-rose-100 text-rose-800" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Falhas ({failedItems.length})
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {visibleItems.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                {resultTab === "followed"
                  ? "Nenhum perfil seguido nesta execução."
                  : "Nenhuma falha nesta execução."}
              </p>
            ) : null}
            {visibleItems.map((item, idx) => {
              const profileUrl = item.href?.startsWith("http")
                ? item.href
                : item.href
                  ? `https://www.instagram.com${item.href}`
                  : `https://www.instagram.com/${item.username}/`

              return (
                <div
                  key={`${item.username}-${idx}`}
                  className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3"
                >
                  {item.profilePicUrl ? (
                    <img
                      src={item.profilePicUrl}
                      alt={`Foto de ${item.username}`}
                      className="h-12 w-12 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                      @{item.username.slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={profileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-slate-900 hover:underline"
                      >
                        @{item.username}
                      </a>
                      {item.fullName ? <span className="text-slate-600">- {item.fullName}</span> : null}
                      {item.isVerified ? (
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">Verificado</span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`rounded px-1.5 py-0.5 ${
                          item.success ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {item.success ? "Seguido" : "Não seguido"}
                      </span>
                      {typeof item.isPrivate === "boolean" ? (
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-700">
                          {item.isPrivate ? "Privado" : "Público"}
                        </span>
                      ) : null}
                      {item.userId ? (
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-700">ID: {item.userId}</span>
                      ) : null}
                      {item.reason ? (
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-700">{item.reason}</span>
                      ) : null}
                    </div>
                    {item.error ? <p className="mt-1 text-xs text-rose-600">{item.error}</p> : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function ActiveSessionPage() {
  const navigate = useNavigate()
  const { activeSessionId, sessions, refreshSessions } = useInstaConnect()
  const instaSocketRef = useRef<ReturnType<typeof createInstaRealtimeSocket> | null>(null)
  const [quantity, setQuantity] = useState(3)
  const [privacyFilter, setPrivacyFilter] = useState<AutoFollowPrivacyFilter>("any")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AutoFollowResponse | null>(null)
  const [resultTab, setResultTab] = useState<"followed" | "failed">("followed")

  const [ffTarget, setFfTarget] = useState("")
  const [ffQuantity, setFfQuantity] = useState(3)
  const [ffPrivacy, setFfPrivacy] = useState<AutoFollowPrivacyFilter>("any")
  const [ffSubmitting, setFfSubmitting] = useState(false)
  const [ffError, setFfError] = useState<string | null>(null)
  const [ffResult, setFfResult] = useState<AutoFollowFollowersResponse | null>(null)
  const [ffResultTab, setFfResultTab] = useState<"followed" | "failed">("followed")
  const [ffPreview, setFfPreview] = useState<InstaPreviewProfileResponse | null>(null)
  const [ffPreviewLoading, setFfPreviewLoading] = useState(false)
  const [ffPreviewError, setFfPreviewError] = useState<string | null>(null)
  /** Após a verificação em Iniciar: mostra prévia e exige "Confirmar e seguir" para rodar a automação. */
  const [ffAwaitingConfirm, setFfAwaitingConfirm] = useState(false)
  const [incomingWebhookUrlInput, setIncomingWebhookUrlInput] = useState("")
  const [incomingWebhookEnabledInput, setIncomingWebhookEnabledInput] = useState(false)
  const [incomingWebhookSaving, setIncomingWebhookSaving] = useState(false)
  const [incomingWebhookTesting, setIncomingWebhookTesting] = useState(false)
  const [incomingWebhookMessage, setIncomingWebhookMessage] = useState<string | null>(null)
  const [incomingWebhookError, setIncomingWebhookError] = useState<string | null>(null)
  const [showWebhookPayloadPreview, setShowWebhookPayloadPreview] = useState(false)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [suggestedSchedules, setSuggestedSchedules] = useState<FollowScheduleItem[]>([])
  const [followersSchedules, setFollowersSchedules] = useState<FollowScheduleItem[]>([])
  const [suggestedDraft, setSuggestedDraft] = useState<ScheduleDraft>({
    cadence: "dates",
    entries: [],
    dateInput: "",
    quantityInput: 20,
    intervalValue: 1,
    intervalUnit: "hours",
    intervalFirstRunAtInput: "",
    runTime: "10:00",
    keepActive: false,
    weeklyDays: [],
    stopAfterFollowedInput: "",
  })
  const [followersDraft, setFollowersDraft] = useState<ScheduleDraft>({
    cadence: "dates",
    entries: [],
    dateInput: "",
    quantityInput: 20,
    intervalValue: 1,
    intervalUnit: "hours",
    intervalFirstRunAtInput: "",
    runTime: "10:00",
    keepActive: false,
    weeklyDays: [],
    stopAfterFollowedInput: "",
  })
  const [activeFeatureTab, setActiveFeatureTab] = useState<SessionFeatureTab>(SESSION_FEATURE_TABS[0]!.id)
  const [manualSubTab, setManualSubTab] = useState<AutofollowFlowSubTab>("suggested")
  const [scheduleSubTab, setScheduleSubTab] = useState<AutofollowFlowSubTab>("suggested")

  const formBusy =
    isSubmitting || ffSubmitting || ffPreviewLoading || incomingWebhookSaving || incomingWebhookTesting || scheduleLoading
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null
  const isSessionConnected = Boolean(activeSession?.instagramUsername)
  const incomingWebhookStatus = activeSession?.incomingWebhookLastStatus ?? null
  const incomingWebhookLastError = activeSession?.incomingWebhookLastError ?? null
  const incomingWebhookLastSentAt = activeSession?.incomingWebhookLastSentAt ?? null
  const incomingWebhookPayloadPreview = JSON.stringify(
    {
      event: "instagram.dm.received",
      sessionId: activeSessionId,
      instagramUsername: activeSession?.instagramUsername ?? null,
      threadId: "340282366841710300949128157598514677385",
      messageText: "Oi, tudo bem?",
      senderUsername: "cliente_teste",
      receivedAt: new Date().toISOString(),
      raw: {
        text: "Oi, tudo bem?",
        threadId: "340282366841710300949128157598514677385",
        senderUsername: "cliente_teste",
      },
    },
    null,
    2,
  )

  useEffect(() => {
    queueMicrotask(() => {
      setIncomingWebhookUrlInput(activeSession?.incomingWebhookUrl ?? "")
      setIncomingWebhookEnabledInput(Boolean(activeSession?.incomingWebhookEnabled))
      setIncomingWebhookMessage(null)
      setIncomingWebhookError(null)
    })
  }, [activeSessionId, activeSession?.incomingWebhookUrl, activeSession?.incomingWebhookEnabled])

  const refreshSchedules = useCallback(async (options?: { quiet?: boolean }) => {
    if (!activeSessionId) {
      setSuggestedSchedules([])
      setFollowersSchedules([])
      return
    }
    if (!options?.quiet) {
      setScheduleLoading(true)
    }
    try {
      const [suggestedRes, followersRes] = await Promise.all([
        getFollowSchedules("suggested", activeSessionId),
        getFollowSchedules("followers", activeSessionId),
      ])
      setSuggestedSchedules(suggestedRes.data.schedules)
      setFollowersSchedules(followersRes.data.schedules)
    } catch (e) {
      if (axios.isAxiosError(e)) {
        const body = e.response?.data as { error?: string } | undefined
        setScheduleError(body?.error ?? e.message)
      } else {
        setScheduleError(e instanceof Error ? e.message : "Falha ao carregar agendamentos.")
      }
    } finally {
      if (!options?.quiet) {
        setScheduleLoading(false)
      }
    }
  }, [activeSessionId])

  useEffect(() => {
    if (!activeSessionId) {
      instaSocketRef.current?.disconnect()
      instaSocketRef.current = null
      return
    }
    const token = readAuthToken()
    if (!token) {
      instaSocketRef.current?.disconnect()
      instaSocketRef.current = null
      return
    }
    const socket = createInstaRealtimeSocket(token, {
      onFollowScheduleTouch(data) {
        if (data.sessionId !== activeSessionId) return
        void refreshSchedules({ quiet: true })
      },
    })
    instaSocketRef.current = socket
    return () => {
      socket.disconnect()
      if (instaSocketRef.current === socket) {
        instaSocketRef.current = null
      }
    }
  }, [activeSessionId, refreshSchedules])

  useEffect(() => {
    queueMicrotask(() => {
      void refreshSchedules()
    })
  }, [activeSessionId, refreshSchedules])

  function addDateEntry(draft: ScheduleDraft, setDraft: (next: ScheduleDraft) => void) {
    setScheduleError(null)
    if (!draft.dateInput) return
    if (isLocalDateTimeInThePast(draft.dateInput, draft.runTime)) {
      setScheduleError("Use uma data a partir de hoje e, se for hoje, um horário depois do atual.")
      return
    }
    const quantity = Math.max(1, Math.min(100, Math.floor(draft.quantityInput || 1)))
    const nextMap = new Map(draft.entries.map((item) => [item.date, item.quantity] as const))
    nextMap.set(draft.dateInput, quantity)
    const nextEntries = [...nextMap.entries()]
      .map(([date, q]) => ({ date, quantity: q }))
      .sort((a, b) => a.date.localeCompare(b.date))
    setDraft({ ...draft, entries: nextEntries, dateInput: "" })
  }

  function removeDateEntry(draft: ScheduleDraft, setDraft: (next: ScheduleDraft) => void, date: string) {
    setDraft({ ...draft, entries: draft.entries.filter((item) => item.date !== date) })
  }

  function toggleWeeklyDay(draft: ScheduleDraft, setDraft: (next: ScheduleDraft) => void, day: number) {
    const exists = draft.weeklyDays.includes(day)
    const next = exists ? draft.weeklyDays.filter((d) => d !== day) : [...draft.weeklyDays, day].sort((a, b) => a - b)
    setDraft({ ...draft, weeklyDays: next })
  }

  async function createSchedule(flowType: "suggested" | "followers") {
    const draft = flowType === "suggested" ? suggestedDraft : followersDraft
    const setDraft = flowType === "suggested" ? setSuggestedDraft : setFollowersDraft
    setScheduleMessage(null)
    setScheduleError(null)
    const intervalMode = draft.cadence === "interval"
    if (!intervalMode) {
      if (draft.entries.length === 0) {
        setScheduleError("Adicione ao menos uma data no calendário.")
        return
      }
      if (draft.keepActive && draft.weeklyDays.length === 0) {
        setScheduleError("Para manter ativa, selecione ao menos um dia da semana.")
        return
      }
      for (const e of draft.entries) {
        if (isLocalDateTimeInThePast(e.date, draft.runTime)) {
          setScheduleError(
            `A combinação ${e.date} às ${draft.runTime} está no passado. Ajuste o horário de disparo ou as datas.`,
          )
          return
        }
      }
    } else {
      const mins = draftIntervalToMinutes(draft)
      if (mins === null) {
        setScheduleError(
          `Informe um intervalo válido (${FOLLOW_SCHEDULE_INTERVAL_MIN_MINUTES} min a ${FOLLOW_SCHEDULE_INTERVAL_MAX_MINUTES / 60 / 24} dias).`,
        )
        return
      }
      if (draft.intervalFirstRunAtInput.trim()) {
        const iso = localDatetimeInputToIsoUtc(draft.intervalFirstRunAtInput)
        if (!iso) {
          setScheduleError("Data/hora do primeiro disparo inválida.")
          return
        }
        if (new Date(iso).getTime() < Date.now()) {
          setScheduleError("O primeiro disparo deve ser no futuro.")
          return
        }
      }
    }
    if (flowType === "followers" && !ffTarget.trim()) {
      setScheduleError("Informe o perfil alvo para agendamento de seguidores.")
      return
    }
    const capRaw = draft.stopAfterFollowedInput.trim()
    let stopAfterPayload: number | undefined
    if (capRaw) {
      const n = Math.floor(Number(capRaw.replace(/\s+/g, "")))
      if (!Number.isFinite(n) || n < 1 || n > SCHEDULE_STOP_CAP_MAX) {
        setScheduleError(
          `"Parar após": informe um número inteiro entre 1 e ${SCHEDULE_STOP_CAP_MAX.toLocaleString("pt-BR")}, ou deixe em branco.`,
        )
        return
      }
      stopAfterPayload = n
    }
    setScheduleLoading(true)
    try {
      let followersResolvedUsername: string | undefined
      if (flowType === "followers") {
        const t = ffTarget.replace(/^@+/, "").trim()
        try {
          const { data: preview } = await getInstaPreviewProfile(t)
          if (!preview.found) {
            setScheduleError(
              "Não foi possível localizar este perfil. Confira o @ e tente de novo. Se tiver certeza que o @ existe, a API do Instagram pode ter bloqueado a verificação.",
            )
            return
          }
          followersResolvedUsername = preview.username
        } catch (e) {
          if (axios.isAxiosError(e)) {
            const body = e.response?.data as { error?: string } | undefined
            setScheduleError(body?.error ?? e.message)
          } else {
            setScheduleError(e instanceof Error ? e.message : "Não foi possível verificar o perfil.")
          }
          return
        }
      }

      const qty = Math.max(1, Math.min(100, Math.floor(draft.quantityInput || 1)))
      const entriesPayload = intervalMode
        ? [{ date: todayLocalYmd(), quantity: qty }]
        : draft.entries
      const intervalFirstIso = intervalMode ? localDatetimeInputToIsoUtc(draft.intervalFirstRunAtInput) : null
      const intervalMinutesPayload = intervalMode ? draftIntervalToMinutes(draft)! : undefined

      await postFollowSchedule({
        flowType,
        entries: entriesPayload,
        privacyFilter: flowType === "suggested" ? privacyFilter : ffPrivacy,
        targetUsername: followersResolvedUsername,
        keepActive: intervalMode ? false : draft.keepActive,
        weeklyDays: intervalMode ? [] : draft.keepActive ? draft.weeklyDays : [],
        runTime: draft.runTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(intervalMode
          ? {
              intervalMinutes: intervalMinutesPayload,
              ...(intervalFirstIso ? { intervalFirstRunAt: intervalFirstIso } : {}),
            }
          : {}),
        ...(stopAfterPayload !== undefined ? { stopAfterTotalFollowed: stopAfterPayload } : {}),
      })
      setDraft({
        cadence: draft.cadence,
        entries: [],
        dateInput: "",
        quantityInput: 20,
        intervalValue: draft.intervalValue,
        intervalUnit: draft.intervalUnit,
        intervalFirstRunAtInput: draft.intervalFirstRunAtInput,
        runTime: draft.runTime,
        keepActive: draft.keepActive,
        weeklyDays: draft.weeklyDays,
        stopAfterFollowedInput: draft.stopAfterFollowedInput,
      })
      setScheduleMessage("Agendamento salvo com sucesso.")
      await refreshSchedules()
    } catch (e) {
      if (axios.isAxiosError(e)) {
        const body = e.response?.data as { error?: string } | undefined
        setScheduleError(body?.error ?? e.message)
      } else {
        setScheduleError(e instanceof Error ? e.message : "Não foi possível salvar o agendamento.")
      }
    } finally {
      setScheduleLoading(false)
    }
  }

  async function toggleScheduleStatus(item: FollowScheduleItem) {
    const nextStatus = item.status === "active" ? "paused" : "active"
    setScheduleLoading(true)
    setScheduleMessage(null)
    setScheduleError(null)
    try {
      await patchFollowSchedule(item.id, { status: nextStatus })
      setScheduleMessage(nextStatus === "active" ? "Agendamento reativado." : "Agendamento pausado.")
      await refreshSchedules()
    } catch (e) {
      if (axios.isAxiosError(e)) {
        const body = e.response?.data as { error?: string } | undefined
        setScheduleError(body?.error ?? e.message)
      } else {
        setScheduleError(e instanceof Error ? e.message : "Falha ao atualizar agendamento.")
      }
    } finally {
      setScheduleLoading(false)
    }
  }

  async function removeSchedule(item: FollowScheduleItem) {
    setScheduleLoading(true)
    setScheduleMessage(null)
    setScheduleError(null)
    try {
      await deleteFollowSchedule(item.id)
      setScheduleMessage("Agendamento removido.")
      await refreshSchedules()
    } catch (e) {
      if (axios.isAxiosError(e)) {
        const body = e.response?.data as { error?: string } | undefined
        setScheduleError(body?.error ?? e.message)
      } else {
        setScheduleError(e instanceof Error ? e.message : "Falha ao remover agendamento.")
      }
    } finally {
      setScheduleLoading(false)
    }
  }

  function tryNavigateRelogin(apiError: string) {
    const authSessionError =
      apiError.includes("Sessao nao autenticada. Faca login antes de seguir.") ||
      apiError.includes("Sessão não autenticada. Faça login antes de seguir.")
    if (authSessionError && activeSessionId) {
      void navigate(`/connect-instagram?reloginSessionId=${encodeURIComponent(activeSessionId)}`)
    }
  }

  function isHttpUrl(value: string): boolean {
    try {
      const parsed = new URL(value)
      return parsed.protocol === "http:" || parsed.protocol === "https:"
    } catch {
      return false
    }
  }

  async function waitForAutoFollowJobResult<T>(jobId: string): Promise<T> {
    const deadline = Date.now() + 30 * 60 * 1000
    const socket = instaSocketRef.current
    if (socket) {
      const ready = await waitForSocketConnected(socket, 5_000)
      if (ready) {
        try {
          return await waitForAutofollowJobOnSocket<T>(socket, jobId, Math.max(10_000, deadline - Date.now()))
        } catch (e) {
          if (
            e instanceof Error &&
            (e.message === AUTOFOLLOW_SOCKET_FALLBACK_POLL || e.message === AUTOFOLLOW_SOCKET_WAIT_TIMEOUT)
          ) {
            // fallback HTTP abaixo
          } else {
            throw e
          }
        }
      }
    }

    while (true) {
      const { data } = await getAutoFollowJobStatus(jobId)
      if (data.job.status === "completed") {
        return data.job.result as T
      }
      if (data.job.status === "failed") {
        throw new Error(data.job.error ?? "A automação falhou no processamento em background.")
      }
      if (Date.now() > deadline) {
        throw new Error("A automação excedeu o tempo máximo de espera (30 min).")
      }
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }

  async function handleSaveIncomingWebhook() {
    if (!activeSessionId) return
    setIncomingWebhookMessage(null)
    setIncomingWebhookError(null)
    const url = incomingWebhookUrlInput.trim()
    if (url && !isHttpUrl(url)) {
      setIncomingWebhookError("Informe uma URL válida com http:// ou https://.")
      return
    }
    setIncomingWebhookSaving(true)
    try {
      await putInstaIncomingWebhookConfig(activeSessionId, {
        incomingWebhookUrl: url,
        incomingWebhookEnabled: incomingWebhookEnabledInput,
      })
      await refreshSessions()
      setIncomingWebhookMessage("Webhook salvo com sucesso.")
    } catch (e) {
      if (axios.isAxiosError(e)) {
        const body = e.response?.data as { error?: string } | undefined
        setIncomingWebhookError(body?.error ?? e.message)
      } else {
        setIncomingWebhookError(e instanceof Error ? e.message : "Erro desconhecido.")
      }
    } finally {
      setIncomingWebhookSaving(false)
    }
  }

  async function handleTestIncomingWebhook() {
    if (!activeSessionId) return
    setIncomingWebhookMessage(null)
    setIncomingWebhookError(null)
    setIncomingWebhookTesting(true)
    try {
      await postInstaIncomingWebhookTest(activeSessionId)
      await refreshSessions()
      setIncomingWebhookMessage("Teste enviado para o webhook configurado.")
    } catch (e) {
      if (axios.isAxiosError(e)) {
        const body = e.response?.data as { error?: string } | undefined
        setIncomingWebhookError(body?.error ?? e.message)
      } else {
        setIncomingWebhookError(e instanceof Error ? e.message : "Erro desconhecido.")
      }
    } finally {
      setIncomingWebhookTesting(false)
    }
  }

  async function handleSubmitSuggested(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setResult(null)
    setResultTab("followed")
    setIsSubmitting(true)
    try {
      const { data } = await postAutoFollowSuggested(quantity, privacyFilter)
      const finalResult = await waitForAutoFollowJobResult<AutoFollowResponse>(data.jobId)
      setResult(finalResult)
    } catch (e) {
      if (axios.isAxiosError(e)) {
        const body = e.response?.data as { error?: string } | undefined
        const apiError = body?.error ?? e.message
        setError(apiError)
        tryNavigateRelogin(apiError)
      } else {
        setError(e instanceof Error ? e.message : "Erro desconhecido.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  function resetFollowersConfirmState() {
    setFfPreview(null)
    setFfPreviewError(null)
    setFfAwaitingConfirm(false)
  }

  async function handleSubmitFollowers(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (ffAwaitingConfirm) {
      void runFollowersAfterPreviewConfirm()
      return
    }

    setFfError(null)
    setFfResult(null)
    setFfResultTab("followed")
    const t = ffTarget.replace(/^@+/, "").trim()
    if (!t) {
      setFfError("Informe o nome de usuário do perfil alvo (sem @ ou com @).")
      return
    }
    setFfPreviewError(null)
    setFfPreviewLoading(true)
    setFfAwaitingConfirm(false)
    try {
      const { data } = await getInstaPreviewProfile(t)
      setFfPreview(data)
      if (data.found) {
        setFfAwaitingConfirm(true)
      } else {
        setFfError(null)
      }
    } catch (e) {
      setFfPreview(null)
      if (axios.isAxiosError(e)) {
        const body = e.response?.data as { error?: string } | undefined
        setFfPreviewError(body?.error ?? e.message)
      } else {
        setFfPreviewError(e instanceof Error ? e.message : "Não foi possível verificar o perfil.")
      }
    } finally {
      setFfPreviewLoading(false)
    }
  }

  async function runFollowersAfterPreviewConfirm() {
    setFfError(null)
    setFfResult(null)
    setFfResultTab("followed")
    setFfSubmitting(true)
    const t = ffTarget.trim()
    if (!t) {
      setFfError("Informe o nome de usuário do perfil alvo (sem @ ou com @).")
      setFfSubmitting(false)
      return
    }
    try {
      const { data } = await postAutoFollowFollowers(t, ffQuantity, ffPrivacy)
      const finalResult = await waitForAutoFollowJobResult<AutoFollowFollowersResponse>(data.jobId)
      setFfResult(finalResult)
      setFfAwaitingConfirm(false)
      setFfPreview(null)
    } catch (e) {
      if (axios.isAxiosError(e)) {
        const body = e.response?.data as { error?: string } | undefined
        const apiError = body?.error ?? e.message
        setFfError(apiError)
        tryNavigateRelogin(apiError)
      } else {
        setFfError(e instanceof Error ? e.message : "Erro desconhecido.")
      }
    } finally {
      setFfSubmitting(false)
    }
  }

  function renderSchedulePanel(
    title: string,
    flowType: "suggested" | "followers",
    draft: ScheduleDraft,
    setDraft: (next: ScheduleDraft) => void,
    items: FollowScheduleItem[],
  ) {
    const minDate = todayLocalYmd()
    const timeMin = draft.dateInput && draft.dateInput === minDate ? nowLocalHm() : undefined
    const slotInPast =
      Boolean(draft.dateInput) && isLocalDateTimeInThePast(draft.dateInput, draft.runTime)
    const hasInvalidSavedSlot =
      draft.cadence === "dates" && draft.entries.some((e) => isLocalDateTimeInThePast(e.date, draft.runTime))

    return (
      <div className="space-y-3 rounded-lg border border-slate-200 p-4">
        <h5 className="text-sm font-semibold text-slate-800">{title}</h5>
        {draft.cadence === "dates" ? (
          <p className="text-xs text-slate-500">
            Só é permitido agendar a partir de hoje; se a data for hoje, o horário precisa ser depois de agora.
          </p>
        ) : (
          <p className="text-xs text-slate-500">
            Modo intervalo: a automação repete com a cadência que você definir (minutos, horas ou dias). O horário fixo de
            disparo único não se aplica a este modo.
          </p>
        )}
        <div className="flex flex-wrap gap-4 text-sm text-slate-700">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name={`schedule-cadence-${flowType}`}
              checked={draft.cadence === "dates"}
              onChange={() => setDraft({ ...draft, cadence: "dates" })}
              disabled={formBusy || !isSessionConnected}
              className="border-slate-300 text-slate-900 focus:ring-slate-400"
            />
            Datas e horário fixo
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name={`schedule-cadence-${flowType}`}
              checked={draft.cadence === "interval"}
              onChange={() =>
                setDraft({
                  ...draft,
                  cadence: "interval",
                  keepActive: false,
                  weeklyDays: [],
                })
              }
              disabled={formBusy || !isSessionConnected}
              className="border-slate-300 text-slate-900 focus:ring-slate-400"
            />
            A cada intervalo
          </label>
        </div>
        {flowType === "followers" ? (
          <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50/80 p-3">
            <div>
              <label htmlFor="follow-schedule-target" className="mb-1 block text-xs font-medium text-slate-600">
                Perfil alvo (@ cujos seguidores serão seguidos)
              </label>
              <input
                id="follow-schedule-target"
                type="text"
                autoComplete="off"
                placeholder="ex: nomedaconta"
                value={ffTarget}
                onChange={(e) => {
                  setFfTarget(e.target.value)
                  resetFollowersConfirmState()
                }}
                disabled={formBusy || !isSessionConnected}
                className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
            <div>
              <label htmlFor="follow-schedule-privacy" className="mb-1 block text-xs font-medium text-slate-600">
                Filtro de privacidade (agendamento)
              </label>
              <select
                id="follow-schedule-privacy"
                value={ffPrivacy}
                onChange={(e) => setFfPrivacy(e.target.value as AutoFollowPrivacyFilter)}
                disabled={formBusy || !isSessionConnected}
                className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <option value="any">Qualquer perfil</option>
                <option value="public">Somente públicos</option>
                <option value="private">Somente privados</option>
              </select>
            </div>
          </div>
        ) : null}
        {draft.cadence === "interval" ? (
          <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50/80 p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">A cada</label>
                <input
                  type="number"
                  min={1}
                  value={draft.intervalValue}
                  onChange={(e) => setDraft({ ...draft, intervalValue: Number(e.target.value) })}
                  disabled={formBusy || !isSessionConnected}
                  className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Unidade</label>
                <select
                  value={draft.intervalUnit}
                  onChange={(e) =>
                    setDraft({ ...draft, intervalUnit: e.target.value as "minutes" | "hours" | "days" })
                  }
                  disabled={formBusy || !isSessionConnected}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="minutes">minutos</option>
                  <option value="hours">horas</option>
                  <option value="days">dias</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Quantidade (1-100) por execução</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={draft.quantityInput}
                  onChange={(e) => setDraft({ ...draft, quantityInput: Number(e.target.value) })}
                  disabled={formBusy || !isSessionConnected}
                  className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Primeiro disparo (opcional, horário local)
              </label>
              <input
                type="datetime-local"
                min={minLocalDatetimeForDatetimeLocalInput()}
                value={draft.intervalFirstRunAtInput}
                onChange={(e) => setDraft({ ...draft, intervalFirstRunAtInput: e.target.value })}
                disabled={formBusy || !isSessionConnected}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">Deixe vazio para disparar no próximo ciclo do agendador (em segundos).</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Data</label>
                <input
                  type="date"
                  value={draft.dateInput}
                  min={minDate}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v && v < minDate) return
                    let runTime = draft.runTime
                    if (v === minDate && runTime < nowLocalHm()) {
                      runTime = nowLocalHm()
                    }
                    setDraft({ ...draft, dateInput: v, runTime })
                  }}
                  disabled={formBusy || !isSessionConnected}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Quantidade (1-100)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={draft.quantityInput}
                  onChange={(e) => setDraft({ ...draft, quantityInput: Number(e.target.value) })}
                  disabled={formBusy || !isSessionConnected}
                  className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => addDateEntry(draft, setDraft)}
                disabled={formBusy || !isSessionConnected || !draft.dateInput || slotInPast}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
              >
                Adicionar data
              </button>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Horário de disparo</label>
                <input
                  type="time"
                  value={draft.runTime}
                  min={timeMin}
                  onChange={(e) => {
                    let v = e.target.value
                    if (draft.dateInput === minDate && v < nowLocalHm()) {
                      v = nowLocalHm()
                    }
                    setDraft({ ...draft, runTime: v })
                  }}
                  disabled={formBusy || !isSessionConnected}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              {draft.entries.length === 0 ? (
                <p className="text-xs text-slate-500">Nenhuma data adicionada.</p>
              ) : (
                draft.entries.map((entry) => (
                  <div
                    key={entry.date}
                    className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm"
                  >
                    <span>
                      {formatIsoDateBr(entry.date)} — {entry.quantity} perfis
                    </span>
                    <button
                      type="button"
                      onClick={() => removeDateEntry(draft, setDraft, entry.date)}
                      disabled={formBusy}
                      className="text-rose-600 hover:underline disabled:opacity-60"
                    >
                      remover
                    </button>
                  </div>
                ))
              )}
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.keepActive}
                onChange={(e) => setDraft({ ...draft, keepActive: e.target.checked })}
                disabled={formBusy || !isSessionConnected}
              />
              Manter ativa (recorrência semanal)
            </label>
            {draft.keepActive ? (
              <div className="flex flex-wrap gap-2">
                {weekDays.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleWeeklyDay(draft, setDraft, day.value)}
                    className={`rounded-md border px-2 py-1 text-xs ${
                      draft.weeklyDays.includes(day.value)
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                    disabled={formBusy || !isSessionConnected}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        )}
        <div className="rounded-md border border-dashed border-slate-300 bg-white p-3">
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor={`stop-cap-${flowType}`}>
            Parar automaticamente após N seguidos (opcional)
          </label>
          <input
            id={`stop-cap-${flowType}`}
            type="number"
            min={1}
            max={SCHEDULE_STOP_CAP_MAX}
            placeholder="Sem limite — deixe vazio"
            value={draft.stopAfterFollowedInput}
            onChange={(e) => setDraft({ ...draft, stopAfterFollowedInput: e.target.value })}
            disabled={formBusy || !isSessionConnected}
            className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-slate-500">
            Vale para este agendamento: somamos os perfis seguidos com sucesso em cada execução. Limite máximo{" "}
            {SCHEDULE_STOP_CAP_MAX.toLocaleString("pt-BR")}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void createSchedule(flowType)}
          disabled={formBusy || !isSessionConnected || hasInvalidSavedSlot}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          Salvar agendamento
        </button>
        {hasInvalidSavedSlot ? (
          <p className="text-xs text-amber-800">
            Ajuste o horário de disparo: alguma data da lista caiu no passado com o horário atual.
          </p>
        ) : null}
        <div className="space-y-2">
          {items.length === 0 ? (
            <p className="text-xs text-slate-500">Sem agendamentos salvos para este fluxo.</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                <p>
                  Status: <strong>{item.status}</strong> · Próximo:{" "}
                  {item.nextRunAt ? formatDateTimeBr(item.nextRunAt) : "não definido"}
                  {item.intervalMinutes != null && item.intervalMinutes > 0 ? (
                    <>
                      {" "}
                      · <strong>A cada {formatFollowScheduleIntervalBr(item.intervalMinutes)}</strong>
                      {item.intervalFirstRunAt ? (
                        <>
                          {" "}
                          · 1º disparo planejado: {formatDateTimeBr(item.intervalFirstRunAt)}
                        </>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {" "}
                      · Horário padrão: <code>{item.runTime}</code>
                      {item.timeZone ? (
                        <>
                          {" "}
                          · Fuso: <code>{item.timeZone}</code>
                        </>
                      ) : null}
                    </>
                  )}
                </p>
                {item.stopAfterTotalFollowed != null && item.stopAfterTotalFollowed > 0 ? (
                  <p className="mt-1 text-slate-600">
                    Seguidos (acumulado): <strong>{item.followedCountTotal ?? 0}</strong>
                    {" "}
                    / meta <strong>{item.stopAfterTotalFollowed}</strong>
                    {(item.followedCountTotal ?? 0) >= item.stopAfterTotalFollowed ? (
                      <span className="ml-1 font-medium text-emerald-700">— limite atingido</span>
                    ) : null}
                  </p>
                ) : null}
                <ul className="list-inside list-disc text-slate-600">
                  {item.entries.map((entry) => (
                    <li key={entry.date}>
                      {formatIsoDateBr(entry.date)} — {entry.quantity} perfis
                      {entry.dispatched ? (
                        <span className="ml-1 text-emerald-700">
                          (disparado{entry.dispatchedAt ? ` em ${formatDateTimeBr(entry.dispatchedAt)}` : ""})
                        </span>
                      ) : item.intervalMinutes != null && item.intervalMinutes > 0 ? (
                        <span className="ml-1 text-slate-500">(referência de quantidade)</span>
                      ) : (
                        <span className="ml-1 text-amber-800">(ainda não disparado)</span>
                      )}
                    </li>
                  ))}
                </ul>
                {(item.keepActive || (item.intervalMinutes != null && item.intervalMinutes > 0)) && item.recurrenceLastRunAt ? (
                  <p className="mt-1">Última execução: {formatDateTimeBr(item.recurrenceLastRunAt)}</p>
                ) : null}
                {item.targetUsername ? <p>Perfil alvo: @{item.targetUsername}</p> : null}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleScheduleStatus(item)}
                    className="rounded border border-slate-300 px-2 py-1 hover:bg-white"
                    disabled={formBusy}
                  >
                    {item.status === "active" ? "Pausar" : "Ativar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeSchedule(item)}
                    className="rounded border border-rose-200 px-2 py-1 text-rose-700 hover:bg-rose-50"
                    disabled={formBusy}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  if (!activeSessionId) {
    return (
      <div className="max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Nenhuma sessão ativa encontrada. Abra a página de Instagram e selecione uma sessão.
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-slate-900">Funcionalidades da sessão ativa</h2>
        <p className="text-sm text-slate-500">
          Sessão ativa: <code className="rounded bg-slate-100 px-1">{activeSessionId}</code>
        </p>
        {!isSessionConnected ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Esta sessão ainda não está conectada no Instagram. Faça login na página de sessões para
            habilitar conversas e automações.
          </p>
        ) : null}
      </div>

      <div
        role="tablist"
        aria-label="Funcionalidades desta sessão"
        className="flex w-full max-w-full flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5"
      >
        {SESSION_FEATURE_TABS.map((tab) => {
          const selected = activeFeatureTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`session-feature-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls="session-feature-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveFeatureTab(tab.id)}
              className={
                selected
                  ? "inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-slate-900 shadow-sm"
                  : "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              }
            >
              {tab.label}
              {tab.isNew ? (
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                  Novo
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id="session-feature-panel"
        aria-labelledby={`session-feature-tab-${activeFeatureTab}`}
        className="space-y-6"
      >
        {activeFeatureTab === "conversas" ? (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-slate-800">
          <Users className="h-5 w-5" aria-hidden />
          <h3 className="text-base font-semibold">Conversas da sessão</h3>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Acesse as conversas usando exatamente a sessão ativa selecionada.
        </p>
        <button
          type="button"
          onClick={() => void navigate("/conversas")}
          disabled={!isSessionConnected}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Abrir conversas da sessão
        </button>
      </div>
        ) : null}
        {activeFeatureTab === "webhook" ? (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-slate-800">
          <Users className="h-5 w-5" aria-hidden />
          <h3 className="text-base font-semibold">Webhook de mensagens recebidas</h3>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Quando ativo, cada nova mensagem recebida nesta sessão será enviada por POST para a URL informada.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="incoming-webhook-url" className="mb-1 block text-sm font-medium text-slate-700">
              URL do webhook
            </label>
            <input
              id="incoming-webhook-url"
              type="url"
              placeholder="https://seu-servico.com/webhook"
              value={incomingWebhookUrlInput}
              onChange={(e) => setIncomingWebhookUrlInput(e.target.value)}
              disabled={!isSessionConnected || formBusy}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={incomingWebhookEnabledInput}
              onChange={(e) => setIncomingWebhookEnabledInput(e.target.checked)}
              disabled={!isSessionConnected || formBusy}
            />
            Ativar webhook para mensagens recebidas
          </label>

          {incomingWebhookStatus ? (
            <p className="text-xs text-slate-500">
              Último envio: <strong>{incomingWebhookStatus === "ok" ? "sucesso" : "erro"}</strong>
              {incomingWebhookLastSentAt ? ` em ${formatDateTimeBr(incomingWebhookLastSentAt)}` : ""}
            </p>
          ) : null}
          {incomingWebhookLastError ? (
            <p className="text-xs text-rose-600">Último erro: {incomingWebhookLastError}</p>
          ) : null}
          {incomingWebhookMessage ? <p className="text-sm text-emerald-700">{incomingWebhookMessage}</p> : null}
          {incomingWebhookError ? <p className="text-sm text-rose-600">{incomingWebhookError}</p> : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSaveIncomingWebhook()}
              disabled={!isSessionConnected || formBusy}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {incomingWebhookSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {incomingWebhookSaving ? "Salvando..." : "Salvar webhook"}
            </button>
            <button
              type="button"
              onClick={() => void handleTestIncomingWebhook()}
              disabled={!isSessionConnected || formBusy || !activeSession?.incomingWebhookEnabled}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {incomingWebhookTesting ? "Enviando teste..." : "Enviar teste"}
            </button>
            <button
              type="button"
              onClick={() => setShowWebhookPayloadPreview((v) => !v)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              {showWebhookPayloadPreview ? "Ocultar payload" : "Ver payload do POST"}
            </button>
          </div>
          {showWebhookPayloadPreview ? (
            <pre className="overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              {incomingWebhookPayloadPreview}
            </pre>
          ) : null}
        </div>
      </div>
        ) : null}
        {activeFeatureTab === "autofollow" ? (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="border-b border-slate-100 pb-5">
          <div className="flex items-center gap-2 text-slate-800">
            <Users className="h-5 w-5 shrink-0" aria-hidden />
            <h3 className="text-base font-semibold">AutoFollow</h3>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Rode uma vez agora (execução manual) ou configure agendas: o backend dispara os jobs nos horários definidos,
            usando sempre esta sessão ativa.
          </p>
        </header>

        <section className="mt-6 space-y-4" aria-labelledby="autofollow-manual-heading">
          <div>
            <h4 id="autofollow-manual-heading" className="text-sm font-semibold text-slate-900">
              Execução manual
            </h4>
            <p className="mt-1 text-xs text-slate-500">
              Uma rodada imediata. Em &quot;Seguidores de um perfil&quot;, confirme o @ depois da prévia quando o Instagram
              validar o alvo.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Modo de execução manual"
            className="flex w-full max-w-full flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-100/80 p-0.5"
          >
            {AUTOFOLLOW_MANUAL_SUB_TABS.map((st) => {
              const sel = manualSubTab === st.id
              return (
                <button
                  key={st.id}
                  type="button"
                  role="tab"
                  id={`autofollow-manual-tab-${st.id}`}
                  aria-selected={sel}
                  aria-controls="autofollow-manual-panel"
                  tabIndex={sel ? 0 : -1}
                  onClick={() => setManualSubTab(st.id)}
                  className={
                    sel
                      ? "rounded-md bg-white px-3 py-1.5 text-xs font-medium text-slate-900 shadow-sm"
                      : "rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200/70"
                  }
                >
                  {st.label}
                </button>
              )
            })}
          </div>

          <div
            role="tabpanel"
            id="autofollow-manual-panel"
            aria-labelledby={`autofollow-manual-tab-${manualSubTab}`}
            className="rounded-lg border border-slate-200 bg-slate-50/50 p-4"
          >
            {manualSubTab === "suggested" ? (
              <>
                <div className="mb-4 border-b border-slate-200/80 pb-3">
                  <p className="text-xs leading-relaxed text-slate-500">
                    Segue contas a partir das sugestões do Instagram para esta sessão.
                  </p>
                </div>
                <form onSubmit={handleSubmitSuggested} className="flex flex-col space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="af-quantity" className="mb-1 block text-sm font-medium text-slate-700">
                        Quantidade (1 a 100)
                      </label>
                      <input
                        id="af-quantity"
                        type="number"
                        min={1}
                        max={100}
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        disabled={formBusy || !isSessionConnected}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
                      />
                    </div>
                    <div>
                      <label htmlFor="af-filter" className="mb-1 block text-sm font-medium text-slate-700">
                        Filtro de privacidade
                      </label>
                      <select
                        id="af-filter"
                        value={privacyFilter}
                        onChange={(e) => setPrivacyFilter(e.target.value as AutoFollowPrivacyFilter)}
                        disabled={formBusy || !isSessionConnected}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
                      >
                        <option value="any">Qualquer perfil</option>
                        <option value="public">Somente públicos</option>
                        <option value="private">Somente privados</option>
                      </select>
                    </div>
                  </div>

                  {error ? <p className="text-sm text-red-600">{error}</p> : null}

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="submit"
                      disabled={formBusy || !isSessionConnected}
                      className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
                      {isSubmitting ? "Executando..." : "Iniciar (sugeridos)"}
                    </button>
                  </div>

                  {result ? (
                    <div className="mt-auto border-t border-slate-200/80 pt-4">
                      <AutoFollowResultsPanel
                        result={result}
                        resultTab={resultTab}
                        setResultTab={setResultTab}
                      />
                    </div>
                  ) : null}
                </form>
              </>
            ) : (
              <>
                <div className="mb-4 border-b border-slate-200/80 pb-3">
                  <p className="text-xs leading-relaxed text-slate-500">
                    Informe o <strong>@</strong> alvo. <em>Iniciar</em> valida o perfil; use{" "}
                    <em>Confirmar e seguir seguidores</em> se a prévia estiver correta.
                  </p>
                </div>
                <form onSubmit={handleSubmitFollowers} className="flex flex-col space-y-4">
                <div>
                  <label htmlFor="ff-target" className="mb-1 block text-sm font-medium text-slate-700">
                    Perfil alvo
                  </label>
                  <input
                    id="ff-target"
                    type="text"
                    autoComplete="off"
                    placeholder="ex: nomedaconta"
                    value={ffTarget}
                    onChange={(e) => {
                      setFfTarget(e.target.value)
                      resetFollowersConfirmState()
                    }}
                    disabled={formBusy || !isSessionConnected}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                  {ffPreviewError ? <p className="mt-2 text-sm text-rose-600">{ffPreviewError}</p> : null}
                  {ffPreview && ffPreview.found ? (
                    <div
                      className={`mt-3 flex max-w-md gap-3 rounded-lg border p-3 text-sm text-slate-800 ${
                        ffAwaitingConfirm
                          ? "border-slate-900/15 bg-slate-50/90 ring-1 ring-slate-900/10"
                          : "border-emerald-200 bg-emerald-50/60"
                      }`}
                    >
                      {ffPreview.profilePicUrl ? (
                        <img
                          src={ffPreview.profilePicUrl}
                          alt=""
                          className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div
                          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-200 text-lg font-semibold text-slate-600 ring-2 ring-white"
                          aria-hidden
                        >
                          @{ffPreview.username.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">
                          <a
                            href={ffPreview.profileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline"
                          >
                            @{ffPreview.username}
                          </a>
                        </p>
                        {ffPreview.fullName ? (
                          <p className="text-slate-600">{ffPreview.fullName}</p>
                        ) : null}
                        {ffAwaitingConfirm ? (
                          <p className="mt-1 text-xs text-slate-500">
                            Se for a conta certa, clique em «Confirmar e seguir seguidores» abaixo.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {ffPreview && !ffPreview.found ? (
                    <p className="mt-2 text-sm text-amber-800">
                      Não foi possível localizar este perfil na verificação. Confira o @ e tente de novo. Se
                      tiver certeza que o @ existe, a API do Instagram pode ter bloqueado a prévia — nesse
                      caso não há o botão de confirmação.
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="ff-quantity" className="mb-1 block text-sm font-medium text-slate-700">
                      Quantidade (1 a 100)
                    </label>
                    <input
                      id="ff-quantity"
                      type="number"
                      min={1}
                      max={100}
                      value={ffQuantity}
                      onChange={(e) => setFfQuantity(Number(e.target.value))}
                      disabled={formBusy || !isSessionConnected}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                  <div>
                    <label htmlFor="ff-filter" className="mb-1 block text-sm font-medium text-slate-700">
                      Filtro de privacidade
                    </label>
                    <select
                      id="ff-filter"
                      value={ffPrivacy}
                      onChange={(e) => setFfPrivacy(e.target.value as AutoFollowPrivacyFilter)}
                      disabled={formBusy || !isSessionConnected}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    >
                      <option value="any">Qualquer perfil</option>
                      <option value="public">Somente públicos</option>
                      <option value="private">Somente privados</option>
                    </select>
                  </div>
                </div>

                {ffError ? <p className="text-sm text-red-600">{ffError}</p> : null}

                <div className="flex flex-wrap items-center gap-2">
                  {ffAwaitingConfirm ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void runFollowersAfterPreviewConfirm()}
                        disabled={ffSubmitting || !isSessionConnected}
                        className={`inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-none ${
                          ffSubmitting ? "" : "ff-confirm-blink"
                        }`}
                      >
                        {ffSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
                        {ffSubmitting ? "Executando…" : "Confirmar e seguir seguidores"}
                      </button>
                      <button
                        type="button"
                        onClick={resetFollowersConfirmState}
                        disabled={ffSubmitting}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Ajustar @
                      </button>
                    </>
                  ) : (
                    <button
                      type="submit"
                      disabled={formBusy || !isSessionConnected}
                      className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {ffPreviewLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
                      {ffPreviewLoading ? "Verificando perfil…" : "Iniciar (seguidores do perfil)"}
                    </button>
                  )}
                </div>

                {ffResult ? (
                  <div className="mt-auto border-t border-slate-200/80 pt-4">
                    <AutoFollowResultsPanel
                      result={ffResult}
                      resultTab={ffResultTab}
                      setResultTab={setFfResultTab}
                      extraSummary={
                        <p className="text-sm text-slate-600">
                          Perfil alvo:{" "}
                          <a
                            className="font-semibold text-slate-900 underline"
                            href={`https://www.instagram.com/${encodeURIComponent(ffResult.targetUsername)}/`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            @{ffResult.targetUsername}
                          </a>{" "}
                          · id {ffResult.targetUserId} · abertura: <code>{ffResult.profileOpenedVia}</code>
                        </p>
                      }
                    />
                  </div>
                ) : null}
              </form>
              </>
            )}
          </div>
        </section>

        <section className="mt-8 border-t border-slate-100 pt-8 space-y-4" aria-labelledby="autofollow-schedule-heading">
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden />
            <div>
              <h4 id="autofollow-schedule-heading" className="text-sm font-semibold text-slate-900">
                Agendamentos
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Defina datas ou recorrência e quantidade por disparo. O motor do backend executa nos horários configurados.
              </p>
            </div>
          </div>
          <div
            role="tablist"
            aria-label="Tipo de agenda"
            className="flex w-full max-w-full flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-100/80 p-0.5"
          >
            {AUTOFOLLOW_SCHEDULE_SUB_TABS.map((st) => {
              const sel = scheduleSubTab === st.id
              return (
                <button
                  key={st.id}
                  type="button"
                  role="tab"
                  id={`autofollow-schedule-tab-${st.id}`}
                  aria-selected={sel}
                  aria-controls="autofollow-schedule-panel"
                  tabIndex={sel ? 0 : -1}
                  onClick={() => setScheduleSubTab(st.id)}
                  className={
                    sel
                      ? "rounded-md bg-white px-3 py-1.5 text-xs font-medium text-slate-900 shadow-sm"
                      : "rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200/70"
                  }
                >
                  {st.label}
                </button>
              )
            })}
          </div>

          <div
            role="tabpanel"
            id="autofollow-schedule-panel"
            aria-labelledby={`autofollow-schedule-tab-${scheduleSubTab}`}
            className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/80 p-4"
          >
            {scheduleMessage ? <p className="text-sm text-emerald-700">{scheduleMessage}</p> : null}
            {scheduleError ? <p className="text-sm text-rose-600">{scheduleError}</p> : null}
            {scheduleSubTab === "suggested"
              ? renderSchedulePanel(
                  "Agenda: seguir sugeridos",
                  "suggested",
                  suggestedDraft,
                  setSuggestedDraft,
                  suggestedSchedules,
                )
              : renderSchedulePanel(
                  "Agenda: seguir seguidores de perfil",
                  "followers",
                  followersDraft,
                  setFollowersDraft,
                  followersSchedules,
                )}
          </div>
        </section>

        <footer className="mt-8 flex justify-end border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => void navigate("/connect-instagram")}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Voltar para sessões
          </button>
        </footer>
      </div>
        ) : null}
      </div>
    </div>
  )
}
