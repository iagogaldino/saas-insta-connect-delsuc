import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Stack } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { StatusBar } from "expo-status-bar"
import { useEffect, useState } from "react"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { SplashPresentation } from "@/src/components/splash/SplashPresentation"
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
  const [presentationDone, setPresentationDone] = useState(false)

  useEffect(() => {
    void SplashScreen.hideAsync()
  }, [])

  const ready = !isLoading && presentationDone

  return (
    <>
      {ready ? children : null}
      {!presentationDone ? (
        <SplashPresentation
          canDismiss={!isLoading}
          onComplete={() => setPresentationDone(true)}
        />
      ) : null}
    </>
  )
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
