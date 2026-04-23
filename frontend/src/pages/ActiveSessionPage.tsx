import axios from "axios"
import { Loader2, Play, Users } from "lucide-react"
import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { useInstaConnect } from "../features/insta/use-insta-connect"
import { postAutoFollowSuggested, type AutoFollowPrivacyFilter, type AutoFollowResponse } from "../lib/insta"

export function ActiveSessionPage() {
  const navigate = useNavigate()
  const { activeSessionId, sessions } = useInstaConnect()
  const [quantity, setQuantity] = useState(3)
  const [privacyFilter, setPrivacyFilter] = useState<AutoFollowPrivacyFilter>("any")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AutoFollowResponse | null>(null)
  const [resultTab, setResultTab] = useState<"followed" | "failed">("followed")

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setResult(null)
    setResultTab("followed")
    setIsSubmitting(true)
    try {
      const { data } = await postAutoFollowSuggested(quantity, privacyFilter)
      setResult(data)
    } catch (e) {
      if (axios.isAxiosError(e)) {
        const body = e.response?.data as { error?: string } | undefined
        const apiError = body?.error ?? e.message
        setError(apiError)
        const authSessionError =
          apiError.includes("Sessao nao autenticada. Faca login antes de seguir.") ||
          apiError.includes("Sessão não autenticada. Faça login antes de seguir.")
        if (authSessionError && activeSessionId) {
          void navigate(
            `/connect-instagram?reloginSessionId=${encodeURIComponent(activeSessionId)}`,
          )
        }
      } else {
        setError(e instanceof Error ? e.message : "Erro desconhecido.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const followedItems = result?.results.filter((item) => item.success) ?? []
  const failedItems = result?.results.filter((item) => !item.success) ?? []
  const visibleItems = resultTab === "followed" ? followedItems : failedItems
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null
  const isSessionConnected = Boolean(activeSession?.instagramUsername)

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

        <form onSubmit={handleSubmit} className="space-y-4">
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
              disabled={isSubmitting || !isSessionConnected}
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
              disabled={isSubmitting || !isSessionConnected}
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
              disabled={isSubmitting || !isSessionConnected}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
              {isSubmitting ? "Executando..." : "Iniciar AutoFollow"}
            </button>
            <button
              type="button"
              onClick={() => void navigate("/connect-instagram")}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Voltar para sessões
            </button>
          </div>
        </form>
      </div>

      {result ? (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
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
                      className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
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
      ) : null}
    </div>
  )
}
