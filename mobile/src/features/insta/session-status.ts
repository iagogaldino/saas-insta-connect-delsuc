import type { InstaSessionItem } from "@/src/features/insta/insta-connect-types"

export function sessionStatusLabel(session: InstaSessionItem): string {
  if (!session.instagramUsername) return "Não conectado"
  if (session.requiresRelogin) return "Reconectar"
  if (session.isRuntimeOn) return "Sessão ativa"
  return "Conectado"
}

export function sessionStatusVariant(session: InstaSessionItem): "success" | "warning" | "error" {
  if (!session.instagramUsername || session.requiresRelogin) return "warning"
  return "success"
}
