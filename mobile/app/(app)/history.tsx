import axios from "axios"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"
import { Avatar } from "@/src/components/ui/Avatar"
import { Card } from "@/src/components/ui/Card"
import { Screen } from "@/src/components/ui/Screen"
import { ScreenHeader } from "@/src/components/ui/ScreenHeader"
import { StatusBadge } from "@/src/components/ui/StatusBadge"
import { useInstaRealtime } from "@/src/features/insta/insta-realtime-provider"
import { useInstaConnect } from "@/src/features/insta/use-insta-connect"
import { getFollowsMetrics, type FollowsMetricsResponse } from "@/src/lib/insta"
import { colors } from "@/src/theme/colors"
import { spacing } from "@/src/theme/spacing"

function formatDateTimeBr(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

export default function HistoryScreen() {
  const router = useRouter()
  const { sessionId: rawSessionId } = useLocalSearchParams<{ sessionId: string }>()
  const sessionId = rawSessionId ? decodeURIComponent(rawSessionId) : ""

  const { sessions } = useInstaConnect()
  const { socket } = useInstaRealtime()
  const session = sessions.find((s) => s.id === sessionId) ?? null

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<FollowsMetricsResponse | null>(null)

  const loadHistory = useCallback(async () => {
    if (!sessionId) return
    setLoading(true)
    setError(null)
    try {
      const { data } = await getFollowsMetrics(30, sessionId)
      setMetrics(data)
    } catch (e) {
      if (axios.isAxiosError(e)) {
        const body = e.response?.data as { error?: string } | undefined
        setError(body?.error ?? e.message)
      } else {
        setError(e instanceof Error ? e.message : "Erro ao carregar histórico.")
      }
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  useEffect(() => {
    if (!socket || !sessionId) return
    const onFollowOutbound = (raw: unknown) => {
      const payload = raw as { sessionId?: string }
      if (payload.sessionId === sessionId) {
        void loadHistory()
      }
    }
    socket.on("followOutbound:success", onFollowOutbound)
    return () => {
      socket.off("followOutbound:success", onFollowOutbound)
    }
  }, [socket, sessionId, loadHistory])

  const sessionLabel = session?.instagramUsername
    ? `@${session.instagramUsername}`
    : "esta sessão"

  if (!sessionId) {
    return (
      <Screen header={<ScreenHeader title="Histórico" subtitle="Sessão inválida" />}>
        <Text style={styles.error}>Sessão inválida.</Text>
      </Screen>
    )
  }

  return (
    <Screen
      header={
        <ScreenHeader
          title="Histórico"
          subtitle={`${sessionLabel} · últimos 30 dias`}
          onBack={() => router.back()}
          backLabel="Sessão"
        />
      }
    >
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <View style={styles.content}>
          <Card style={styles.summary}>
            <Text style={styles.summaryText}>
              <Text style={styles.bold}>{metrics?.recent.length ?? 0}</Text> registros recentes
            </Text>
            <Text style={styles.meta}>
              Total no período: {metrics?.totals.inWindow ?? 0} follows
            </Text>
          </Card>

          <View style={styles.list}>
            {(metrics?.recent.length ?? 0) === 0 ? (
              <Card>
                <Text style={styles.empty}>Nenhum follow registrado ainda nesta sessão.</Text>
              </Card>
            ) : (
              metrics?.recent.map((item, idx) => (
                <Card key={`${item.username}-${item.followedAt}-${idx}`} style={styles.itemCard}>
                  <View style={styles.itemRow}>
                    <Avatar uri={item.profilePicUrl} username={item.username} size={44} />
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemUsername}>@{item.username}</Text>
                      {item.fullName ? <Text style={styles.itemName}>{item.fullName}</Text> : null}
                      <Text style={styles.itemDate}>{formatDateTimeBr(item.followedAt)}</Text>
                      <View style={styles.badges}>
                        {typeof item.isPrivate === "boolean" ? (
                          <StatusBadge
                            label={item.isPrivate ? "Privado" : "Público"}
                            variant="neutral"
                          />
                        ) : null}
                        {item.reason ? (
                          <StatusBadge label={item.reason} variant="neutral" />
                        ) : null}
                      </View>
                    </View>
                  </View>
                </Card>
              ))
            )}
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
    gap: spacing.md,
  },
  summary: {
    gap: spacing.xs,
  },
  summaryText: {
    fontSize: 16,
    color: colors.text,
  },
  bold: {
    fontWeight: "700",
  },
  meta: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  list: {
    gap: spacing.sm,
  },
  itemCard: {
    paddingVertical: spacing.sm + 4,
  },
  itemRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemUsername: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  itemName: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  itemDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  empty: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
  error: {
    fontSize: 14,
    color: colors.error,
  },
})
