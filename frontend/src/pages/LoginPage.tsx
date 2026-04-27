import { LogIn, Loader2 } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../features/auth/use-auth"

export function LoginPage() {
  const { login, register, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      void navigate("/app", { replace: true })
    }
  }, [isAuthenticated, navigate])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    const result = isRegisterMode ? await register(email, password) : await login(email, password)
    setIsSubmitting(false)
    if (result.ok) {
      void navigate("/app", { replace: true })
    } else {
      setError(result.error ?? "Não foi possível concluir a autenticação.")
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <h1 className="text-center text-2xl font-bold text-slate-900">InstagramConnect</h1>
        <p className="mt-1 text-center text-sm text-slate-500">
          <strong>{isRegisterMode ? "Criar conta no painel" : "Login do painel"}</strong>
        </p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              Senha
            </label>
            <input
              id="password"
              type="password"
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
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <LogIn className="h-4 w-4" aria-hidden />
            )}
            {isSubmitting ? "Processando…" : isRegisterMode ? "Criar conta" : "Entrar no painel"}
          </button>
        </form>
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500">
          <span>{isRegisterMode ? "Já tem conta?" : "Ainda não tem conta?"}</span>
          <button
            type="button"
            onClick={() => {
              setIsRegisterMode((prev) => !prev)
              setError(null)
            }}
            className="font-medium text-slate-900 underline underline-offset-2"
          >
            {isRegisterMode ? "Entrar" : "Criar conta"}
          </button>
        </div>
      </div>
    </div>
  )
}
