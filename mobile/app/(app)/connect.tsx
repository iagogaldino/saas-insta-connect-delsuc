import { useRouter } from "expo-router"
import { StyleSheet, Text } from "react-native"
import { Button } from "@/src/components/ui/Button"
import { Card } from "@/src/components/ui/Card"
import { Screen } from "@/src/components/ui/Screen"
import { ScreenHeader } from "@/src/components/ui/ScreenHeader"
import { useAuth } from "@/src/features/auth/use-auth"
import { colors } from "@/src/theme/colors"
import { spacing } from "@/src/theme/spacing"

export default function AccountScreen() {
  const router = useRouter()
  const { userEmail, logout } = useAuth()

  async function handleLogout() {
    await logout()
    router.replace("/(auth)/login")
  }

  return (
    <Screen header={<ScreenHeader title="Conta" subtitle="Painel Insta Connect" />}>
      <Card style={styles.card}>
        <Text style={styles.label}>E-mail</Text>
        <Text style={styles.email}>{userEmail}</Text>
      </Card>

      <Button title="Sair da conta" variant="danger" onPress={handleLogout} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  label: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  email: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
})
