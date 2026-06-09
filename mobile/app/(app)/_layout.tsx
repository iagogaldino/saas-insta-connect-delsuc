import { Redirect, Tabs, useRouter } from "expo-router"
import { Users, UserCircle } from "lucide-react-native"
import { useEffect } from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"
import { useAuth } from "@/src/features/auth/use-auth"
import { InstaConnectProvider } from "@/src/features/insta/insta-connect-provider"
import { setOnUnauthorized } from "@/src/lib/auth-nav"
import { colors } from "@/src/theme/colors"

export default function AppLayout() {
  const { isAuthenticated, isLoading, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    setOnUnauthorized(() => {
      void logout()
      router.replace("/(auth)/login")
    })
    return () => setOnUnauthorized(null)
  }, [logout, router])

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />
  }

  return (
    <InstaConnectProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: "600",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "AutoFollow",
            tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="connect"
          options={{
            title: "Conta",
            tabBarIcon: ({ color, size }) => <UserCircle color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="results"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </InstaConnectProvider>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
})
