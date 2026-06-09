import { useState } from "react"
import { Image, StyleSheet, Text, View } from "react-native"
import { colors } from "@/src/theme/colors"

type AvatarProps = {
  uri?: string | null
  username: string
  size?: number
}

export function Avatar({ uri, username, size = 48 }: AvatarProps) {
  const [failed, setFailed] = useState(false)
  const initials = username.replace(/^@+/, "").slice(0, 2).toUpperCase()

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    )
  }

  return (
    <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.initials, { fontSize: size * 0.3 }]}>{initials}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: colors.slate200,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontWeight: "700",
    color: colors.slate700,
  },
})
