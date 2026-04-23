import { useQuery } from "@tanstack/react-query"
import axios from "axios"
import { ExternalLink, Inbox, Loader2, RefreshCw } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { useInstaConnect } from "../features/insta/use-insta-connect"
import { getConversations, threadIdFromHref, type ConversationItem } from "../lib/insta"

const DEFAULT_LIMIT = 30

export function ConversasPage() {
  const { isLinked, activeSessionId, sessions } = useInstaConnect()
  const [limit, setLimit] = useState(DEFAULT_LIMIT)
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null
  const isSessionConnected = Boolean(activeSession?.instagramUsername)

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<ConversationItem[]>({
    queryKey: ["conversations", limit],
    queryFn: async () => {
      try {
        const { data: body } = await getConversations(limit)
        if (!body.ok) {
          throw new Error("Resposta inválida do servidor")
        }
        return body.conversations
      } catch (e) {
        if (axios.isAxiosError(e)) {
          const msg = (e.response?.data as { error?: string } | undefined)?.error
          throw new Error(msg ?? e.message)
        }
        throw e
      }
    },
    enabled: isLinked && isSessionConnected,
  })

  const errMessage = isError && error instanceof Error ? error.message : null

  if (!isLinked || !isSessionConnected) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <Inbox className="mx-auto h-10 w-10 text-amber-800" aria-hidden />
        <h2 className="mt-3 text-lg font-semibold text-amber-950">Conecte o Instagram na sessão ativa</h2>
        <p className="mt-1 text-sm text-amber-900/80">
          Para listar as conversas, o backend precisa de uma sessão ativa. Use a ligação no menu
          <strong> Instagram</strong>.
        </p>
        <Link
          to="/connect-instagram"
          className="mt-4 inline-block rounded-lg bg-amber-900 px-4 py-2 text-sm font-medium text-white hover:bg-amber-950"
        >
          Conectar Instagram
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="limit">
            Limite
          </label>
          <select
            id="limit"
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            disabled={isFetching}
          >
            {[10, 20, 30, 50, 100].map((n) => (
              <option key={n} value={n}>
                Até {n} conversas
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            disabled={isFetching}
          >
            {isFetching ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
            )}
            Atualizar
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
          Carregando conversas…
        </div>
      ) : isError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {errMessage ?? "Não foi possível listar. Confirme o login do Instagram e tente de novo."}
        </p>
      ) : data && data.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
          Nenhuma conversa devolvida (inbox vazia ou ainda a carregar no IG).
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {data?.map((c) => {
            const id = threadIdFromHref(c.href)
            if (!id) {
              return (
                <li key={c.href} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{c.title}</p>
                    <p className="text-xs text-amber-700">Não foi possível obter o ID da thread a partir do link.</p>
                  </div>
                </li>
              )
            }
            const chatTo = `/conversas/c/${encodeURIComponent(id)}?title=${encodeURIComponent(c.title)}`
            return (
              <li key={c.href} className="flex items-stretch">
                <Link
                  to={chatTo}
                  state={{ title: c.title }}
                  className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50/80"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{c.title}</p>
                    <p className="mt-0.5 truncate text-sm text-slate-500">{c.preview || "—"}</p>
                    <p className="mt-1 text-xs text-slate-400">Abrir chat no app</p>
                  </div>
                </Link>
                <a
                  href={c.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex shrink-0 items-center self-stretch border-l border-slate-100 px-3 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  title="Abrir no site do Instagram"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
