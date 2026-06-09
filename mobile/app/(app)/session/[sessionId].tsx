import { useLocalSearchParams, useRouter } from "expo-router"
import { ArrowLeft } from "lucide-react-native"
import { useEffect, useState } from "react"
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native"
import { SessionAutoFollowPanel } from "@/src/components/session/SessionAutoFollowPanel"
import { SessionManagePanel } from "@/src/components/session/SessionManagePanel"
import { Button } from "@/src/components/ui/Button"
import { Screen } from "@/src/components/ui/Screen"
import { useInstaConnect } from "@/src/features/insta/use-insta-connect"
import { colors } from "@/src/theme/colors"
import { spacing } from "@/src/theme/spacing"

export default function SessionDetailScreen() {
  const router = useRouter()
  const { sessionId: rawSessionId } = useLocalSearchParams<{ sessionId: string }>()
  const sessionId = rawSessionId ? decodeURIComponent(rawSessionId) : ""

  const { sessions, activeSessionId, setActiveSession, isManagingSessions, removeSession } =
    useInstaConnect()
  const session = sessions.find((s) => s.id === sessionId) ?? null

  const [isActivating, setIsActivating] = useState(true)
  const [activateError, setActivateError] = useState<string | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

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
      <Screen>
        <Text style={styles.error}>Sessão inválida.</Text>
      </Screen>
    )
  }

  if (!session && !isManagingSessions && !isActivating) {
    return (
      <Screen>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <ArrowLeft size={20} color={colors.text} />
          <Text style={styles.backText}>Voltar</Text>
        </Pressable>
        <Text style={styles.error}>Sessão não encontrada.</Text>
      </Screen>
    )
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <ArrowLeft size={20} color={colors.text} />
        <Text style={styles.backText}>Sessões</Text>
      </Pressable>

      {isActivating || !session ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.title}>
            {session.instagramUsername ? `@${session.instagramUsername}` : "Nova sessão"}
          </Text>

          <SessionManagePanel
            session={session}
            onDisconnected={() => router.back()}
          />

          {canAutoFollow && session.instagramUsername ? (
            <SessionAutoFollowPanel instagramUsername={session.instagramUsername} />
          ) : isConnected ? (
            <View style={styles.hintBox}>
              <Text style={styles.hintTitle}>AutoFollow indisponível</Text>
              <Text style={styles.hintText}>
                {session.requiresRelogin
                  ? "Reconecte o Instagram nesta sessão para continuar."
                  : "Inicie a sessão acima para usar o AutoFollow."}
              </Text>
            </View>
          ) : (
            <View style={styles.hintBox}>
              <Text style={styles.hintTitle}>AutoFollow</Text>
              <Text style={styles.hintText}>
                Conecte uma conta Instagram nesta sessão para liberar o AutoFollow.
              </Text>
            </View>
          )}

          {activateError ? <Text style={styles.error}>{activateError}</Text> : null}
          {removeError ? <Text style={styles.error}>{removeError}</Text> : null}

          <Button
            title="Ver histórico"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: "/(app)/history",
                params: { sessionId },
              })
            }
          />

          <Button
            title="Remover sessão"
            variant="danger"
            onPress={handleRemoveSession}
            loading={isRemoving || isManagingSessions}
            style={styles.removeButton}
          />
        </View>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  backText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 200,
  },
  content: {
    gap: spacing.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
  },
  hintBox: {
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  hintTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  hintText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  error: {
    fontSize: 14,
    color: colors.error,
  },
  removeButton: {
    marginTop: spacing.sm,
  },
})
