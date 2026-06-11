import { useEffect } from "react"
import { StyleSheet, Text, View } from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated"
import { Avatar } from "@/src/components/ui/Avatar"
import type { DemoUser } from "@/src/components/splash/demo-users"
import { colors } from "@/src/theme/colors"
import { radius, spacing } from "@/src/theme/spacing"

export type FollowState = "idle" | "pressing" | "following"

type DemoUserRowProps = {
  user: DemoUser
  followState: FollowState
  enterDelayMs: number
  visible: boolean
}

export function DemoUserRow({ user, followState, enterDelayMs, visible }: DemoUserRowProps) {
  const opacity = useSharedValue(0)
  const translateY = useSharedValue(12)
  const buttonScale = useSharedValue(1)

  useEffect(() => {
    if (!visible) return

    const timer = setTimeout(() => {
      opacity.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) })
      translateY.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) })
    }, enterDelayMs)

    return () => clearTimeout(timer)
  }, [enterDelayMs, opacity, translateY, visible])

  useEffect(() => {
    if (followState === "pressing") {
      buttonScale.value = withSequence(
        withTiming(0.92, { duration: 100, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }),
      )
    }
  }, [buttonScale, followState])

  const rowStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }))

  const isFollowing = followState === "following"

  return (
    <Animated.View style={[styles.row, rowStyle]}>
      <Avatar username={user.username} size={44} />
      <View style={styles.info}>
        <Text style={styles.username} numberOfLines={1}>
          @{user.username}
        </Text>
        <Text style={styles.fullName} numberOfLines={1}>
          {user.fullName}
        </Text>
      </View>
      <Animated.View
        style={[
          styles.followButton,
          isFollowing ? styles.followButtonFollowing : styles.followButtonIdle,
          buttonStyle,
        ]}
      >
        <Text style={[styles.followText, isFollowing && styles.followTextFollowing]}>
          {isFollowing ? "Seguindo" : "Seguir"}
        </Text>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  username: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  fullName: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  followButton: {
    minWidth: 88,
    minHeight: 32,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  followButtonIdle: {
    backgroundColor: colors.primary,
  },
  followButtonFollowing: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  followText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  followTextFollowing: {
    color: colors.textSecondary,
  },
})
