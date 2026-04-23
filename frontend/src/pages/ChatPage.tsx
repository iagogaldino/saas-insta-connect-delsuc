import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { ArrowLeft, ExternalLink, Loader2, Send } from "lucide-react"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom"
import { useInstaConnect } from "../features/insta/use-insta-connect"
import { getThreadMessages, postOpenConversation, postSendMessage, type MessageRow } from "../lib/insta"

const MSG_LIMIT = 50

function titleFromQueryOrState(
  searchParams: URLSearchParams,
  stateTitle: string | null,
): string {
  const q = searchParams.get("title")
  if (q) {
    try {
      return decodeURIComponent(q)
    } catch {
      return q
    }
  }
  return stateTitle ?? ""
}

type LocationState = { title?: string } | null

export function ChatPage() {
  const { threadId: rawThreadId } = useParams<{ threadId: string }>()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const state = location.state as LocationState
  const titleFromState = state?.title ?? null

  const threadId = rawThreadId ? decodeURIComponent(rawThreadId) : ""
  const conversationTitle = titleFromQueryOrState(searchParams, titleFromState)

  const { isLinked } = useInstaConnect()
  const queryClient = useQueryClient()
  const [text, setText] = useState("")
  const openRan = useRef(false)

  const {
    data: messages,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["thread-messages", threadId, MSG_LIMIT],
    queryFn: async () => {
      try {
        const { data: body } = await getThreadMessages(threadId, MSG_LIMIT)
        if (!body.ok) throw new Error("Resposta inválida do servidor")
        return body.messages
      } catch (e) {
        if (axios.isAxiosError(e)) {
          const msg = (e.response?.data as { error?: string } | undefined)?.error
          throw new Error(msg ?? e.message)
        }
        throw e
      }
    },
    enabled: isLinked && threadId.length > 0,
  })

  const sendMutation = useMutation({
    mutationFn: async (body: string) => {
      if (!conversationTitle) {
        throw new Error("Falta o título da conversa (reabra a partir da lista de conversas).")
      }
      const { data } = await postSendMessage(conversationTitle, body, false)
      if (!data.ok) throw new Error("Envio rejeitado")
      if (!data.success) throw new Error("O Instagram não confirmou o envio.")
      return data
    },
    onSuccess: () => {
      setText("")
      void queryClient.invalidateQueries({ queryKey: ["thread-messages", threadId, MSG_LIMIT] })
    },
  })

  useEffect(() => {
    if (!isLinked || !threadId || !conversationTitle.trim() || openRan.current) return
    openRan.current = true
    void (async () => {
      try {
        await postOpenConversation(conversationTitle, false)
        void refetch()
      } catch {
        void refetch()
      }
    })()
  }, [isLinked, threadId, conversationTitle, refetch])

  const errText = isError && error instanceof Error ? error.message : null

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSend) return
    const t = text.trim()
    if (!t || sendMutation.isPending) return
    sendMutation.mutate(t)
  }

  if (!isLinked) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900">
        Conecte o Instagram no menu <strong>Instagram</strong> para abrir o chat.
        <div className="mt-3">
          <Link to="/connect-instagram" className="font-medium text-amber-950 underline">
            Conectar
          </Link>
        </div>
      </div>
    )
  }

  if (!threadId) {
    return <p className="text-slate-600">Conversa inválida.</p>
  }

  const canSend = conversationTitle.length > 0

  return (
    <div className="flex h-[calc(100vh-8.5rem)] min-h-[420px] flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      {!canSend ? (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:px-4">
          Sem título da conversa na URL.{" "}
          <Link to="/conversas" className="font-medium underline">
            Abrir pela lista
          </Link>{" "}
          para enviar mensagens; visualização ainda funciona.
        </div>
      ) : null}
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-3 py-2 sm:px-4">
        <Link
          to="/conversas"
          className="inline-flex items-center gap-1 rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
          aria-label="Voltar às conversas"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold text-slate-900">
            {conversationTitle || "Conversa"}
          </h2>
          <p className="truncate text-xs text-slate-500">ID: {threadId}</p>
        </div>
        <a
          href={`https://www.instagram.com/direct/t/${threadId}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 p-1.5 text-slate-500 hover:text-slate-800"
          title="Abrir no Instagram"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
        >
          {isFetching ? "…" : "Atualizar"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Carregando mensagens…
          </div>
        ) : isError ? (
          <p className="text-sm text-red-600">{errText}</p>
        ) : (
          <ul className="space-y-2">
            {messages?.map((m: MessageRow, i: number) => (
              <li
                key={`${i}-${m.timestamp ?? ""}-${m.text.slice(0, 20)}`}
                className={`flex ${m.sender === "me" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.sender === "me" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-900"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.text || "—"}</p>
                  {m.timestamp ? (
                    <p
                      className={`mt-1 text-[10px] ${
                        m.sender === "me" ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      {m.timestamp}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
            {!messages?.length ? (
              <p className="text-center text-sm text-slate-500">Nenhuma mensagem lida ainda no DOM.</p>
            ) : null}
          </ul>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="shrink-0 space-y-2 border-t border-slate-200 p-3 sm:p-4"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="msg" className="sr-only">
              Mensagem
            </label>
            <textarea
              id="msg"
              rows={2}
              className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              placeholder={
                canSend
                  ? "Mensagem (enviada pelo browser no backend)"
                  : "Abra a conversa pela lista para enviar"
              }
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={sendMutation.isPending || !canSend}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  onSubmit(e as unknown as FormEvent)
                }
              }}
            />
          </div>
          <button
            type="submit"
            disabled={sendMutation.isPending || !text.trim() || !canSend}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 sm:w-auto sm:px-4"
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar
          </button>
        </div>
        {sendMutation.isError && (
          <p className="text-xs text-red-600">
            {sendMutation.error instanceof Error ? sendMutation.error.message : "Erro ao enviar"}
          </p>
        )}
      </form>
    </div>
  )
}
