import { Redirect } from "expo-router"
import { useAuth } from "@/src/features/auth/use-auth"

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return null
  }

  if (isAuthenticated) {
    return <Redirect href="/(app)" />
  }

  return <Redirect href="/(auth)/login" />
}
