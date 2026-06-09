import { useRouter } from "expo-router"
import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Button } from "@/src/components/ui/Button"
import { Input } from "@/src/components/ui/Input"
import { Screen } from "@/src/components/ui/Screen"
import { SegmentedControl } from "@/src/components/ui/SegmentedControl"
import { useAuth } from "@/src/features/auth/use-auth"
import { colors } from "@/src/theme/colors"
import { radius, spacing } from "@/src/theme/spacing"

const AUTH_MODES = [
  { id: "login" as const, label: "Entrar" },
  { id: "register" as const, label: "Criar conta" },
]

export default function LoginScreen() {
  const { login, register } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [authMode, setAuthMode] = useState<"login" | "register">("login")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isRegisterMode = authMode === "register"

  function handleAuthModeChange(mode: "login" | "register") {
    setAuthMode(mode)
    setConfirmPassword("")
    setError(null)
  }

  async function handleSubmit() {
    setError(null)

    if (isRegisterMode && password !== confirmPassword) {
      setError("As senhas não coincidem.")
      return
    }

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
    <Screen style={styles.screen}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Insta Connect</Text>
          <Text style={styles.subtitle}>
            {isRegisterMode
              ? "Crie sua conta para gerenciar sessões e AutoFollow."
              : "Acesse sua conta para continuar."}
          </Text>
        </View>

        <SegmentedControl options={AUTH_MODES} value={authMode} onChange={handleAuthModeChange} />

        <View style={styles.form}>
          <Input
            label="E-mail"
            placeholder="seu@email.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            editable={!isSubmitting}
          />
          <Input
            label="Senha"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={isRegisterMode ? "new-password" : "password"}
            editable={!isSubmitting}
          />
          {isRegisterMode ? (
            <Input
              label="Confirmar senha"
              placeholder="••••••••"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoComplete="new-password"
              editable={!isSubmitting}
            />
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : null}

          <Button
            title={isRegisterMode ? "Criar conta" : "Entrar"}
            onPress={handleSubmit}
            loading={isSubmitting}
            style={styles.submitButton}
          />
        </View>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  screen: {
    paddingTop: spacing.xl,
  },
  container: {
    flex: 1,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    maxWidth: 320,
  },
  form: {
    gap: spacing.md,
  },
  errorBox: {
    backgroundColor: colors.errorLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  error: {
    fontSize: 14,
    color: colors.error,
    lineHeight: 20,
  },
  submitButton: {
    marginTop: spacing.sm,
  },
})
