import { useRouter } from "expo-router"
import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { Button } from "@/src/components/ui/Button"
import { Card } from "@/src/components/ui/Card"
import { Input } from "@/src/components/ui/Input"
import { Screen } from "@/src/components/ui/Screen"
import { useAuth } from "@/src/features/auth/use-auth"
import { colors } from "@/src/theme/colors"
import { spacing } from "@/src/theme/spacing"

export default function LoginScreen() {
  const { login, register } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit() {
    setError(null)
    setIsSubmitting(true)
    const result = isRegisterMode ? await register(email, password) : await login(email, password)
    setIsSubmitting(false)
    if (result.ok) {
      router.replace("/(app)")
    } else {
      setError(result.error ?? "Não foi possível concluir a autenticação.")
    }
  }

  return (
    <Screen>
      <View style={styles.center}>
        <Card style={styles.card}>
          <Text style={styles.logo}>InstagramConnect</Text>
          <Text style={styles.subtitle}>
            {isRegisterMode ? "Criar conta no painel" : "Login do painel"}
          </Text>

          <View style={styles.form}>
            <Input
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              editable={!isSubmitting}
            />
            <Input
              label="Senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              editable={!isSubmitting}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              title={isRegisterMode ? "Criar conta" : "Entrar"}
              onPress={handleSubmit}
              loading={isSubmitting}
            />
          </View>

          <Pressable onPress={() => setIsRegisterMode((v) => !v)} disabled={isSubmitting}>
            <Text style={styles.toggle}>
              {isRegisterMode ? "Já tem conta? Fazer login" : "Não tem conta? Criar conta"}
            </Text>
          </Pressable>
        </Card>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
  },
  card: {
    gap: spacing.md,
  },
  logo: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
  form: {
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  error: {
    fontSize: 14,
    color: colors.error,
  },
  toggle: {
    marginTop: spacing.sm,
    textAlign: "center",
    color: colors.primary,
    fontWeight: "600",
    fontSize: 14,
  },
})
