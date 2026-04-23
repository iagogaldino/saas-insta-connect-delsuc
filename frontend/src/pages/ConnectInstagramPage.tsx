import { AtSign, CheckCircle2, Loader2, LogIn, PlusCircle } from "lucide-react"
import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { useInstaConnect } from "../features/insta/use-insta-connect"

export function ConnectInstagramPage() {
  const navigate = useNavigate()
  const {
    isLinked,
    isManagingSessions,
    sessions,
    activeSessionId,
    createSession,
    setActiveSession,
    removeSession,
    connectInstagram,
    disconnectInstagram,
  } = useInstaConnect()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [showConnectForm, setShowConnectForm] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    const result = await connectInstagram(username, password)
    setIsSubmitting(false)
    if (result.success) {
      setPassword("")
      setShowConnectForm(false)
    } else {
      setError(result.error)
    }
  }

  async function handleCreateSession() {
    setError(null)
    setIsCreatingSession(true)
    const result = await createSession(true)
    setIsCreatingSession(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    setShowConnectForm(true)
    setUsername("")
    setPassword("")
  }

  async function handleSetActiveSession(sessionId: string) {
    setError(null)
    const result = await setActiveSession(sessionId)
    if (!result.success) {
      setError(result.error)
    }
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
    setShowConnectForm(false)
    setUsername("")
    setPassword("")
  }

  async function handleOpenSessionFeatures(sessionId: string, isActive: boolean) {
    setError(null)
    if (!isActive) {
      const result = await setActiveSession(sessionId)
      if (!result.success) {
        setError(result.error)
        return
      }
      setShowConnectForm(false)
    }
    void navigate("/instagram/session-active")
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          {isLinked ? "Instagram conectado" : "Conectar Instagram"}
        </h2>
      </div>

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
        <div className="space-y-2">
          {sessions.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma sessão encontrada ainda.</p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                role="button"
                tabIndex={0}
                onClick={() => void handleOpenSessionFeatures(session.id, session.isActive)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    void handleOpenSessionFeatures(session.id, session.isActive)
                  }
                }}
                className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition hover:border-slate-300 hover:bg-slate-100"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-slate-700">{session.id}</p>
                  <p className="text-xs text-slate-500">
                    {session.isActive ? "Sessão ativa" : "Sessão disponível"}
                  </p>
                </div>
                {!session.isActive ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleSetActiveSession(session.id)
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
            ))
          )}
        </div>
        {activeSessionId ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>
              Ativa agora: <code className="rounded bg-slate-100 px-1">{activeSessionId}</code>
            </span>
          </div>
        ) : null}
      </div>

      {isLinked ? (
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
            Sessão do Instagram ativa.
          </div>
          <button
            type="button"
            onClick={() => {
              disconnectInstagram()
            }}
            className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-sm text-emerald-900 hover:bg-emerald-100"
          >
            Remover ligação
          </button>
        </div>
      ) : null}

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
    </div>
  )
}
