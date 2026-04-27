import { AtSign, Loader2, LogIn, PlusCircle } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useInstaConnect } from "../features/insta/use-insta-connect"

export function ConnectInstagramPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const {
    isManagingSessions,
    sessions,
    activeSessionId,
    createSession,
    setActiveSession,
    startSessionRuntime,
    stopSessionRuntime,
    removeSession,
    connectInstagramToSession,
    submitSecurityCodeForSession,
  } = useInstaConnect()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [showConnectForm, setShowConnectForm] = useState(false)
  const [showTwoFactorForm, setShowTwoFactorForm] = useState(false)
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null)
  const [pendingTwoFactorUsername, setPendingTwoFactorUsername] = useState<string>("")
  const [previousActiveSessionId, setPreviousActiveSessionId] = useState<string | null>(null)
  const [securityCode, setSecurityCode] = useState("")
  const [runtimeNotice, setRuntimeNotice] = useState<{ text: string; isAuthenticated: boolean } | null>(null)

  useEffect(() => {
    const reloginSessionId = searchParams.get("reloginSessionId")
    if (!reloginSessionId) return
    const targetSession = sessions.find((s) => s.id === reloginSessionId)
    if (!targetSession) return

    setError("Sua sessão Instagram expirou. Faça login novamente nesta sessão.")
    setPendingSessionId(targetSession.id)
    setPreviousActiveSessionId(activeSessionId)
    setShowConnectForm(true)
    setShowTwoFactorForm(false)
    setPendingTwoFactorUsername("")
    setUsername(targetSession.instagramUsername ?? "")
    setPassword("")
    setSecurityCode("")

    void navigate("/app/connect-instagram", { replace: true })
  }, [searchParams, sessions, activeSessionId, navigate])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!pendingSessionId) {
      setError("Crie uma nova sessão antes de conectar o Instagram.")
      return
    }
    setIsSubmitting(true)
    const result = await connectInstagramToSession(pendingSessionId, username, password)
    if (result.success) {
      setPassword("")
      setSecurityCode("")
      setShowConnectForm(false)
      setShowTwoFactorForm(false)
      setPendingSessionId(null)
      setPendingTwoFactorUsername("")
      setPreviousActiveSessionId(null)
      setIsSubmitting(false)
    } else if ("challengeRequired" in result && result.challengeRequired) {
      setShowConnectForm(false)
      setShowTwoFactorForm(true)
      setPendingTwoFactorUsername(result.username)
      setSecurityCode("")
      setError(
        result.message ??
          "Instagram pediu código de segurança. Digite o código recebido para concluir a conexão.",
      )
      setPassword("")
      setIsSubmitting(false)
    } else {
      const removeResult = await removeSession(pendingSessionId)
      const loginError = "error" in result ? result.error : "Falha ao iniciar challenge 2FA."
      if (!removeResult.success) {
        setError(`${loginError} Também falhou ao remover sessão provisória: ${removeResult.error}`)
      } else if (previousActiveSessionId && previousActiveSessionId !== pendingSessionId) {
        await setActiveSession(previousActiveSessionId)
        setError(loginError)
      } else {
        setError(loginError)
      }
      setShowConnectForm(false)
      setShowTwoFactorForm(false)
      setPendingSessionId(null)
      setPendingTwoFactorUsername("")
      setPreviousActiveSessionId(null)
      setUsername("")
      setPassword("")
      setSecurityCode("")
      setIsSubmitting(false)
    }
  }

  async function handleSubmitTwoFactorCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!pendingSessionId || !pendingTwoFactorUsername) {
      setError("Sessão pendente de 2FA não encontrada. Inicie o login novamente.")
      return
    }
    setIsSubmitting(true)
    const result = await submitSecurityCodeForSession(
      pendingSessionId,
      pendingTwoFactorUsername,
      securityCode,
    )
    if (result.success) {
      setShowTwoFactorForm(false)
      setShowConnectForm(false)
      setPendingSessionId(null)
      setPendingTwoFactorUsername("")
      setPreviousActiveSessionId(null)
      setSecurityCode("")
      setPassword("")
      setIsSubmitting(false)
      return
    }
    if ("challengeRequired" in result && result.challengeRequired) {
      setError(result.message ?? "Código inválido ou challenge ainda pendente. Tente novamente.")
      setSecurityCode("")
      setIsSubmitting(false)
      return
    }
    setError("error" in result ? result.error : "Falha ao validar código de segurança.")
    setSecurityCode("")
    setIsSubmitting(false)
  }

  async function handleCancelTwoFactorFlow() {
    if (!pendingSessionId) {
      setShowTwoFactorForm(false)
      setPendingTwoFactorUsername("")
      return
    }
    const removeResult = await removeSession(pendingSessionId)
    if (!removeResult.success) {
      setError(`Falhou ao cancelar 2FA e remover sessão provisória: ${removeResult.error}`)
      return
    }
    if (previousActiveSessionId && previousActiveSessionId !== pendingSessionId) {
      await setActiveSession(previousActiveSessionId)
    }
    setShowTwoFactorForm(false)
    setShowConnectForm(false)
    setPendingSessionId(null)
    setPendingTwoFactorUsername("")
    setPreviousActiveSessionId(null)
    setUsername("")
    setPassword("")
    setSecurityCode("")
    setError(null)
  }

  async function handleCreateSession() {
    setError(null)
    setIsCreatingSession(true)
    const previousActive = activeSessionId
    const result = await createSession(false)
    setIsCreatingSession(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    const newestSession = result.sessions[result.sessions.length - 1]
    if (!newestSession) {
      setError("Não foi possível criar sessão provisória.")
      return
    }
    setPreviousActiveSessionId(previousActive)
    setPendingSessionId(newestSession.id)
    setShowConnectForm(true)
    setShowTwoFactorForm(false)
    setPendingTwoFactorUsername("")
    setError(null)
    setUsername("")
    setPassword("")
    setSecurityCode("")
  }

  async function handleSetActiveSession(sessionId: string, hasConnectedInstagram: boolean) {
    setError(null)
    if (!hasConnectedInstagram) {
      setPreviousActiveSessionId(activeSessionId)
      setPendingSessionId(sessionId)
      setShowConnectForm(true)
      setShowTwoFactorForm(false)
      setPendingTwoFactorUsername("")
      setUsername("")
      setPassword("")
      setSecurityCode("")
      return
    }
    const result = await setActiveSession(sessionId)
    if (!result.success) {
      setError(result.error)
      return
    }
    setPendingSessionId(null)
    setPreviousActiveSessionId(null)
    setShowConnectForm(false)
    setShowTwoFactorForm(false)
    setPendingTwoFactorUsername("")
    setSecurityCode("")
  }

  async function handleRemoveSession(sessionId: string) {
    const confirmed = window.confirm("Deseja remover esta sessão do Instagram?")
    if (!confirmed) return
    setError(null)
    const result = await removeSession(sessionId)
    if (!result.success) {
      setError(result.error)
      return
    }
    setPendingSessionId(null)
    setPreviousActiveSessionId(null)
    setShowConnectForm(false)
    setShowTwoFactorForm(false)
    setPendingTwoFactorUsername("")
    setUsername("")
    setPassword("")
    setSecurityCode("")
  }

  async function handleStartSessionRuntime(sessionId: string) {
    setError(null)
    setRuntimeNotice(null)
    const result = await startSessionRuntime(sessionId)
    if (!result.success) {
      setError(result.error)
      return
    }
    const sessionAfterStart = result.sessions.find((s) => s.id === sessionId)
    if (!result.isInstagramAuthenticated) {
      setRuntimeNotice({
        text:
          result.runtimeStatusMessage ??
          "Instância ligada com sucesso para a sessão selecionada.",
        isAuthenticated: false,
      })
    }
    if (!result.isInstagramAuthenticated) {
      setPendingSessionId(sessionId)
      setPreviousActiveSessionId(activeSessionId)
      setShowConnectForm(true)
      setShowTwoFactorForm(false)
      setPendingTwoFactorUsername("")
      setUsername(sessionAfterStart?.instagramUsername ?? "")
      setPassword("")
      setSecurityCode("")
    }
  }

  async function handleStopSessionRuntime(sessionId: string) {
    setError(null)
    setRuntimeNotice(null)
    const result = await stopSessionRuntime(sessionId)
    if (!result.success) {
      setError(result.error)
      return
    }
    setRuntimeNotice({
      text:
        result.runtimeStatusMessage ??
        "Instância desligada com sucesso para a sessão selecionada.",
      isAuthenticated: Boolean(result.isInstagramAuthenticated),
    })
  }

  async function handleOpenSessionFeatures(
    sessionId: string,
    isActive: boolean,
    hasConnectedInstagram: boolean,
  ) {
    setError(null)
    if (!isActive) {
      if (!hasConnectedInstagram) {
        setPreviousActiveSessionId(activeSessionId)
        setPendingSessionId(sessionId)
        setShowConnectForm(true)
        setShowTwoFactorForm(false)
        setPendingTwoFactorUsername("")
        setUsername("")
        setPassword("")
        setSecurityCode("")
        return
      }
      const result = await setActiveSession(sessionId)
      if (!result.success) {
        setError(result.error)
        return
      }
      setPendingSessionId(null)
      setPreviousActiveSessionId(null)
      setShowConnectForm(false)
      setShowTwoFactorForm(false)
      setPendingTwoFactorUsername("")
      setSecurityCode("")
    }
    void navigate("/app/instagram/session-active")
  }

  return (
    <div className="max-w-2xl space-y-6">
      

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Sessões Instagram</h3>
          <button
            type="button"
            onClick={handleCreateSession}
            disabled={isCreatingSession || isManagingSessions}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isCreatingSession ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <PlusCircle className="h-4 w-4" aria-hidden />
            )}
            Nova sessão
          </button>
        </div>
        {runtimeNotice ? (
          <p
            className={`rounded-lg border p-3 text-sm ${
              runtimeNotice.isAuthenticated
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            {runtimeNotice.text}
          </p>
        ) : null}
        <div className="space-y-2">
          {sessions.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma sessão encontrada ainda.</p>
          ) : (
            sessions.map((session) => {
              const hasLoginOk =
                session.isRuntimeOn && Boolean(session.instagramUsername) && !session.requiresRelogin

              return (
              <div
                key={session.id}
                role={hasLoginOk ? "button" : undefined}
                aria-disabled={!hasLoginOk}
                tabIndex={hasLoginOk ? 0 : -1}
                onClick={() => {
                  if (!hasLoginOk) return
                  void handleOpenSessionFeatures(
                    session.id,
                    session.isActive,
                    Boolean(session.instagramUsername),
                  )
                }}
                onKeyDown={(e) => {
                  if (!hasLoginOk) return
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    void handleOpenSessionFeatures(
                      session.id,
                      session.isActive,
                      Boolean(session.instagramUsername),
                    )
                  }
                }}
                className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 transition ${
                  hasLoginOk
                    ? "border-emerald-300 bg-emerald-50 hover:border-emerald-400 hover:bg-emerald-100/70"
                    : "cursor-not-allowed border-slate-200 bg-slate-50 opacity-80"
                }`}
              >
                <div className="min-w-0 flex items-center gap-2">
                  {session.instagramProfilePicUrl ? (
                    <img
                      src={session.instagramProfilePicUrl}
                      alt={session.instagramUsername ? `Foto de @${session.instagramUsername}` : "Foto do Instagram"}
                      className="h-8 w-8 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600">
                      IG
                    </div>
                  )}
                  <div className="min-w-0">
                    {session.instagramUsername ? (
                      <p className="truncate text-xs font-semibold text-slate-800">
                        @{session.instagramUsername}
                        {session.instagramFullName ? ` - ${session.instagramFullName}` : ""}
                      </p>
                    ) : null}
                    <p className={`truncate font-mono text-[11px] ${hasLoginOk ? "text-emerald-800" : "text-slate-600"}`}>
                      {session.id}
                    </p>
                  </div>
                </div>
                
                {!session.isActive ? (
                  <div className="flex items-center gap-2">
                    {!session.isRuntimeOn ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleStartSessionRuntime(session.id)
                        }}
                        disabled={isManagingSessions}
                        className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        Ligar instância
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleStopSessionRuntime(session.id)
                        }}
                        disabled={isManagingSessions}
                        className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        Desligar instância
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleSetActiveSession(session.id, Boolean(session.instagramUsername))
                      }}
                      disabled={isManagingSessions}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      Usar
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleRemoveSession(session.id)
                      }}
                      disabled={isManagingSessions}
                      className="rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      Remover
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {!session.isRuntimeOn ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleStartSessionRuntime(session.id)
                        }}
                        disabled={isManagingSessions}
                        className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        Ligar instância
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleStopSessionRuntime(session.id)
                        }}
                        disabled={isManagingSessions}
                        className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        Desligar instância
                      </button>
                    )}
                    <span className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700">Ativa</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleRemoveSession(session.id)
                      }}
                      disabled={isManagingSessions}
                      className="rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      Remover
                    </button>
                  </div>
                )}
              </div>
            )})
          )}
        </div>
      </div>

      {showConnectForm ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center gap-2 text-slate-800">
            <AtSign className="h-5 w-5" aria-hidden />
            <span className="text-sm font-medium">Conta do Instagram</span>
          </div>
          <div>
            <label htmlFor="ig-username" className="mb-1 block text-sm font-medium text-slate-700">
              Usuário, e-mail ou telefone
            </label>
            <input
              id="ig-username"
              type="text"
              name="username"
              autoComplete="username"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label htmlFor="ig-password" className="mb-1 block text-sm font-medium text-slate-700">
              Senha do Instagram
            </label>
            <input
              id="ig-password"
              type="password"
              name="password"
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <LogIn className="h-4 w-4" aria-hidden />
            )}
            {isSubmitting ? "Conectando no Instagram…" : "Conectar"}
          </button>
          <p className="text-xs text-slate-400">
            Pode levar ~1 min. 2FA e verificações exigem o backend com Chrome visível (sem
            INSTA_HEADLESS).
          </p>
        </form>
      ) : null}

      {showTwoFactorForm ? (
        <form
          onSubmit={handleSubmitTwoFactorCode}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center gap-2 text-slate-800">
            <AtSign className="h-5 w-5" aria-hidden />
            <span className="text-sm font-medium">Confirmar código de segurança (2FA)</span>
          </div>
          <div>
            <label htmlFor="ig-security-code" className="mb-1 block text-sm font-medium text-slate-700">
              Código recebido
            </label>
            <input
              id="ig-security-code"
              type="text"
              name="security-code"
              autoComplete="one-time-code"
              inputMode="numeric"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
              value={securityCode}
              onChange={(e) => setSecurityCode(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <LogIn className="h-4 w-4" aria-hidden />
              )}
              {isSubmitting ? "Validando código…" : "Confirmar código"}
            </button>
            <button
              type="button"
              onClick={() => {
                void handleCancelTwoFactorFlow()
              }}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Cancelar
            </button>
          </div>
          <p className="text-xs text-slate-400">
            Se o Instagram solicitar novo código, você pode tentar novamente sem reiniciar a sessão.
          </p>
        </form>
      ) : null}
    </div>
  )
}
