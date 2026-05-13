import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { type ReactNode } from "react"
import { AuthProvider } from "../features/auth/auth-provider"
import { InstaRealtimeProvider } from "../features/insta/insta-realtime-provider"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <InstaRealtimeProvider>{children}</InstaRealtimeProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
