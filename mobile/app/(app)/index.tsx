import { useRouter } from "expo-router"
import { ChevronRight, Plus } from "lucide-react-native"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { Avatar } from "@/src/components/ui/Avatar"
import { Button } from "@/src/components/ui/Button"
import { Card } from "@/src/components/ui/Card"
import { Screen } from "@/src/components/ui/Screen"
import { ScreenHeader } from "@/src/components/ui/ScreenHeader"
import { StatusBadge } from "@/src/components/ui/StatusBadge"
import { useInstaConnect } from "@/src/features/insta/use-insta-connect"
import type { InstaSessionItem } from "@/src/features/insta/insta-connect-types"
import { colors } from "@/src/theme/colors"
import { spacing } from "@/src/theme/spacing"

function sessionStatusLabel(session: InstaSessionItem): string {
  if (!session.instagramUsername) return "Não conectado"
  if (session.requiresRelogin) return "Reconectar"
  if (session.isRuntimeOn) return "Sessão ativa"
  return "Conectado"
}

function sessionStatusVariant(session: InstaSessionItem): "success" | "warning" | "error" {
  if (!session.instagramUsername || session.requiresRelogin) return "warning"
  return "success"
}

export default function SessionsScreen() {
  const router = useRouter()
  const { sessions, isManagingSessions, createSession } = useInstaConnect()

  function openSession(sessionId: string) {
    router.push({
      pathname: "/(app)/session/[sessionId]",
      params: { sessionId },
    })
  }

  async function handleCreateSession() {
    const result = await createSession(true)
    if (result.success && result.activeSessionId) {
      openSession(result.activeSessionId)
    }
  }

  return (
    <Screen
      header={
        <ScreenHeader
          title="Sessões"
          right={
            <Pressable
              onPress={() => void handleCreateSession()}
              disabled={isManagingSessions}
              style={[styles.addButton, isManagingSessions && styles.addButtonDisabled]}
            >
              <Plus size={22} color={colors.primaryDark} />
            </Pressable>
          }
        />
      }
    >
      {sessions.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Nenhuma sessão criada</Text>
          <Text style={styles.emptyText}>
            Crie uma sessão para conectar uma conta Instagram e usar o AutoFollow.
          </Text>
          <Button title="Nova sessão" onPress={handleCreateSession} loading={isManagingSessions} />
        </Card>
      ) : (
        <View style={styles.list}>
          {sessions.map((session) => (
            <Pressable key={session.id} onPress={() => openSession(session.id)}>
              <Card style={styles.sessionCard}>
                <View style={styles.sessionRow}>
                  <Avatar
                    uri={session.instagramProfilePicUrl}
                    username={session.instagramUsername ?? session.id.slice(0, 2)}
                  />
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionTitle}>
                      {session.instagramUsername
                        ? `@${session.instagramUsername}`
                        : "Sessão sem Instagram"}
                    </Text>
                    {session.instagramFullName ? (
                      <Text style={styles.sessionSubtitle}>{session.instagramFullName}</Text>
                    ) : null}
                    <View style={styles.badges}>
                      <StatusBadge
                        label={sessionStatusLabel(session)}
                        variant={sessionStatusVariant(session)}
                      />
                    </View>
                  </View>
                  <ChevronRight size={20} color={colors.textSecondary} />
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  list: {
    gap: spacing.sm,
  },
  sessionCard: {
    paddingVertical: spacing.sm + 4,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  sessionInfo: {
    flex: 1,
    gap: 4,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  sessionSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  emptyCard: {
    marginTop: spacing.lg,
    gap: spacing.md,
    alignItems: "stretch",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
})
