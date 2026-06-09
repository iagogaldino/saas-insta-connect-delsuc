import { useLocalSearchParams, useRouter } from "expo-router"
import { useMemo, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Avatar } from "@/src/components/ui/Avatar"
import { Button } from "@/src/components/ui/Button"
import { Card } from "@/src/components/ui/Card"
import { Screen } from "@/src/components/ui/Screen"
import { SegmentedControl } from "@/src/components/ui/SegmentedControl"
import { StatusBadge } from "@/src/components/ui/StatusBadge"
import type { AutoFollowResultItem } from "@/src/lib/insta"
import { colors } from "@/src/theme/colors"
import { spacing } from "@/src/theme/spacing"

type ResultTab = "followed" | "failed"

export default function ResultsScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    requested?: string
    followed?: string
    attempted?: string
    privacyFilter?: string
    results?: string
    targetUsername?: string
  }>()

  const [resultTab, setResultTab] = useState<ResultTab>("followed")

  const results = useMemo<AutoFollowResultItem[]>(() => {
    if (!params.results) return []
    try {
      return JSON.parse(params.results) as AutoFollowResultItem[]
    } catch {
      return []
    }
  }, [params.results])

  const followedItems = results.filter((item) => item.success)
  const failedItems = results.filter((item) => !item.success)
  const visibleItems = resultTab === "followed" ? followedItems : failedItems

  const requested = Number(params.requested ?? 0)
  const followed = Number(params.followed ?? 0)
  const attempted = Number(params.attempted ?? 0)
  const targetUsername = params.targetUsername?.trim()

  return (
    <Screen>
      <Text style={styles.title}>Resultado</Text>

      <Card style={styles.summary}>
        <Text style={styles.summaryText}>
          Seguiu <Text style={styles.bold}>{followed}</Text> de{" "}
          <Text style={styles.bold}>{requested}</Text> solicitados
        </Text>
        <Text style={styles.meta}>
          Tentativas: {attempted}
          {params.privacyFilter ? ` · Filtro: ${params.privacyFilter}` : ""}
          {targetUsername ? ` · Alvo: @${targetUsername}` : ""}
        </Text>
      </Card>

      <SegmentedControl
        options={[
          { id: "followed" as const, label: `Seguidos (${followedItems.length})` },
          { id: "failed" as const, label: `Falhas (${failedItems.length})` },
        ]}
        value={resultTab}
        onChange={setResultTab}
      />

      <View style={styles.list}>
        {visibleItems.length === 0 ? (
          <Card>
            <Text style={styles.empty}>
              {resultTab === "followed"
                ? "Nenhum perfil seguido nesta execução."
                : "Nenhuma falha nesta execução."}
            </Text>
          </Card>
        ) : (
          visibleItems.map((item, idx) => (
            <Card key={`${item.username}-${idx}`} style={styles.itemCard}>
              <View style={styles.itemRow}>
                <Avatar uri={item.profilePicUrl} username={item.username} size={44} />
                <View style={styles.itemInfo}>
                  <Text style={styles.itemUsername}>@{item.username}</Text>
                  {item.fullName ? <Text style={styles.itemName}>{item.fullName}</Text> : null}
                  <View style={styles.badges}>
                    <StatusBadge
                      label={item.success ? "Seguido" : "Não seguido"}
                      variant={item.success ? "success" : "error"}
                    />
                    {typeof item.isPrivate === "boolean" ? (
                      <StatusBadge
                        label={item.isPrivate ? "Privado" : "Público"}
                        variant="neutral"
                      />
                    ) : null}
                  </View>
                  {item.error ? <Text style={styles.itemError}>{item.error}</Text> : null}
                  {item.reason ? <Text style={styles.itemReason}>{item.reason}</Text> : null}
                </View>
              </View>
            </Card>
          ))
        )}
      </View>

      <Button title="Voltar ao AutoFollow" onPress={() => router.back()} style={styles.back} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.md,
  },
  summary: {
    marginBottom: spacing.md,
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
    marginTop: spacing.md,
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
    gap: 4,
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
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  itemError: {
    fontSize: 12,
    color: colors.error,
    marginTop: 2,
  },
  itemReason: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  empty: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
  back: {
    marginTop: spacing.lg,
  },
})
