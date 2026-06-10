import { useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Avatar } from "@/src/components/ui/Avatar"
import { Button } from "@/src/components/ui/Button"
import { Card } from "@/src/components/ui/Card"
import { Input } from "@/src/components/ui/Input"
import { StatusBadge } from "@/src/components/ui/StatusBadge"
import { useInstaConnect } from "@/src/features/insta/use-insta-connect"
import type { InstaSessionItem } from "@/src/features/insta/insta-connect-types"
import { sessionStatusLabel, sessionStatusVariant } from "@/src/features/insta/session-status"
import { colors } from "@/src/theme/colors"
import { spacing } from "@/src/theme/spacing"

type SessionManagePanelProps = {
  session: InstaSessionItem
}

export function SessionManagePanel({ session }: SessionManagePanelProps) {
  const {
    isManagingSessions,
    startSessionRuntime,
    stopSessionRuntime,
    connectInstagramToSession,
    submitSecurityCodeForSession,
    refreshSessions,
  } = useInstaConnect()

  const isConnected = Boolean(session.instagramUsername)

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [securityCode, setSecurityCode] = useState("")
  const [connectError, setConnectError] = useState<string | null>(null)
  const [connectNotice, setConnectNotice] = useState<string | null>(null)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [runtimeNotice, setRuntimeNotice] = useState<string | null>(null)
  const [isSubmittingConnect, setIsSubmittingConnect] = useState(false)
  const [isSubmittingRuntime, setIsSubmittingRuntime] = useState(false)
  const [showTwoFactor, setShowTwoFactor] = useState(false)
  const [pendingUsername, setPendingUsername] = useState("")

  const needsInstagramLogin = !isConnected || Boolean(session.requiresRelogin)
  const showConnectForm = needsInstagramLogin || showTwoFactor
  const showRuntimeSection = isConnected && !session.requiresRelogin

  useEffect(() => {
    if (session.instagramUsername) {
      setUsername(session.instagramUsername)
    }
  }, [session.instagramUsername])

  async function handleConnect() {
    setConnectError(null)
    setConnectNotice(null)
    setIsSubmittingConnect(true)
    const result = await connectInstagramToSession(session.id, username, password)
    if (result.success) {
      setPassword("")
      setSecurityCode("")
      setShowTwoFactor(false)
      setConnectNotice("Instagram conectado com sucesso!")
      await refreshSessions()
    } else if ("challengeRequired" in result && result.challengeRequired) {
      setShowTwoFactor(true)
      setPendingUsername(result.username)
      setConnectError(result.message ?? "Digite o código de segurança recebido.")
    } else if ("error" in result) {
      setConnectError(result.error)
    }
    setIsSubmittingConnect(false)
  }

  async function handleSubmitCode() {
    setConnectError(null)
    setConnectNotice(null)
    setIsSubmittingConnect(true)
    const result = await submitSecurityCodeForSession(session.id, pendingUsername, securityCode)
    if (result.success) {
      setPassword("")
      setSecurityCode("")
      setShowTwoFactor(false)
      setConnectNotice("Código confirmado. Instagram conectado!")
      await refreshSessions()
    } else if ("challengeRequired" in result && result.challengeRequired) {
      setConnectError(result.message ?? "Código inválido ou expirado. Tente novamente.")
    } else if ("error" in result) {
      setConnectError(result.error)
    }
    setIsSubmittingConnect(false)
  }

  async function handleStartRuntime() {
    setRuntimeError(null)
    setRuntimeNotice(null)
    setIsSubmittingRuntime(true)
    const result = await startSessionRuntime(session.id)
    if (result.success) {
      setRuntimeNotice(result.runtimeStatusMessage ?? "Sessão iniciada.")
    } else {
      setRuntimeError(result.error)
    }
    setIsSubmittingRuntime(false)
  }

  async function handleStopRuntime() {
    setRuntimeError(null)
    setRuntimeNotice(null)
    setIsSubmittingRuntime(true)
    const result = await stopSessionRuntime(session.id)
    if (result.success) {
      setRuntimeNotice(result.runtimeStatusMessage ?? "Instância desligada com sucesso.")
    } else {
      setRuntimeError(result.error)
    }
    setIsSubmittingRuntime(false)
  }

  return (
    <View style={styles.wrap}>
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Perfil Instagram</Text>
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
                label={sessionStatusLabel(session)}
                variant={sessionStatusVariant(session)}
              />
            </View>
          </View>
        ) : (
          <View style={styles.disconnectedRow}>
            <StatusBadge label="Não conectado" variant="warning" />
            <Text style={styles.disconnectedHint}>
              Conecte uma conta Instagram para usar o AutoFollow.
            </Text>
          </View>
        )}

        {showConnectForm ? (
          <View style={styles.connectBlock}>
            {session.requiresRelogin && !showTwoFactor ? (
              <Text style={styles.warning}>
                Sua sessão Instagram expirou. Faça login novamente.
              </Text>
            ) : null}

            {showTwoFactor ? (
              <>
                <Text style={styles.connectTitle}>Código de segurança</Text>
                <Text style={styles.hint}>
                  Código enviado para @{pendingUsername}. Digite abaixo para concluir.
                </Text>
                <Input
                  label="Código"
                  value={securityCode}
                  onChangeText={setSecurityCode}
                  keyboardType="number-pad"
                  editable={!isSubmittingConnect}
                />
                <Button
                  title="Confirmar código"
                  onPress={handleSubmitCode}
                  loading={isSubmittingConnect}
                />
                <Button
                  title="Voltar"
                  variant="ghost"
                  onPress={() => {
                    setShowTwoFactor(false)
                    setSecurityCode("")
                    setConnectError(null)
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
                  editable={!isSubmittingConnect}
                />
                <Input
                  label="Senha"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  editable={!isSubmittingConnect}
                />
                <Button
                  title={session.requiresRelogin ? "Reconectar" : "Conectar"}
                  onPress={handleConnect}
                  loading={isSubmittingConnect || isManagingSessions}
                />
              </>
            )}

            {connectNotice ? <Text style={styles.notice}>{connectNotice}</Text> : null}
            {connectError ? <Text style={styles.error}>{connectError}</Text> : null}
          </View>
        ) : null}
      </Card>

      {showRuntimeSection ? (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Instância</Text>
          <StatusBadge
            label={session.isRuntimeOn ? "Sessão ativa" : "Instância desligada"}
            variant={session.isRuntimeOn ? "success" : "warning"}
          />
          <Text style={styles.hint}>
            A instância precisa estar ativa para executar o AutoFollow nesta sessão.
          </Text>

          {session.isRuntimeOn ? (
            <Button
              title="Desligar sessão"
              variant="secondary"
              onPress={handleStopRuntime}
              loading={isSubmittingRuntime || isManagingSessions}
            />
          ) : (
            <Button
              title="Iniciar sessão"
              onPress={handleStartRuntime}
              loading={isSubmittingRuntime || isManagingSessions}
            />
          )}

          {runtimeNotice ? <Text style={styles.notice}>{runtimeNotice}</Text> : null}
          {runtimeError ? <Text style={styles.error}>{runtimeError}</Text> : null}
        </Card>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
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
  disconnectedRow: {
    gap: spacing.sm,
  },
  disconnectedHint: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
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
})
