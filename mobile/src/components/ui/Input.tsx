import { Eye, EyeOff } from "lucide-react-native"
import { useState } from "react"
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native"
import { colors } from "@/src/theme/colors"
import { radius, spacing } from "@/src/theme/spacing"

type InputProps = TextInputProps & {
  label?: string
  error?: string | null
  showPasswordToggle?: boolean
}

export function Input({
  label,
  error,
  style,
  secureTextEntry,
  showPasswordToggle,
  ...props
}: InputProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const canTogglePassword = Boolean(secureTextEntry || showPasswordToggle)
  const hidePassword = canTogglePassword && !isPasswordVisible

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputRow, error ? styles.inputError : null]}>
        <TextInput
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, style]}
          secureTextEntry={hidePassword}
          {...props}
        />
        {canTogglePassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? "Ocultar senha" : "Mostrar senha"}
            onPress={() => setIsPasswordVisible((visible) => !visible)}
            style={styles.toggleButton}
            hitSlop={8}
          >
            {isPasswordVisible ? (
              <EyeOff size={20} color={colors.textSecondary} />
            ) : (
              <Eye size={20} color={colors.textSecondary} />
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.slate700,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm + 4,
    fontSize: 16,
    color: colors.text,
    backgroundColor: "transparent",
  },
  toggleButton: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm + 4,
  },
  inputError: {
    borderColor: colors.error,
  },
  error: {
    fontSize: 13,
    color: colors.error,
  },
})
