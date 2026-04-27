import {
  ArrowRight,
  Bot,
  CheckCircle2,
  LineChart,
  MessageCircle,
  Network,
  PlayCircle,
  TrendingUp,
} from "lucide-react"
import { Link } from "react-router-dom"

const features = [
  {
    title: "Gestão de Conversas",
    description: "Liste conversas da conta ativa, abra threads e envie mensagens no mesmo painel.",
    icon: MessageCircle,
    iconClassName: "bg-indigo-100 text-indigo-600",
  },
  {
    title: "Sessões Instagram",
    description: "Crie múltiplas sessões, ligue/desligue runtime e troque a sessão ativa com controle total.",
    icon: Bot,
    iconClassName: "bg-pink-100 text-pink-600",
  },
  {
    title: "AutoFollow",
    description: "Execute automações por sugeridos ou seguidores de um perfil com filtro de privacidade.",
    icon: LineChart,
    iconClassName: "bg-purple-100 text-purple-600",
  },
  {
    title: "Webhook e Token",
    description: "Ative webhook para mensagens recebidas e gere token de integração para uso externo.",
    icon: Network,
    iconClassName: "bg-amber-100 text-amber-700",
  },
] as const

const segments = [
  {
    title: "Negócios Locais",
    description: "Atenda DMs com mais organização e mantenha uma rotina de prospecção consistente no Instagram.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCimSOcP1_kbbIUmEdKHWWqRrFjroicuCzCtc1vyaco4FoxTzyPNcEEekOSkAKpeayBLfUL1SnJXmN6n0k1g5GXoqqWK8tNzZ6cOCzfu-Kliipmg3FyLSRpWSRRMdR2d7HFP1EijClEbkZplPFjYrfe9yBVYDjUGndzqf0IwSWLonP5_SRlaxj07Tn8m6vSIG5L4awzOJIbNgc8w9XXLl-jvLTXPKee6RCH5a1t1xBVT9sEBE9BnKtDYIRQmYyr-OsvdOvGV5wGD4o",
    overlay: "from-indigo-700/90",
  },
  {
    title: "Criadores de Conteúdo",
    description: "Centralize conversas e acelere respostas para manter proximidade com sua audiência no dia a dia.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBcnEDORkSLlFYscPqzhCCfhaYxbqrzS6JUYjyyqI5A-QgFlPc1Ww3KtHNNI43fLneC9BrD6_LUpELW8A1q-GDHnf6iPJW6koLlJ3CRtRVA35mms9wsMOPT2G286HvC9aXbJR_lFp-hANmo-8Q9N0vhB6eS2dixi1kalVFmblU8moBw_gs4vUG0dNLw32O2VP34CQGHHtJlYySwirxreLdd-KFwkBw888GRDyS8tgi6xOCG9McnEJz00BomhjX0O5WeMe0ZTD9BDyw",
    overlay: "from-pink-700/90",
  },
  {
    title: "Operação Comercial",
    description: "Use sessões dedicadas por operação e acompanhe métricas de follows para orientar decisões.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBle7dlxv2GYcVVvpDuwktvMkkOwOd4cFc2f8pLB6iSFWgML0VqskU7gWCwRLQoa1yI8AFEtetB9wyWOjdvrkrlnogV9cKPj_D9xFZxuxJYWTKp0ZybMq7fh4VhC1Dio7qGXFaBB1XzCPGnqpaLJ2_E_IrBNmoPSvXVI6c9nDWMaRNFCy7zNJTTb28BzG9xVEDgsHlwLiHDkhkzZiVATsLAevZsvsdqWv91r_7tWpCU_hRG7WGc_WCs-9S-GOntms2Ake11xnBroeQ",
    overlay: "from-amber-700/90",
  },
] as const

export function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-200">
      <header className="fixed left-0 top-0 z-50 w-full border-b border-white/20 bg-white/70 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] backdrop-blur-xl">
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-6 lg:px-8">
          <div className="bg-gradient-to-r from-indigo-600 via-purple-500 to-pink-500 bg-clip-text text-2xl font-black text-transparent">
            InstagramConnect
          </div>
          <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
            <a className="border-b-2 border-indigo-600 pb-1 text-indigo-600" href="#features">
              Features
            </a>
            <a className="text-slate-600 transition-colors hover:text-indigo-500" href="#pricing">
              Para quem é
            </a>
            <a className="text-slate-600 transition-colors hover:text-indigo-500" href="#about">
              About
            </a>
          </nav>
          <Link
            to="/login"
            className="rounded-full bg-gradient-to-r from-orange-500 via-pink-500 to-fuchsia-600 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:opacity-80 active:scale-95"
          >
            Get Started
          </Link>
        </div>
      </header>

      <main className="relative overflow-hidden">
        <div className="absolute -right-40 -top-40 -z-10 h-[32rem] w-[32rem] rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="absolute -left-40 top-1/2 -z-10 h-[32rem] w-[32rem] rounded-full bg-violet-400/20 blur-3xl" />

        <section className="mx-auto flex max-w-7xl flex-col items-center gap-16 px-6 pb-24 pt-40 lg:flex-row lg:px-8">
          <div className="flex-1 text-center lg:text-left">
            <span className="mb-6 inline-block rounded-full bg-indigo-100 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
              Sessões, conversas e automação
            </span>
            <h1 className="mb-8 text-4xl font-extrabold leading-tight md:text-6xl">
              Transforme seu Instagram em uma{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Máquina de Resultados
              </span>
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-slate-600 lg:mx-0">
              Organize sessões do Instagram, gerencie conversas e execute automações com mais controle operacional.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row lg:justify-start">
              <Link
                to="/login"
                className="rounded-xl bg-gradient-to-r from-orange-500 via-pink-500 to-fuchsia-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition-all active:scale-95"
              >
                Começar Agora
              </Link>
              <a
                href="#about"
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-300 px-8 py-4 text-lg font-semibold text-slate-700 transition-all hover:bg-white"
              >
                <PlayCircle className="h-5 w-5" />
                Ver Demonstração
              </a>
            </div>
          </div>

          <div className="relative flex-1">
            <div className="overflow-hidden rounded-[2rem] border border-white/30 bg-white/65 p-4 shadow-2xl backdrop-blur-xl">
              <img
                alt="Dashboard UI Mockup"
                className="w-full rounded-2xl object-cover shadow-inner"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBjwRJkk8AnvOjoq9qcWbmlqiJOktVpYJg0u06z8CuSQqukL1sUk3ReFExbgW-mDTqmBcJiA-CkrQP7x0ghOU7s2aLPDVmbdYwhKi7Zp8AymhHQNj6Q7RtaIQf6cizFFKUklSKFwtH_Xnzq38tBmtPCOpFEbWkUzX27sePoXgJVQE2RbT-RIB3ddCkuT1Y8ujUbu-0aXMv9hp1QEn2ved7t8Ia-_FY0WpjGCoHirieP2gNgDywPQnIMs1xZUE6Habq6yNK8qjzOd7Q"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 rounded-2xl border border-white/30 bg-white/70 p-6 shadow-xl backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-100">
                  <TrendingUp className="h-6 w-6 text-pink-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Crescimento Semanal</p>
                  <p className="text-lg font-bold text-slate-900">Métricas de follows</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold">Funcionalidades Inteligentes</h2>
            <p className="mx-auto max-w-xl text-slate-600">
              Recursos já disponíveis no painel para operação diária de Instagram.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <article
                  key={feature.title}
                  className="rounded-[2rem] border border-white/30 bg-white/70 p-8 shadow-sm backdrop-blur transition-transform duration-300 hover:-translate-y-2"
                >
                  <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-2xl ${feature.iconClassName}`}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="mb-4 text-xl font-semibold">{feature.title}</h3>
                  <p className="text-slate-600">{feature.description}</p>
                </article>
              )
            })}
          </div>
        </section>

        <section id="pricing" className="bg-indigo-50/60 py-24">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mb-16">
              <h2 className="mb-4 text-3xl font-bold">Feito para quem busca escala</h2>
              <p className="text-lg text-slate-600">Soluções adaptadas para diferentes níveis de maturidade digital.</p>
            </div>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {segments.map((segment) => (
                <article key={segment.title} className="group relative h-[450px] overflow-hidden rounded-3xl">
                  <img
                    alt={segment.title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    src={segment.image}
                  />
                  <div className={`absolute inset-0 bg-gradient-to-t ${segment.overlay} to-transparent`} />
                  <div className="absolute bottom-0 p-8 text-white">
                    <h4 className="mb-2 text-2xl font-semibold">{segment.title}</h4>
                    <p className="opacity-90">{segment.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
          <div className="relative overflow-hidden rounded-[2.5rem] border border-white/30 bg-white/70 p-10 shadow-xl backdrop-blur lg:p-16">
            <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
              <div>
                <h2 className="mb-8 text-4xl font-bold">Valor real para o seu negócio</h2>
                <div className="space-y-6">
                  {[
                    {
                      title: "Operação Centralizada",
                      description: "Sessões, conversas, mensagens e automações no mesmo fluxo de trabalho.",
                    },
                    {
                      title: "Menos Trabalho Manual",
                      description: "Automatize parte da prospecção com AutoFollow por sugeridos e seguidores.",
                    },
                    {
                      title: "Integração Simples",
                      description: "Receba eventos de mensagens por webhook e use token para integrações externas.",
                    },
                  ].map((item) => (
                    <div key={item.title} className="flex gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100">
                        <CheckCircle2 className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold">{item.title}</h4>
                        <p className="text-slate-600">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { value: "DM", label: "Leitura e envio", valueClassName: "text-indigo-600" },
                  { value: "2FA", label: "Login com desafio", valueClassName: "text-pink-600 translate-y-8" },
                  { value: "API", label: "Token de integração", valueClassName: "text-violet-600" },
                  { value: "POST", label: "Webhook de entrada", valueClassName: "text-slate-800 translate-y-8" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className={`flex flex-col items-center justify-center rounded-3xl border border-white/40 bg-white/50 p-8 text-center ${stat.valueClassName.includes("translate-y-8") ? "translate-y-8" : ""}`}
                  >
                    <span className={`mb-2 text-4xl font-extrabold ${stat.valueClassName.replace(" translate-y-8", "")}`}>
                      {stat.value}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-6 py-24 text-center">
          <h2 className="mb-8 text-4xl font-bold leading-tight">Pronto para o próximo nível?</h2>
          <p className="mb-12 text-lg text-slate-600">
            Acesse o painel e comece a operar suas sessões e conversas com mais previsibilidade.
          </p>
          <div className="flex flex-col justify-center gap-6 sm:flex-row">
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 via-pink-500 to-fuchsia-600 px-12 py-5 text-lg font-semibold text-white shadow-2xl transition-transform hover:scale-105"
            >
              Começar Teste Grátis
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              to="/login"
              className="rounded-full border border-slate-300 bg-white/70 px-12 py-5 text-lg font-semibold text-slate-800 transition-colors hover:bg-white"
            >
              Falar com Consultor
            </Link>
          </div>
        </section>
      </main>

      <footer className="w-full border-t border-slate-200 bg-slate-100 py-12">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-8 px-6 text-sm tracking-wide md:flex-row lg:px-8">
          <div className="text-xl font-bold text-slate-900">InstagramConnect</div>
          <div className="flex flex-wrap justify-center gap-8">
            <a className="text-slate-500 transition-colors hover:text-slate-900 hover:underline" href="#features">
              Features
            </a>
            <a className="text-slate-500 transition-colors hover:text-slate-900 hover:underline" href="#pricing">
              Para quem é
            </a>
            <a className="text-slate-500 transition-colors hover:text-slate-900 hover:underline" href="#about">
              About
            </a>
            <a className="text-slate-500 transition-colors hover:text-slate-900 hover:underline" href="#">
              Privacy
            </a>
            <a className="text-slate-500 transition-colors hover:text-slate-900 hover:underline" href="#">
              Terms
            </a>
          </div>
          <p className="text-center text-slate-500 md:text-right">© 2026 InstagramConnect. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
