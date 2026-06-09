import { useEffect, useState } from "react"
import { Alert, Platform, StyleSheet, Text, View } from "react-native"
import { Avatar } from "@/src/components/ui/Avatar"
import { Button } from "@/src/components/ui/Button"
import { Card } from "@/src/components/ui/Card"
import { Input } from "@/src/components/ui/Input"
import { StatusBadge } from "@/src/components/ui/StatusBadge"
import { useInstaConnect } from "@/src/features/insta/use-insta-connect"
import type { InstaSessionItem } from "@/src/features/insta/insta-connect-types"
import { colors } from "@/src/theme/colors"
import { spacing } from "@/src/theme/spacing"

type SessionManagePanelProps = {
  session: InstaSessionItem
  onDisconnected?: () => void
}

export function SessionManagePanel({ session, onDisconnected }: SessionManagePanelProps) {
  const {
    isManagingSessions,
    createSession,
    startSessionRuntime,
    stopSessionRuntime,
    removeSession,
    connectInstagramToSession,
    submitSecurityCodeForSession,
    refreshSessions,
  } = useInstaConnect()

  const isConnected = Boolean(session.instagramUsername)

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [securityCode, setSecurityCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showTwoFactor, setShowTwoFactor] = useState(false)
  const [pendingUsername, setPendingUsername] = useState("")

  const needsInstagramLogin = !isConnected || Boolean(session.requiresRelogin)
  const showConnectForm = needsInstagramLogin || showTwoFactor
  const needsRuntimeStart = isConnected && !session.requiresRelogin && !session.isRuntimeOn

  useEffect(() => {
    if (session.instagramUsername) {
      setUsername(session.instagramUsername)
    }
  }, [session.instagramUsername])

  async function handleConnect() {
    setError(null)
    setNotice(null)
    setIsSubmitting(true)
    const result = await connectInstagramToSession(session.id, username, password)
    if (result.success) {
      setPassword("")
      setSecurityCode("")
      setShowTwoFactor(false)
      setNotice("Instagram conectado com sucesso!")
      await refreshSessions()
    } else if ("challengeRequired" in result && result.challengeRequired) {
      setShowTwoFactor(true)
      setPendingUsername(result.username)
      setError(result.message ?? "Digite o código de segurança recebido.")
    } else if ("error" in result) {
      setError(result.error)
    }
    setIsSubmitting(false)
  }

  async function handleSubmitCode() {
    setError(null)
    setNotice(null)
    setIsSubmitting(true)
    const result = await submitSecurityCodeForSession(session.id, pendingUsername, securityCode)
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
    setError(null)
    setNotice(null)
    setIsSubmitting(true)
    const result = await startSessionRuntime(session.id)
    if (result.success) {
      setNotice(result.runtimeStatusMessage ?? "Sessão iniciada.")
    } else {
      setError(result.error)
    }
    setIsSubmitting(false)
  }

  async function handleStopRuntime() {
    setError(null)
    setNotice(null)
    setIsSubmitting(true)
    const result = await stopSessionRuntime(session.id)
    if (result.success) {
      setNotice(result.runtimeStatusMessage ?? "Instância desligada com sucesso.")
    } else {
      setError(result.error)
    }
    setIsSubmitting(false)
  }

  async function runDisconnectInstagram() {
    setError(null)
    setNotice(null)
    setIsSubmitting(true)

    const removeResult = await removeSession(session.id)
    if (!removeResult.success) {
      setError(removeResult.error)
      setIsSubmitting(false)
      return
    }

    await createSession(true)
    setUsername("")
    setPassword("")
    setSecurityCode("")
    setShowTwoFactor(false)
    setNotice("Instagram desconectado.")
    setIsSubmitting(false)
    onDisconnected?.()
  }

  function handleDisconnectInstagram() {
    const message =
      "Isso remove o vínculo com a conta Instagram desta sessão. Você precisará conectar novamente."

    if (Platform.OS === "web") {
      if (window.confirm(`Desconectar Instagram?\n\n${message}`)) {
        void runDisconnectInstagram()
      }
      return
    }

    Alert.alert("Desconectar Instagram", message, [
      { text: "Cancelar", style: "cancel" },
      { text: "Desconectar", style: "destructive", onPress: () => void runDisconnectInstagram() },
    ])
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.sectionTitle}>Status Instagram</Text>
      {isConnected ? (
        <View style={styles.statusRow}>
          <Avatar
            uri={session.instagramProfilePicUrl}
            username={session.instagramUsername ?? "?"}
          />
          <View style={styles.statusInfo}>
            <Text style={styles.igUsername}>@{session.instagramUsername}</Text>
            {session.instagramFullName ? (
              <Text style={styles.igName}>{session.instagramFullName}</Text>
            ) : null}
            <StatusBadge
              label={session.isRuntimeOn ? "Sessão ativa" : "Conectado"}
              variant="success"
            />
          </View>
        </View>
      ) : (
        <StatusBadge label="Não conectado" variant="warning" />
      )}

      {session.requiresRelogin ? (
        <Text style={styles.warning}>Sua sessão Instagram expirou. Faça login novamente.</Text>
      ) : null}

      {needsRuntimeStart ? (
        <Button
          title="Iniciar sessão"
          variant="secondary"
          onPress={handleStartRuntime}
          loading={isSubmitting || isManagingSessions}
        />
      ) : null}

      {isConnected && session.isRuntimeOn ? (
        <Button
          title="Desligar sessão"
          variant="secondary"
          onPress={handleStopRuntime}
          loading={isSubmitting || isManagingSessions}
        />
      ) : null}

      {isConnected ? (
        <Button
          title="Desconectar Instagram"
          variant="ghost"
          onPress={handleDisconnectInstagram}
          loading={isSubmitting || isManagingSessions}
          style={styles.disconnectButton}
        />
      ) : null}

      {showConnectForm ? (
        <View style={styles.connectBlock}>
          <Text style={styles.connectTitle}>
            {showTwoFactor
              ? "Código de segurança"
              : session.requiresRelogin
                ? "Reconectar Instagram"
                : "Conectar Instagram"}
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
                title={session.requiresRelogin ? "Reconectar" : "Conectar"}
                onPress={handleConnect}
                loading={isSubmitting || isManagingSessions}
              />
            </>
          )}
        </View>
      ) : null}

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: {
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
  connectBlock: {
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  connectTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
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
  disconnectButton: {
    alignSelf: "flex-start",
  },
})
