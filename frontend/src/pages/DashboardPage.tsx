import { BarChart3, Inbox, MessageCircle, Users } from "lucide-react"
import { Link } from "react-router-dom"
import { useInstaConnect } from "../features/insta/use-insta-connect"

export function DashboardPage() {
  const { isLinked } = useInstaConnect()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-slate-600">
          <span className="font-medium text-slate-800">Instagram (backend):</span>{" "}
          {isLinked ? (
            <span className="text-emerald-700">conectado</span>
          ) : (
            <span className="text-amber-700">não conectado</span>
          )}
        </p>
        <Link
          to="/connect-instagram"
          className="shrink-0 text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
        >
          {isLinked ? "Gerir ligação" : "Conectar Instagram"}
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            { label: "Mensagens recebidas", value: "—" as const, icon: MessageCircle },
            { label: "Conversas ativas", value: "—" as const, icon: Inbox },
            { label: "Taxa de resposta", value: "—" as const, icon: BarChart3 },
            { label: "Contatos alcançados", value: "—" as const, icon: Users },
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
              <p className="mt-1 text-xs text-slate-400">Dados do Instagram em breve</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
