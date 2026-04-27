import axios from "axios"
import { Loader2, Play, Users } from "lucide-react"
import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { useInstaConnect } from "../features/insta/use-insta-connect"
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

type ResultPanelData = {
  requested: number
  followed: number
  attempted: number
  privacyFilter: string
  results: AutoFollowResultItem[]
}

type ScheduleDraftEntry = { date: string; quantity: number }

type ScheduleDraft = {
  entries: ScheduleDraftEntry[]
  dateInput: string
  quantityInput: number
  runTime: string
  keepActive: boolean
  weeklyDays: number[]
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
    entries: [],
    dateInput: "",
    quantityInput: 20,
    runTime: "10:00",
    keepActive: false,
    weeklyDays: [],
  })
  const [followersDraft, setFollowersDraft] = useState<ScheduleDraft>({
    entries: [],
    dateInput: "",
    quantityInput: 20,
    runTime: "10:00",
    keepActive: false,
    weeklyDays: [],
  })

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
    setIncomingWebhookUrlInput(activeSession?.incomingWebhookUrl ?? "")
    setIncomingWebhookEnabledInput(Boolean(activeSession?.incomingWebhookEnabled))
    setIncomingWebhookMessage(null)
    setIncomingWebhookError(null)
  }, [activeSessionId, activeSession?.incomingWebhookUrl, activeSession?.incomingWebhookEnabled])

  useEffect(() => {
    void refreshSchedules()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId])

  async function refreshSchedules() {
    if (!activeSessionId) {
      setSuggestedSchedules([])
      setFollowersSchedules([])
      return
    }
    setScheduleLoading(true)
    try {
      const [suggestedRes, followersRes] = await Promise.all([
        getFollowSchedules("suggested"),
        getFollowSchedules("followers"),
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
      setScheduleLoading(false)
    }
  }

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
    if (draft.entries.length === 0) {
      setScheduleError("Adicione ao menos uma data no calendário.")
      return
    }
    if (draft.keepActive && draft.weeklyDays.length === 0) {
      setScheduleError("Para manter ativa, selecione ao menos um dia da semana.")
      return
    }
    if (flowType === "followers" && !ffTarget.trim()) {
      setScheduleError("Informe o perfil alvo para agendamento de seguidores.")
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
    setScheduleLoading(true)
    try {
      await postFollowSchedule({
        flowType,
        entries: draft.entries,
        privacyFilter: flowType === "suggested" ? privacyFilter : ffPrivacy,
        targetUsername: flowType === "followers" ? ffTarget.trim() : undefined,
        keepActive: draft.keepActive,
        weeklyDays: draft.keepActive ? draft.weeklyDays : [],
        runTime: draft.runTime,
      })
      setDraft({
        entries: [],
        dateInput: "",
        quantityInput: 20,
        runTime: draft.runTime,
        keepActive: draft.keepActive,
        weeklyDays: draft.weeklyDays,
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
    const started = Date.now()
    while (true) {
      const { data } = await getAutoFollowJobStatus(jobId)
      if (data.job.status === "completed") {
        return data.job.result as T
      }
      if (data.job.status === "failed") {
        throw new Error(data.job.error ?? "A automação falhou no processamento em background.")
      }
      if (Date.now() - started > 30 * 60 * 1000) {
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
    const hasInvalidSavedSlot = draft.entries.some((e) => isLocalDateTimeInThePast(e.date, draft.runTime))

    return (
      <div className="space-y-3 rounded-lg border border-slate-200 p-4">
        <h5 className="text-sm font-semibold text-slate-800">{title}</h5>
        <p className="text-xs text-slate-500">
          Só é permitido agendar a partir de hoje; se a data for hoje, o horário precisa ser depois de agora.
        </p>
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
              <div key={entry.date} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm">
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
                  {item.nextRunAt ? formatDateTimeBr(item.nextRunAt) : "não definido"} · Horário padrão:{" "}
                  <code>{item.runTime}</code>
                </p>
                <ul className="list-inside list-disc text-slate-600">
                  {item.entries.map((entry) => (
                    <li key={entry.date}>
                      {formatIsoDateBr(entry.date)} — {entry.quantity} perfis
                      {entry.dispatched ? (
                        <span className="ml-1 text-emerald-700">
                          (disparado{entry.dispatchedAt ? ` em ${formatDateTimeBr(entry.dispatchedAt)}` : ""})
                        </span>
                      ) : (
                        <span className="ml-1 text-amber-800">(ainda não disparado)</span>
                      )}
                    </li>
                  ))}
                </ul>
                {item.keepActive && item.recurrenceLastRunAt ? (
                  <p className="mt-1">Último disparo recorrente: {formatDateTimeBr(item.recurrenceLastRunAt)}</p>
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

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-slate-800">
          <Users className="h-5 w-5" aria-hidden />
          <h3 className="text-base font-semibold">AutoFollow</h3>
        </div>
        <div className="mb-5 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">
            Recomendações de segurança (estimativas de mercado para 2026, sem números oficiais do Instagram):
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded border border-amber-200 bg-white/70 p-2">
              <p className="font-semibold">Conta nova (&lt; 3 meses)</p>
              <p>50 a 100 follows/dia</p>
              <p className="text-xs opacity-80">Ritmo sugerido: 5 a 10 por hora</p>
            </div>
            <div className="rounded border border-amber-200 bg-white/70 p-2">
              <p className="font-semibold">Conta antiga/ativa</p>
              <p>150 a 200 follows/dia</p>
              <p className="text-xs opacity-80">Ritmo sugerido: 15 a 20 por hora</p>
            </div>
          </div>
          <div className="space-y-1 text-xs leading-relaxed">
            <p>• Limite total da conta: ~7.500 pessoas seguidas.</p>
            <p>• Simule comportamento humano: intervalos de 30 a 60 segundos entre ações.</p>
            <p>• Evite combinar muitos follows + curtidas + DMs no mesmo dia.</p>
            <p>• Aquecimento recomendado para conta nova: começar com ~20/dia e subir gradualmente.</p>
            <p>
              • Se ocorrer bloqueio de ação (Action Block), pause a automação por 24 a 48 horas.
            </p>
          </div>
        </div>

        <div className="mb-6 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h4 className="text-sm font-semibold text-slate-800">Agendamento de AutoFollow</h4>
          <p className="text-xs text-slate-600">
            Selecione datas e quantidade por dia. O motor interno do backend executa automaticamente nos horários configurados.
          </p>
          {scheduleMessage ? <p className="text-sm text-emerald-700">{scheduleMessage}</p> : null}
          {scheduleError ? <p className="text-sm text-rose-600">{scheduleError}</p> : null}
          {renderSchedulePanel(
            "Agenda: seguir sugeridos",
            "suggested",
            suggestedDraft,
            setSuggestedDraft,
            suggestedSchedules,
          )}
          {renderSchedulePanel(
            "Agenda: seguir seguidores de perfil",
            "followers",
            followersDraft,
            setFollowersDraft,
            followersSchedules,
          )}
        </div>

        <h4 className="mb-3 text-sm font-semibold text-slate-800">A partir de sugeridos (Explore)</h4>
        <form onSubmit={handleSubmitSuggested} className="mb-8 space-y-4">
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
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 sm:w-56"
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
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 sm:w-56"
            >
              <option value="any">Qualquer perfil</option>
              <option value="public">Somente públicos</option>
              <option value="private">Somente privados</option>
            </select>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex items-center gap-2">
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
            <AutoFollowResultsPanel
              result={result}
              resultTab={resultTab}
              setResultTab={setResultTab}
            />
          ) : null}
        </form>

        <h4 className="mb-3 text-sm font-semibold text-slate-800">Seguidores de um perfil</h4>
        <p className="mb-3 text-sm text-slate-500">
          Informe o <strong>@</strong> do perfil cujos <em>seguidores</em> você quer seguir. Ao clicar em{" "}
          <em>Iniciar</em>, o app verifica se o perfil existe; se achar, mostra foto e nome e libera
          o botão para confirmar. A automação lê a lista de seguidores e aplica o filtro de privacidade
          abaixo.
        </p>
        <form onSubmit={handleSubmitFollowers} className="space-y-4">
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
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 sm:max-w-md"
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
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 sm:w-56"
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
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 sm:w-56"
            >
              <option value="any">Qualquer perfil</option>
              <option value="public">Somente públicos</option>
              <option value="private">Somente privados</option>
            </select>
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
            <button
              type="button"
              onClick={() => void navigate("/connect-instagram")}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Voltar para sessões
            </button>
          </div>

          {ffResult ? (
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
          ) : null}
        </form>
      </div>
    </div>
  )
}
