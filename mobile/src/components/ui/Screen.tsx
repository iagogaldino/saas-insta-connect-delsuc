import { type ReactNode } from "react"
import { ScrollView, StyleSheet, View, type ViewStyle } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { colors } from "@/src/theme/colors"
import { spacing } from "@/src/theme/spacing"

type ScreenProps = {
  children: ReactNode
  scroll?: boolean
  style?: ViewStyle
}

export function Screen({ children, scroll = true, style }: ScreenProps) {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, style]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, style]}>{children}</View>
  )

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {content}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
})
