import { UserPlus } from "lucide-react-native"
import { useEffect, useMemo, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import { SafeAreaView } from "react-native-safe-area-context"
import { Card } from "@/src/components/ui/Card"
import { DemoUserRow, type FollowState } from "@/src/components/splash/DemoUserRow"
import { DEMO_SUGGESTED_USERS } from "@/src/components/splash/demo-users"
import { colors } from "@/src/theme/colors"
import { radius, spacing } from "@/src/theme/spacing"

type SplashPresentationProps = {
  onComplete: () => void
  canDismiss: boolean
}

const ROW_STAGGER_MS = 120
const ROWS_ENTER_START_MS = 300
const CLICKS_START_MS = 1200
const CLICK_INTERVALS_MS = [400, 380, 340, 300, 250]
const COUNTER_SHOW_MS = 3200

export function SplashPresentation({ onComplete, canDismiss }: SplashPresentationProps) {
  const [followStates, setFollowStates] = useState<FollowState[]>(
    () => DEMO_SUGGESTED_USERS.map(() => "idle"),
  )
  const [showCounter, setShowCounter] = useState(false)
  const [animationFinished, setAnimationFinished] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const headerOpacity = useSharedValue(0)
  const headerTranslateY = useSharedValue(-8)
  const overlayOpacity = useSharedValue(1)
  const counterOpacity = useSharedValue(0)
  const counterScale = useSharedValue(0.92)

  const rowEnterDelays = useMemo(
    () => DEMO_SUGGESTED_USERS.map((_, index) => ROWS_ENTER_START_MS + index * ROW_STAGGER_MS),
    [],
  )

  useEffect(() => {
    headerOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) })
    headerTranslateY.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) })
  }, [headerOpacity, headerTranslateY])

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    let clickAt = CLICKS_START_MS

    DEMO_SUGGESTED_USERS.forEach((_, index) => {
      const interval = CLICK_INTERVALS_MS[index] ?? 250

      timers.push(
        setTimeout(() => {
          setFollowStates((prev) => {
            const next = [...prev]
            next[index] = "pressing"
            return next
          })
        }, clickAt),
      )

      timers.push(
        setTimeout(() => {
          setFollowStates((prev) => {
            const next = [...prev]
            next[index] = "following"
            return next
          })
        }, clickAt + 130),
      )

      clickAt += interval
    })

    timers.push(
      setTimeout(() => {
        setShowCounter(true)
        counterOpacity.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) })
        counterScale.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) })
      }, COUNTER_SHOW_MS),
    )

    timers.push(
      setTimeout(() => {
        setAnimationFinished(true)
      }, COUNTER_SHOW_MS + 500),
    )

    return () => {
      timers.forEach(clearTimeout)
    }
  }, [counterOpacity, counterScale, overlayOpacity])

  useEffect(() => {
    if (!animationFinished || !canDismiss || dismissed) return

    overlayOpacity.value = withTiming(0, { duration: 300, easing: Easing.in(Easing.cubic) })

    const timer = setTimeout(() => {
      setDismissed(true)
      onComplete()
    }, 300)

    return () => clearTimeout(timer)
  }, [animationFinished, canDismiss, dismissed, onComplete, overlayOpacity])

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerTranslateY.value }],
  }))

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }))

  const counterStyle = useAnimatedStyle(() => ({
    opacity: counterOpacity.value,
    transform: [{ scale: counterScale.value }],
  }))

  return (
    <Animated.View style={[styles.overlay, overlayStyle]}>
      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.header, headerStyle]}>
          <View style={styles.logoWrap}>
            <UserPlus size={24} color={colors.primaryDark} />
          </View>
          <Text style={styles.title}>Insta Connect</Text>
          <Text style={styles.subtitle}>AutoFollow · sugeridos</Text>
        </Animated.View>

        <Card style={styles.listCard}>
          {DEMO_SUGGESTED_USERS.map((user, index) => (
            <DemoUserRow
              key={user.username}
              user={user}
              followState={followStates[index] ?? "idle"}
              enterDelayMs={rowEnterDelays[index] ?? 0}
              visible
            />
          ))}
        </Card>

        {showCounter ? (
          <Animated.View style={[styles.counterBadge, counterStyle]}>
            <Text style={styles.counterText}>
              {DEMO_SUGGESTED_USERS.length} perfis seguidos automaticamente
            </Text>
          </Animated.View>
        ) : null}
      </SafeAreaView>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
    zIndex: 999,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    alignItems: "center",
    gap: spacing.xs,
  },
  logoWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  listCard: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  counterBadge: {
    alignSelf: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  counterText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primaryDark,
    textAlign: "center",
  },
})
