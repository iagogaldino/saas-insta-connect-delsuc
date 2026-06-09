import { useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Avatar } from "@/src/components/ui/Avatar"
import { Button } from "@/src/components/ui/Button"
import { Card } from "@/src/components/ui/Card"
import { Input } from "@/src/components/ui/Input"
import { Screen } from "@/src/components/ui/Screen"
import { StatusBadge } from "@/src/components/ui/StatusBadge"
import { useAuth } from "@/src/features/auth/use-auth"
import { useInstaConnect } from "@/src/features/insta/use-insta-connect"
import { colors } from "@/src/theme/colors"
import { spacing } from "@/src/theme/spacing"

export default function ConnectScreen() {
  const router = useRouter()
  const { userEmail, logout } = useAuth()
  const {
    isManagingSessions,
    sessions,
    activeSessionId,
    refreshSessions,
    createSession,
    startSessionRuntime,
    connectInstagramToSession,
    submitSecurityCodeForSession,
  } = useInstaConnect()

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null
  const isConnected = Boolean(activeSession?.instagramUsername)

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [securityCode, setSecurityCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showTwoFactor, setShowTwoFactor] = useState(false)
  const [pendingUsername, setPendingUsername] = useState("")
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null)

  useEffect(() => {
    if (activeSession?.instagramUsername) {
      setUsername(activeSession.instagramUsername)
    }
  }, [activeSession?.instagramUsername])

  async function ensureSession(): Promise<string | null> {
    if (activeSessionId) return activeSessionId
    const result = await createSession(true)
    if (!result.success) {
      setError(result.error)
      return null
    }
    return result.activeSessionId
  }

  async function handleConnect() {
    setError(null)
    setNotice(null)
    setIsSubmitting(true)
    const sessionId = await ensureSession()
    if (!sessionId) {
      setIsSubmitting(false)
      return
    }
    const result = await connectInstagramToSession(sessionId, username, password)
    if (result.success) {
      setPassword("")
      setSecurityCode("")
      setShowTwoFactor(false)
      setNotice("Instagram conectado com sucesso!")
      await refreshSessions()
    } else if ("challengeRequired" in result && result.challengeRequired) {
      setShowTwoFactor(true)
      setPendingSessionId(result.sessionId)
      setPendingUsername(result.username)
      setError(result.message ?? "Digite o código de segurança recebido.")
    } else if ("error" in result) {
      setError(result.error)
    }
    setIsSubmitting(false)
  }

  async function handleSubmitCode() {
    if (!pendingSessionId) return
    setError(null)
    setNotice(null)
    setIsSubmitting(true)
    const result = await submitSecurityCodeForSession(
      pendingSessionId,
      pendingUsername,
      securityCode,
    )
    if (result.success) {
      setPassword("")
      setSecurityCode("")
      setShowTwoFactor(false)
      setNotice("Código confirmado. Instagram conectado!")
      await refreshSessions()
    } else if ("challengeRequired" in result && result.challengeRequired) {
      setError(result.message ?? "Código inválido ou expirado. Tente novamente.")
    } else if ("error" in result) {
      setError(result.error)
    }
    setIsSubmitting(false)
  }

  async function handleStartRuntime() {
    if (!activeSessionId) return
    setError(null)
    setNotice(null)
    setIsSubmitting(true)
    const result = await startSessionRuntime(activeSessionId)
    if (result.success) {
      setNotice(result.runtimeStatusMessage ?? "Sessão iniciada.")
    } else {
      setError(result.error)
    }
    setIsSubmitting(false)
  }

  async function handleLogout() {
    await logout()
    router.replace("/(auth)/login")
  }

  return (
    <Screen>
      <Text style={styles.title}>Conta</Text>
      <Text style={styles.subtitle}>{userEmail}</Text>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Status Instagram</Text>
        {isConnected && activeSession ? (
          <View style={styles.statusRow}>
            <Avatar
              uri={activeSession.instagramProfilePicUrl}
              username={activeSession.instagramUsername ?? "?"}
            />
            <View style={styles.statusInfo}>
              <Text style={styles.igUsername}>@{activeSession.instagramUsername}</Text>
              {activeSession.instagramFullName ? (
                <Text style={styles.igName}>{activeSession.instagramFullName}</Text>
              ) : null}
              <StatusBadge
                label={activeSession.isRuntimeOn ? "Sessão ativa" : "Conectado"}
                variant="success"
              />
            </View>
          </View>
        ) : (
          <StatusBadge label="Não conectado" variant="warning" />
        )}

        {activeSession?.requiresRelogin ? (
          <Text style={styles.warning}>
            Sua sessão Instagram expirou. Faça login novamente.
          </Text>
        ) : null}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>
          {showTwoFactor ? "Código de segurança" : "Conectar Instagram"}
        </Text>

        {showTwoFactor ? (
          <>
            <Text style={styles.hint}>
              Código enviado para @{pendingUsername}. Digite abaixo para concluir.
            </Text>
            <Input
              label="Código"
              value={securityCode}
              onChangeText={setSecurityCode}
              keyboardType="number-pad"
              editable={!isSubmitting}
            />
            <Button title="Confirmar código" onPress={handleSubmitCode} loading={isSubmitting} />
            <Button
              title="Voltar"
              variant="ghost"
              onPress={() => {
                setShowTwoFactor(false)
                setSecurityCode("")
                setError(null)
              }}
            />
          </>
        ) : (
          <>
            <Input
              label="Usuário Instagram"
              placeholder="seu_usuario"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              editable={!isSubmitting}
            />
            <Input
              label="Senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!isSubmitting}
            />
            <Button
              title={isConnected ? "Reconectar" : "Conectar"}
              onPress={handleConnect}
              loading={isSubmitting || isManagingSessions}
            />
          </>
        )}

        {isConnected && !activeSession?.isRuntimeOn ? (
          <Button
            title="Iniciar sessão"
            variant="secondary"
            onPress={handleStartRuntime}
            loading={isSubmitting}
          />
        ) : null}

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>

      <Button title="Sair da conta" variant="danger" onPress={handleLogout} style={styles.logout} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  card: {
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  statusInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  igUsername: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  igName: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  hint: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  notice: {
    fontSize: 14,
    color: colors.primaryDark,
    fontWeight: "500",
  },
  error: {
    fontSize: 14,
    color: colors.error,
  },
  warning: {
    fontSize: 14,
    color: colors.warning,
    lineHeight: 20,
  },
  logout: {
    marginTop: spacing.sm,
  },
})
