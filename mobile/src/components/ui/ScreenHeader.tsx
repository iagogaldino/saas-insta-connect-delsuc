import { ArrowLeft } from "lucide-react-native"
import { type ReactNode } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { colors } from "@/src/theme/colors"
import { spacing } from "@/src/theme/spacing"

type ScreenHeaderProps = {
  title?: string
  subtitle?: string
  onBack?: () => void
  backLabel?: string
  right?: ReactNode
}

export function ScreenHeader({ title, subtitle, onBack, backLabel, right }: ScreenHeaderProps) {
  const showTitleRow = Boolean(title || subtitle || right)

  return (
    <View style={styles.wrap}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.backRow} hitSlop={8}>
          <ArrowLeft size={20} color={colors.text} />
          {backLabel ? <Text style={styles.backLabel}>{backLabel}</Text> : null}
        </Pressable>
      ) : null}

      {showTitleRow ? (
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            {title ? (
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {right ? <View style={styles.right}>{right}</View> : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    alignSelf: "flex-start",
  },
  backLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  right: {
    flexShrink: 0,
  },
})
