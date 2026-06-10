import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Stack } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { StatusBar } from "expo-status-bar"
import { useEffect } from "react"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { AuthProvider } from "@/src/features/auth/auth-provider"
import { useAuth } from "@/src/features/auth/use-auth"
import { InstaRealtimeProvider } from "@/src/features/insta/insta-realtime-provider"

void SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

function SplashGate({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading) {
      void SplashScreen.hideAsync()
    }
  }, [isLoading])

  return children
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SplashGate>
            <InstaRealtimeProvider>
              <StatusBar style="dark" />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(app)" />
              </Stack>
            </InstaRealtimeProvider>
          </SplashGate>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
