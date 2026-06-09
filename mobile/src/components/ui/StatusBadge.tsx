import { StyleSheet, Text, View } from "react-native"
import { colors } from "@/src/theme/colors"
import { radius, spacing } from "@/src/theme/spacing"

type BadgeVariant = "success" | "error" | "neutral" | "warning"

type StatusBadgeProps = {
  label: string
  variant?: BadgeVariant
}

export function StatusBadge({ label, variant = "neutral" }: StatusBadgeProps) {
  return (
    <View style={[styles.badge, variantStyles[variant]]}>
      <Text style={[styles.text, textVariantStyles[variant]]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
  },
})

const variantStyles = StyleSheet.create({
  success: { backgroundColor: colors.primaryLight },
  error: { backgroundColor: colors.errorLight },
  neutral: { backgroundColor: colors.slate200 },
  warning: { backgroundColor: colors.warningLight },
})

const textVariantStyles = StyleSheet.create({
  success: { color: colors.primaryDark },
  error: { color: colors.error },
  neutral: { color: colors.slate700 },
  warning: { color: colors.warning },
})
