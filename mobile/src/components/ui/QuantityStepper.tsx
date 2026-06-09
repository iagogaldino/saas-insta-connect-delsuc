import { Minus, Plus } from "lucide-react-native"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { colors } from "@/src/theme/colors"
import { radius, spacing } from "@/src/theme/spacing"

type QuantityStepperProps = {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}

export function QuantityStepper({ value, onChange, min = 1, max = 50 }: QuantityStepperProps) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onChange(Math.max(min, value - 1))}
        style={styles.button}
        disabled={value <= min}
      >
        <Minus size={20} color={value <= min ? colors.textSecondary : colors.text} />
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable
        onPress={() => onChange(Math.min(max, value + 1))}
        style={styles.button}
        disabled={value >= max}
      >
        <Plus size={20} color={value >= max ? colors.textSecondary : colors.text} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
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
})
