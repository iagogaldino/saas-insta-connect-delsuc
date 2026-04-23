import { LogOut, User } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../../features/auth/use-auth"
import { useInstaConnect } from "../../features/insta/use-insta-connect"

const titles: Record<string, string> = {
  "/": "Visão geral",
  "/connect-instagram": "Instagram",
  "/conversas": "Conversas",
}

function titleFromPath(pathname: string) {
  if (pathname.startsWith("/conversas/c/")) {
    return "Chat"
  }
  return titles[pathname] ?? "Painel"
}

export function Header() {
  const { logout } = useAuth()
  const { disconnectInstagram } = useInstaConnect()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
      <h1 className="text-lg font-semibold text-slate-800">{titleFromPath(pathname)}</h1>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-slate-600">
          <User className="h-4 w-4" aria-hidden />
        </span>
        <span className="text-sm text-slate-500">Sessão do painel</span>
        <button
          type="button"
          onClick={() => {
            disconnectInstagram()
            logout()
            void navigate("/login", { replace: true })
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sair
        </button>
      </div>
    </header>
  )
}
