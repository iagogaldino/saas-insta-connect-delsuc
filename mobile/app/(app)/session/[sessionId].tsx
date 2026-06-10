import { useLocalSearchParams, useRouter } from "expo-router"
import { ChevronRight } from "lucide-react-native"
import { useEffect, useState } from "react"
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native"
import { SessionAutoFollowPanel } from "@/src/components/session/SessionAutoFollowPanel"
import { SessionManagePanel } from "@/src/components/session/SessionManagePanel"
import { Button } from "@/src/components/ui/Button"
import { Card } from "@/src/components/ui/Card"
import { Screen } from "@/src/components/ui/Screen"
import { ScreenHeader } from "@/src/components/ui/ScreenHeader"
import { useInstaConnect } from "@/src/features/insta/use-insta-connect"
import { sessionStatusLabel } from "@/src/features/insta/session-status"
import { colors } from "@/src/theme/colors"
import { spacing } from "@/src/theme/spacing"

export default function SessionDetailScreen() {
  const router = useRouter()
  const { sessionId: rawSessionId } = useLocalSearchParams<{ sessionId: string }>()
  const sessionId = rawSessionId ? decodeURIComponent(rawSessionId) : ""

  const {
    sessions,
    activeSessionId,
    setActiveSession,
    isManagingSessions,
    removeSession,
    startSessionRuntime,
  } = useInstaConnect()
  const session = sessions.find((s) => s.id === sessionId) ?? null

  const [isActivating, setIsActivating] = useState(true)
  const [activateError, setActivateError] = useState<string | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [isStartingRuntime, setIsStartingRuntime] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    let active = true

    const activate = async () => {
      setIsActivating(true)
      setActivateError(null)
      if (activeSessionId !== sessionId) {
        const result = await setActiveSession(sessionId)
        if (!active) return
        if (!result.success) {
          setActivateError(result.error ?? "Não foi possível ativar a sessão.")
        }
      }
      if (active) setIsActivating(false)
    }

    void activate()
    return () => {
      active = false
    }
  }, [sessionId, activeSessionId, setActiveSession])

  const isConnected = Boolean(session?.instagramUsername)
  const canAutoFollow =
    isConnected && Boolean(session?.isRuntimeOn) && !session?.requiresRelogin

  async function runRemoveSession() {
    setRemoveError(null)
    setIsRemoving(true)
    const result = await removeSession(sessionId)
    setIsRemoving(false)
    if (result.success) {
      router.back()
    } else {
      setRemoveError(result.error ?? "Não foi possível remover a sessão.")
    }
  }

  async function handleStartRuntimeFromAutoFollow() {
    if (!sessionId) return
    setIsStartingRuntime(true)
    await startSessionRuntime(sessionId)
    setIsStartingRuntime(false)
  }

  function handleRemoveSession() {
    const message =
      "Esta sessão será excluída permanentemente, incluindo o vínculo com o Instagram."

    if (Platform.OS === "web") {
      if (window.confirm(`Remover sessão?\n\n${message}`)) {
        void runRemoveSession()
      }
      return
    }

    Alert.alert("Remover sessão", message, [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => void runRemoveSession() },
    ])
  }

  if (!sessionId) {
    return (
      <Screen header={<ScreenHeader title="Sessão" subtitle="Identificador inválido" />}>
        <Text style={styles.error}>Sessão inválida.</Text>
      </Screen>
    )
  }

  if (!session && !isManagingSessions && !isActivating) {
    return (
      <Screen
        header={
          <ScreenHeader
            title="Sessão"
            subtitle="Não encontrada"
            onBack={() => router.back()}
            backLabel="Sessões"
          />
        }
      >
        <Text style={styles.error}>Sessão não encontrada.</Text>
      </Screen>
    )
  }

  const sessionTitle = session?.instagramUsername
    ? `@${session.instagramUsername}`
    : "Sessão sem Instagram"
  const sessionSubtitle = session ? sessionStatusLabel(session) : undefined

  const header = (
    <ScreenHeader
      title={sessionTitle}
      subtitle={sessionSubtitle}
      onBack={() => router.back()}
      backLabel="Sessões"
    />
  )

  return (
    <Screen header={header}>
      {isActivating || !session ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={styles.content}>
          <SessionManagePanel session={session} />

          {isConnected ? (
            <>
              {canAutoFollow ? (
                <SessionAutoFollowPanel />
              ) : (
                <SessionAutoFollowPanel
                  unavailable={{
                    message: session.requiresRelogin
                      ? "Reconecte o Instagram no perfil acima para continuar."
                      : "Inicie a instância na seção Instância acima para usar o AutoFollow.",
                    actionLabel: session.requiresRelogin ? undefined : "Iniciar instância",
                    onAction: session.requiresRelogin
                      ? undefined
                      : () => void handleStartRuntimeFromAutoFollow(),
                    actionLoading: isStartingRuntime,
                  }}
                />
              )}

              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/(app)/history",
                    params: { sessionId },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel="Ver histórico de follows dos últimos 30 dias"
              >
                <Card style={styles.activityCard}>
                  <View style={styles.activityRow}>
                    <View style={styles.activityInfo}>
                      <Text style={styles.activityTitle}>Histórico de follows</Text>
                      <Text style={styles.activitySubtitle}>Últimos 30 dias</Text>
                    </View>
                    <ChevronRight size={20} color={colors.textSecondary} />
                  </View>
                </Card>
              </Pressable>
            </>
          ) : null}

          <View style={styles.dangerZone}>
            <Text style={styles.dangerLabel}>Zona de perigo</Text>
            {activateError ? <Text style={styles.error}>{activateError}</Text> : null}
            {removeError ? <Text style={styles.error}>{removeError}</Text> : null}
            <Button
              title="Remover sessão"
              variant="danger"
              onPress={handleRemoveSession}
              loading={isRemoving || isManagingSessions}
            />
          </View>
        </View>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 200,
  },
  content: {
    gap: spacing.lg,
  },
  activityCard: {
    paddingVertical: spacing.sm + 4,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  activityInfo: {
    flex: 1,
    gap: 4,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  activitySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  dangerZone: {
    marginTop: spacing.md,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  dangerLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  error: {
    fontSize: 14,
    color: colors.error,
  },
})
