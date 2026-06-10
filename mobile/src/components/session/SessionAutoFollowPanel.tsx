import axios from "axios"
import { useRouter } from "expo-router"
import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { Avatar } from "@/src/components/ui/Avatar"
import { Button } from "@/src/components/ui/Button"
import { Card } from "@/src/components/ui/Card"
import { Input } from "@/src/components/ui/Input"
import { AutoFollowProcessingOverlay } from "@/src/components/session/AutoFollowProcessingOverlay"
import { QuantityStepper } from "@/src/components/ui/QuantityStepper"
import { SegmentedControl } from "@/src/components/ui/SegmentedControl"
import { useInstaRealtime } from "@/src/features/insta/insta-realtime-provider"
import { isReloginError, waitForAutoFollowJobResult } from "@/src/hooks/use-auto-follow-job"
import {
  getInstaPreviewProfile,
  postAutoFollowFollowers,
  postAutoFollowSuggested,
  type AutoFollowFollowersResponse,
  type AutoFollowPrivacyFilter,
  type AutoFollowResponse,
  type InstaPreviewProfileResponse,
} from "@/src/lib/insta"
import { notifyAutoFollowComplete } from "@/src/lib/notifications"
import { colors } from "@/src/theme/colors"
import { spacing } from "@/src/theme/spacing"

type FlowTab = "suggested" | "followers"

const PRIVACY_OPTIONS: ReadonlyArray<{ id: AutoFollowPrivacyFilter; label: string }> = [
  { id: "any", label: "Qualquer" },
  { id: "public", label: "Público" },
  { id: "private", label: "Privado" },
]

const FLOW_TABS: ReadonlyArray<{ id: FlowTab; label: string }> = [
  { id: "suggested", label: "Sugeridos" },
  { id: "followers", label: "Seguidores de @" },
]

type SessionAutoFollowUnavailable = {
  message: string
  actionLabel?: string
  onAction?: () => void
  actionLoading?: boolean
}

type SessionAutoFollowPanelProps = {
  onReloginRequired?: () => void
  unavailable?: SessionAutoFollowUnavailable
}

export function SessionAutoFollowPanel({
  onReloginRequired,
  unavailable,
}: SessionAutoFollowPanelProps) {
  const router = useRouter()
  const { socket } = useInstaRealtime()

  const [flowTab, setFlowTab] = useState<FlowTab>("suggested")
  const [quantity, setQuantity] = useState(3)
  const [privacyFilter, setPrivacyFilter] = useState<AutoFollowPrivacyFilter>("any")
  const [targetUsername, setTargetUsername] = useState("")
  const [preview, setPreview] = useState<InstaPreviewProfileResponse | null>(null)
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [overlayVisible, setOverlayVisible] = useState(false)

  async function handleAutoFollowSuccess(result: AutoFollowResponse | AutoFollowFollowersResponse) {
    await notifyAutoFollowComplete({
      followed: result.followed,
      requested: result.requested,
      targetUsername: "targetUsername" in result ? result.targetUsername : undefined,
    })
    setOverlayVisible(false)
    navigateToResults(result)
  }

  function navigateToResults(result: AutoFollowResponse | AutoFollowFollowersResponse) {
    router.push({
      pathname: "/(app)/results",
      params: {
        requested: String(result.requested),
        followed: String(result.followed),
        attempted: String(result.attempted),
        privacyFilter: result.privacyFilter,
        results: JSON.stringify(result.results),
        targetUsername: "targetUsername" in result ? result.targetUsername : "",
      },
    })
  }

  function handleApiError(apiError: string) {
    setError(apiError)
    if (isReloginError(apiError)) {
      onReloginRequired?.()
    }
  }

  async function runSuggested() {
    setError(null)
    setIsSubmitting(true)
    setOverlayVisible(true)
    try {
      const { data } = await postAutoFollowSuggested(quantity, privacyFilter)
      const finalResult = await waitForAutoFollowJobResult<AutoFollowResponse>(socket, data.jobId)
      await handleAutoFollowSuccess(finalResult)
    } catch (e) {
      setOverlayVisible(false)
      if (axios.isAxiosError(e)) {
        const body = e.response?.data as { error?: string } | undefined
        handleApiError(body?.error ?? e.message)
      } else {
        setError(e instanceof Error ? e.message : "Erro desconhecido.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function verifyProfile() {
    setError(null)
    setPreviewError(null)
    const t = targetUsername.replace(/^@+/, "").trim()
    if (!t) {
      setError("Informe o nome de usuário do perfil alvo.")
      return
    }
    setPreviewLoading(true)
    setAwaitingConfirm(false)
    setPreview(null)
    try {
      const { data } = await getInstaPreviewProfile(t)
      setPreview(data)
      if (data.found) {
        setAwaitingConfirm(true)
      } else {
        setPreviewError("Perfil não encontrado. Verifique o @ informado.")
      }
    } catch (e) {
      if (axios.isAxiosError(e)) {
        const body = e.response?.data as { error?: string } | undefined
        setPreviewError(body?.error ?? e.message)
      } else {
        setPreviewError(e instanceof Error ? e.message : "Não foi possível verificar o perfil.")
      }
    } finally {
      setPreviewLoading(false)
    }
  }

  async function runFollowers() {
    setError(null)
    setIsSubmitting(true)
    const t = targetUsername.replace(/^@+/, "").trim()
    if (!t) {
      setError("Informe o nome de usuário do perfil alvo.")
      setIsSubmitting(false)
      return
    }
    setOverlayVisible(true)
    try {
      const { data } = await postAutoFollowFollowers(t, quantity, privacyFilter)
      const finalResult = await waitForAutoFollowJobResult<AutoFollowFollowersResponse>(socket, data.jobId)
      setAwaitingConfirm(false)
      setPreview(null)
      await handleAutoFollowSuccess(finalResult)
    } catch (e) {
      setOverlayVisible(false)
      if (axios.isAxiosError(e)) {
        const body = e.response?.data as { error?: string } | undefined
        handleApiError(body?.error ?? e.message)
      } else {
        setError(e instanceof Error ? e.message : "Erro desconhecido.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (unavailable) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.sectionTitle}>AutoFollow</Text>
        <Card style={styles.unavailableCard}>
          <Text style={styles.unavailableTitle}>AutoFollow indisponível</Text>
          <Text style={styles.unavailableMessage}>{unavailable.message}</Text>
          {unavailable.actionLabel && unavailable.onAction ? (
            <Button
              title={unavailable.actionLabel}
              variant="secondary"
              onPress={unavailable.onAction}
              loading={unavailable.actionLoading}
            />
          ) : null}
        </Card>
      </View>
    )
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>AutoFollow</Text>

      <SegmentedControl options={FLOW_TABS} value={flowTab} onChange={setFlowTab} />

      <Card style={styles.card}>
        <View style={styles.quantitySection}>
          <Text style={styles.quantityLabel}>Quantidade</Text>
          <QuantityStepper value={quantity} onChange={setQuantity} />
        </View>

        <Text style={[styles.sectionLabel, styles.sectionGap]}>Filtro de privacidade</Text>
        <View style={styles.privacyRow}>
          {PRIVACY_OPTIONS.map((opt) => (
            <Pressable
              key={opt.id}
              onPress={() => setPrivacyFilter(opt.id)}
              style={[styles.privacyChip, privacyFilter === opt.id && styles.privacyChipActive]}
            >
              <Text
                style={[
                  styles.privacyChipText,
                  privacyFilter === opt.id && styles.privacyChipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {flowTab === "followers" ? (
          <>
            <View style={styles.sectionGap}>
              <Input
                label="Perfil alvo"
                placeholder="@usuario"
                value={targetUsername}
                onChangeText={(v) => {
                  setTargetUsername(v)
                  setAwaitingConfirm(false)
                  setPreview(null)
                  setPreviewError(null)
                }}
                autoCapitalize="none"
                editable={!isSubmitting && !previewLoading}
              />
            </View>

            {preview && awaitingConfirm ? (
              <View style={styles.previewCard}>
                <View style={styles.previewRow}>
                  <Avatar uri={preview.profilePicUrl} username={preview.username} />
                  <View style={styles.previewInfo}>
                    <Text style={styles.previewUsername}>@{preview.username}</Text>
                    {preview.fullName ? (
                      <Text style={styles.previewName}>{preview.fullName}</Text>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.previewHint}>
                  Confirme se este é o perfil cujos seguidores serão seguidos.
                </Text>
              </View>
            ) : null}

            {previewError ? <Text style={styles.error}>{previewError}</Text> : null}

            <View style={styles.actions}>
              {awaitingConfirm ? (
                <>
                  <Button title="Confirmar e seguir" onPress={runFollowers} loading={isSubmitting} />
                  <Button
                    title="Cancelar"
                    variant="ghost"
                    onPress={() => {
                      setAwaitingConfirm(false)
                      setPreview(null)
                    }}
                  />
                </>
              ) : (
                <Button
                  title={previewLoading ? "Verificando..." : "Verificar perfil"}
                  onPress={verifyProfile}
                  loading={previewLoading}
                />
              )}
            </View>
          </>
        ) : (
          <View style={styles.actions}>
            <Button title="Iniciar" onPress={runSuggested} loading={isSubmitting} />
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>

      <AutoFollowProcessingOverlay visible={overlayVisible} quantity={quantity} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  unavailableCard: {
    gap: spacing.sm,
    opacity: 0.85,
  },
  unavailableTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  unavailableMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  card: {
    gap: spacing.sm,
  },
  quantitySection: {
    alignItems: "center",
    gap: spacing.sm,
    width: "100%",
  },
  quantityLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.slate700,
    textAlign: "center",
    width: "100%",
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.slate700,
  },
  sectionGap: {
    marginTop: spacing.md,
  },
  privacyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  privacyChip: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  privacyChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  privacyChipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  privacyChipTextActive: {
    color: colors.primaryDark,
    fontWeight: "600",
  },
  previewCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  previewInfo: {
    flex: 1,
  },
  previewUsername: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  previewName: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  previewHint: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  error: {
    fontSize: 14,
    color: colors.error,
    marginTop: spacing.sm,
  },
})
