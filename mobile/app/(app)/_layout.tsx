import { NavigationBar } from "expo-navigation-bar"
import { Redirect, Tabs, useRouter } from "expo-router"
import { Layers, UserCircle } from "lucide-react-native"
import { useEffect } from "react"
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useAuth } from "@/src/features/auth/use-auth"
import { InstaConnectProvider } from "@/src/features/insta/insta-connect-provider"
import { setOnUnauthorized } from "@/src/lib/auth-nav"
import { colors } from "@/src/theme/colors"
import { spacing } from "@/src/theme/spacing"

const TAB_BAR_PADDING_TOP = spacing.sm
const TAB_BAR_CONTENT_HEIGHT = 48

export default function AppLayout() {
  const { isAuthenticated, isLoading, logout } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const tabBarBottomInset = Math.max(
    insets.bottom,
    Platform.OS === "android" ? spacing.md : spacing.sm,
  )
  const tabBarHeight = TAB_BAR_CONTENT_HEIGHT + TAB_BAR_PADDING_TOP + tabBarBottomInset

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
      {Platform.OS === "android" ? <NavigationBar style="dark" /> : null}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            height: tabBarHeight,
            paddingTop: TAB_BAR_PADDING_TOP,
            paddingBottom: tabBarBottomInset,
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
            title: "Sessões",
            tabBarIcon: ({ color, size }) => <Layers color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="session/[sessionId]"
          options={{
            href: null,
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
        <Tabs.Screen
          name="history"
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
