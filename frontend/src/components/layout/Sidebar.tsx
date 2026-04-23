import { AtSign, Inbox, LayoutDashboard } from "lucide-react"
import { NavLink, useLocation } from "react-router-dom"

const linkClass = ({ isActive }: { isActive: boolean }): string =>
  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
  }`

export function Sidebar() {
  const { pathname } = useLocation()
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-slate-900 text-slate-200">
      <div className="border-b border-slate-800 px-4 py-5">
        <span className="text-lg font-semibold tracking-tight text-white">InstagramConnect</span>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-3" aria-label="Navegação principal">
        <NavLink to="/" className={linkClass} end>
          <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden />
          Dashboard
        </NavLink>
        <NavLink to="/connect-instagram" className={linkClass}>
          <AtSign className="h-4 w-4 shrink-0" aria-hidden />
          Instagram
        </NavLink>
        <NavLink
          to="/conversas"
          className={() =>
            linkClass({
              isActive: pathname === "/conversas" || pathname.startsWith("/conversas/"),
            })
          }
        >
          <Inbox className="h-4 w-4 shrink-0" aria-hidden />
          Conversas
        </NavLink>
      </nav>
    </aside>
  )
}
