import { useEffect, useMemo, useState } from "react"
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { WebView } from "react-native-webview"
import {
  buildChallengeAssistOpenUrl,
  parseChallengeAssistMessage,
} from "@/src/features/insta/insta-connect-types"
import { readAuthToken } from "@/src/lib/storage"
import { colors } from "@/src/theme/colors"
import { spacing } from "@/src/theme/spacing"

type ChallengeAssistModalProps = {
  visible: boolean
  challengeAssistUrl: string | null
  onClose: () => void
  onLoginSuccess: () => void
}

export function ChallengeAssistModal({
  visible,
  challengeAssistUrl,
  onClose,
  onLoginSuccess,
}: ChallengeAssistModalProps) {
  const insets = useSafeAreaInsets()
  const [embedSrc, setEmbedSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!visible || !challengeAssistUrl) {
      setEmbedSrc(null)
      return
    }
    let cancelled = false
    void readAuthToken().then((token) => {
      if (cancelled) return
      if (!token) {
        setEmbedSrc(null)
        return
      }
      setEmbedSrc(buildChallengeAssistOpenUrl(challengeAssistUrl, token))
    })
    return () => {
      cancelled = true
    }
  }, [visible, challengeAssistUrl])

  const headerPaddingTop = useMemo(() => Math.max(insets.top, spacing.sm), [insets.top])

  useEffect(() => {
    if (!visible || Platform.OS !== "web" || !embedSrc) return

    function handleMessage(event: MessageEvent) {
      if (parseChallengeAssistMessage(event.data)) {
        onLoginSuccess()
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [visible, embedSrc, onLoginSuccess])

  if (!visible) return null

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: headerPaddingTop }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Verificação reCAPTCHA</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fechar verificação"
            style={styles.closeButton}
          >
            <Text style={styles.closeButtonText}>Fechar</Text>
          </Pressable>
        </View>

        {embedSrc ? (
          Platform.OS === "web" ? (
            <View style={styles.webview}>
              {/* react-native-webview does not run on web; iframe matches the frontend embed. */}
              <iframe
                src={embedSrc}
                title="Verificação reCAPTCHA"
                style={webIframeStyle}
                allow="fullscreen"
              />
            </View>
          ) : (
            <WebView
              source={{ uri: embedSrc }}
              style={styles.webview}
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
              setSupportMultipleWindows={false}
              onMessage={(event) => {
                if (parseChallengeAssistMessage(event.nativeEvent.data)) {
                  onLoginSuccess()
                }
              }}
            />
          )
        ) : (
          <View style={styles.fallback}>
            <Text style={styles.fallbackText}>
              Não foi possível carregar a verificação. Faça login no app e tente novamente.
            </Text>
          </View>
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  closeButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primaryDark,
  },
  webview: {
    flex: 1,
    backgroundColor: "#000",
  },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  fallbackText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: "center",
  },
})

const webIframeStyle = {
  flex: 1,
  width: "100%",
  height: "100%",
  border: 0,
  backgroundColor: "#000",
} as const
