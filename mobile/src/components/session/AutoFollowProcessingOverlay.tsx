import { Check, UserPlus } from "lucide-react-native"
import { useEffect, useMemo, useState } from "react"
import { Modal, StyleSheet, Text, View } from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated"
import { colors } from "@/src/theme/colors"
import { radius, spacing } from "@/src/theme/spacing"

type AutoFollowProcessingOverlayProps = {
  visible: boolean
  quantity: number
}

const MESSAGE_ROTATE_MS = 2800
const SIMULATED_STEP_MS = 3500

function buildProcessingMessages(quantity: number): string[] {
  return [
    "Iniciando AutoFollow...",
    "Buscando perfis compatíveis...",
    ...Array.from({ length: quantity }, (_, i) => `Processando perfil ${i + 1} de ${quantity}...`),
    "Aguardando resposta do Instagram...",
    "Quase lá...",
  ]
}

function ShimmerBar() {
  const translateX = useSharedValue(-120)

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(280, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    )
  }, [translateX])

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressShimmer, shimmerStyle]} />
    </View>
  )
}

function PulsingIcon() {
  const scale = useSharedValue(1)

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    )
  }, [scale])

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Animated.View style={[styles.iconWrap, iconStyle]}>
      <UserPlus size={28} color={colors.primaryDark} />
    </Animated.View>
  )
}

type SlotState = "pending" | "active" | "done"

function AvatarSlot({ state, index }: { state: SlotState; index: number }) {
  const scale = useSharedValue(1)

  useEffect(() => {
    if (state === "active") {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      )
    } else {
      scale.value = withTiming(1, { duration: 200 })
    }
  }, [scale, state])

  const slotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Animated.View
      style={[
        styles.slot,
        state === "done" && styles.slotDone,
        state === "active" && styles.slotActive,
        slotStyle,
      ]}
    >
      {state === "done" ? (
        <Check size={18} color={colors.primaryDark} strokeWidth={2.5} />
      ) : (
        <Text style={[styles.slotLabel, state === "active" && styles.slotLabelActive]}>
          {index + 1}
        </Text>
      )}
    </Animated.View>
  )
}

export function AutoFollowProcessingOverlay({ visible, quantity }: AutoFollowProcessingOverlayProps) {
  const messages = useMemo(() => buildProcessingMessages(quantity), [quantity])
  const [messageIndex, setMessageIndex] = useState(0)
  const [simulatedStep, setSimulatedStep] = useState(0)

  useEffect(() => {
    if (!visible) {
      setMessageIndex(0)
      setSimulatedStep(0)
      return
    }

    const messageTimer = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length)
    }, MESSAGE_ROTATE_MS)

    const stepTimer = setInterval(() => {
      setSimulatedStep((prev) => Math.min(prev + 1, Math.max(quantity - 1, 0)))
    }, SIMULATED_STEP_MS)

    return () => {
      clearInterval(messageTimer)
      clearInterval(stepTimer)
    }
  }, [visible, messages.length, quantity])

  const slotStates: SlotState[] = Array.from({ length: quantity }, (_, i) => {
    if (i < simulatedStep) return "done"
    if (i === simulatedStep) return "active"
    return "pending"
  })

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <PulsingIcon />
          <Text style={styles.title}>AutoFollow em andamento</Text>
          <Text style={styles.message}>{messages[messageIndex]}</Text>

          <View style={styles.slotsRow}>
            {slotStates.map((state, index) => (
              <AvatarSlot key={index} state={state} index={index} />
            ))}
          </View>

          <ShimmerBar />

          <Text style={styles.caption}>
            {quantity === 1
              ? "Seguindo 1 perfil selecionado"
              : `Seguindo até ${quantity} perfis`}
          </Text>
        </View>
      </View>
    </Modal>
  )
}

const SLOT_SIZE = 44

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.md,
    width: "100%",
    maxWidth: 320,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    minHeight: 40,
  },
  slotsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.sm,
  },
  slot: {
    width: SLOT_SIZE,
    height: SLOT_SIZE,
    borderRadius: SLOT_SIZE / 2,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  slotActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  slotDone: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  slotLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  slotLabelActive: {
    color: colors.primaryDark,
  },
  progressTrack: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.slate200,
    overflow: "hidden",
  },
  progressShimmer: {
    width: 100,
    height: "100%",
    borderRadius: 3,
    backgroundColor: colors.primary,
    opacity: 0.85,
  },
  caption: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
  },
})
