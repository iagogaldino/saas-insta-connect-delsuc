import axios from "axios"
import { BarChart3, Clock3, TrendingUp, Users } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { postCreateIntegrationToken } from "../lib/auth"
import { getFollowsMetrics, type FollowsMetricsResponse } from "../lib/insta"

export function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<FollowsMetricsResponse | null>(null)
  const [isGeneratingToken, setIsGeneratingToken] = useState(false)
  const [integrationToken, setIntegrationToken] = useState<string | null>(null)
  const [integrationTokenMeta, setIntegrationTokenMeta] = useState<string | null>(null)
  const [integrationTokenError, setIntegrationTokenError] = useState<string | null>(null)
  const [copyMessage, setCopyMessage] = useState<string | null>(null)
  const [showIntegrationDocs, setShowIntegrationDocs] = useState(false)

  useEffect(() => {
    let active = true
    const run = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const { data } = await getFollowsMetrics(30)
        if (active) setMetrics(data)
      } catch (e) {
        if (!active) return
        if (axios.isAxiosError(e)) {
          const body = e.response?.data as { error?: string } | undefined
          setError(body?.error ?? e.message)
        } else {
          setError(e instanceof Error ? e.message : "Erro ao carregar métricas.")
        }
      } finally {
        if (active) setIsLoading(false)
      }
    }
    void run()
    return () => {
      active = false
    }
  }, [])

  const peakDay = useMemo(() => {
    if (!metrics || metrics.perDay.length === 0) return null
    return metrics.perDay.reduce((acc, curr) => (curr.count > acc.count ? curr : acc), metrics.perDay[0])
  }, [metrics])

  const avgPerDay = useMemo(() => {
    if (!metrics || metrics.days <= 0) return 0
    return metrics.totals.inWindow / metrics.days
  }, [metrics])

  async function handleGenerateIntegrationToken() {
    setIsGeneratingToken(true)
    setIntegrationTokenError(null)
    setCopyMessage(null)
    try {
      const { data } = await postCreateIntegrationToken()
      setIntegrationToken(data.token)
      setIntegrationTokenMeta(`Token de integração gerado (expira em ${data.expiresIn}).`)
    } catch (e) {
      if (axios.isAxiosError(e)) {
        const body = e.response?.data as { error?: string } | undefined
        setIntegrationTokenError(body?.error ?? e.message)
      } else {
        setIntegrationTokenError(e instanceof Error ? e.message : "Erro ao gerar token de integração.")
      }
    } finally {
      setIsGeneratingToken(false)
    }
  }

  async function handleCopyToken() {
    if (!integrationToken) return
    try {
      await navigator.clipboard.writeText(integrationToken)
      setCopyMessage("Token copiado.")
    } catch {
      setCopyMessage("Não foi possível copiar automaticamente.")
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Token de integração</h3>
        <p className="mb-3 text-sm text-slate-500">
          Gere um token para integrar serviços externos neste SaaS (envio de mensagens e listagem via API).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleGenerateIntegrationToken()}
            disabled={isGeneratingToken}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isGeneratingToken ? "Gerando..." : "Gerar token"}
          </button>
          {integrationToken ? (
            <button
              type="button"
              onClick={() => void handleCopyToken()}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Copiar token
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShowIntegrationDocs((v) => !v)}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            {showIntegrationDocs ? "Ocultar documentação" : "Ver documentação"}
          </button>
        </div>
        {integrationTokenMeta ? <p className="mt-3 text-xs text-slate-500">{integrationTokenMeta}</p> : null}
        {integrationTokenError ? <p className="mt-3 text-sm text-rose-600">{integrationTokenError}</p> : null}
        {copyMessage ? <p className="mt-2 text-xs text-emerald-700">{copyMessage}</p> : null}
        {integrationToken ? (
          <div className="mt-3">
            <p className="mb-1 text-xs font-medium text-slate-600">Use este token como Bearer nas chamadas da API:</p>
            <pre className="overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              {integrationToken}
            </pre>
          </div>
        ) : null}
        {showIntegrationDocs ? (
          <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <p className="font-medium text-slate-800">Documentação rápida de integração</p>
            <p>
              Base URL local: <code>http://127.0.0.1:3000</code>
            </p>
            <p>
              Header obrigatório: <code>Authorization: Bearer SEU_TOKEN</code>
            </p>
            <p>
              Para escolher o Instagram da requisição, envie também:{" "}
              <code>x-insta-session-id: ID_DA_SESSAO</code> (ou query <code>sessionId</code>).
            </p>
            <div>
              <p className="mb-1 font-medium text-slate-800">Listar conversas</p>
              <pre className="overflow-auto rounded-md border border-slate-200 bg-white p-2 text-[11px]">
{`curl "http://127.0.0.1:3000/insta/conversations?limit=30" \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "x-insta-session-id: ID_DA_SESSAO"`}
              </pre>
            </div>
            <div>
              <p className="mb-1 font-medium text-slate-800">Ler mensagens da thread</p>
              <pre className="overflow-auto rounded-md border border-slate-200 bg-white p-2 text-[11px]">
{`curl "http://127.0.0.1:3000/insta/messages?threadId=THREAD_ID&limit=50" \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "x-insta-session-id: ID_DA_SESSAO"`}
              </pre>
            </div>
            <div>
              <p className="mb-1 font-medium text-slate-800">Enviar mensagem</p>
              <pre className="overflow-auto rounded-md border border-slate-200 bg-white p-2 text-[11px]">
{`curl "http://127.0.0.1:3000/insta/messages" \\
  -X POST \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "x-insta-session-id: ID_DA_SESSAO" \\
  -d '{"conversationTitle":"NOME_DA_CONVERSA","text":"Olá!"}'`}
              </pre>
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            {
              label: "Seguidos (30 dias)",
              value: isLoading ? "..." : String(metrics?.totals.inWindow ?? 0),
              icon: Users,
            },
            {
              label: "Seguidos (total)",
              value: isLoading ? "..." : String(metrics?.totals.allTime ?? 0),
              icon: TrendingUp,
            },
            {
              label: "Média por dia",
              value: isLoading ? "..." : avgPerDay.toFixed(1),
              icon: BarChart3,
            },
            {
              label: "Pico diário (30 dias)",
              value: isLoading ? "..." : String(peakDay?.count ?? 0),
              icon: Clock3,
            },
          ] as const
        ).map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-sm font-medium">{card.label}</span>
                <Icon className="h-5 w-5 opacity-50" aria-hidden />
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums text-slate-900">{card.value}</p>
              <p className="mt-1 text-xs text-slate-400">Dados de follows salvos no Mongo</p>
            </div>
          )
        })}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Últimos perfis seguidos</h3>
        {isLoading ? <p className="text-sm text-slate-500">Carregando...</p> : null}
        {!isLoading && metrics?.recent.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum follow registrado ainda.</p>
        ) : null}
        <div className="space-y-2">
          {(metrics?.recent ?? []).slice(0, 8).map((item, idx) => (
            <div key={`${item.username}-${item.followedAt}-${idx}`} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
              {item.profilePicUrl ? (
                <img src={item.profilePicUrl} alt={`Foto de ${item.username}`} className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                  @{item.username.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">
                  @{item.username} {item.fullName ? `- ${item.fullName}` : ""}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(item.followedAt).toLocaleString()} • via{" "}
                  {item.followedByInstagramUsername ? `@${item.followedByInstagramUsername}` : item.sessionId}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
