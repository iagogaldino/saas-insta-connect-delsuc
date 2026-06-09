import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from "react-native"
import { colors } from "@/src/theme/colors"
import { radius, spacing } from "@/src/theme/spacing"

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost"

type ButtonProps = {
  title: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  variant?: ButtonVariant
  style?: ViewStyle
}

export function Button({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = "primary",
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#fff" : colors.primary} />
      ) : (
        <Text style={[styles.text, textVariantStyles[variant]]}>{title}</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
  },
})

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary },
  danger: { backgroundColor: colors.error },
  ghost: { backgroundColor: "transparent" },
})

const textVariantStyles = StyleSheet.create({
  primary: { color: "#FFFFFF" },
  secondary: { color: colors.primaryDark },
  danger: { color: "#FFFFFF" },
  ghost: { color: colors.textSecondary },
})
