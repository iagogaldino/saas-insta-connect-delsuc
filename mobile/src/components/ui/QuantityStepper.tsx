import { Minus, Plus } from "lucide-react-native"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { colors } from "@/src/theme/colors"
import { radius, spacing } from "@/src/theme/spacing"

const SHORTCUT_INCREMENTS = [10, 20, 30, 40] as const

type QuantityStepperProps = {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  showShortcuts?: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 100,
  showShortcuts = true,
}: QuantityStepperProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          onPress={() => onChange(clamp(value - 1, min, max))}
          style={styles.button}
          disabled={value <= min}
        >
          <Minus size={20} color={value <= min ? colors.textSecondary : colors.text} />
        </Pressable>
        <Text style={styles.value}>{value}</Text>
        <Pressable
          onPress={() => onChange(clamp(value + 1, min, max))}
          style={styles.button}
          disabled={value >= max}
        >
          <Plus size={20} color={value >= max ? colors.textSecondary : colors.text} />
        </Pressable>
      </View>

      {showShortcuts ? (
        <View style={styles.shortcuts}>
          {SHORTCUT_INCREMENTS.map((increment) => {
            const disabled = value >= max
            return (
              <Pressable
                key={increment}
                onPress={() => onChange(clamp(value + increment, min, max))}
                disabled={disabled}
                style={[styles.shortcutChip, disabled && styles.shortcutChipDisabled]}
              >
                <Text style={[styles.shortcutText, disabled && styles.shortcutTextDisabled]}>
                  +{increment}
                </Text>
              </Pressable>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
    minWidth: 40,
    textAlign: "center",
  },
  shortcuts: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  shortcutChip: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  shortcutChipDisabled: {
    opacity: 0.45,
  },
  shortcutText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primaryDark,
  },
  shortcutTextDisabled: {
    color: colors.textSecondary,
  },
})
