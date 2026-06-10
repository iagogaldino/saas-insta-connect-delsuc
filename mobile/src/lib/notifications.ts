import Constants from "expo-constants"
import { Platform } from "react-native"

const AUTO_FOLLOW_CHANNEL_ID = "auto-follow"

type NotificationsModule = typeof import("expo-notifications")

let notificationsModule: NotificationsModule | null = null
let handlerConfigured = false

function isExpoGoOnAndroid(): boolean {
  return Platform.OS === "android" && Constants.expoGoConfig != null
}

function canUseNativeNotifications(): boolean {
  if (Platform.OS === "web") return false
  if (isExpoGoOnAndroid()) return false
  return true
}

function buildAutoFollowMessage(params: {
  followed: number
  requested: number
  targetUsername?: string
}): string {
  const { followed, requested, targetUsername } = params
  return targetUsername
    ? `Seguiu ${followed} de ${requested} seguidores de @${targetUsername}.`
    : `Seguiu ${followed} de ${requested} perfis sugeridos.`
}

async function loadNotificationsModule(): Promise<NotificationsModule | null> {
  if (!canUseNativeNotifications()) return null
  if (!notificationsModule) {
    notificationsModule = await import("expo-notifications")
  }
  return notificationsModule
}

async function configureNotificationHandler() {
  if (!canUseNativeNotifications() || handlerConfigured) return

  try {
    const Notifications = await loadNotificationsModule()
    if (!Notifications) return

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    })
    handlerConfigured = true
  } catch {
    // Expo Go ou ambiente sem suporte a push nativo.
  }
}

export async function notifyAutoFollowComplete(params: {
  followed: number
  requested: number
  targetUsername?: string
}): Promise<void> {
  if (!canUseNativeNotifications()) {
    return
  }

  try {
    await configureNotificationHandler()
    const Notifications = await loadNotificationsModule()
    if (!Notifications) {
      return
    }

    const { status: existing } = await Notifications.getPermissionsAsync()
    const { status } =
      existing === "granted"
        ? { status: existing }
        : await Notifications.requestPermissionsAsync()

    if (status !== "granted") {
      return
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(AUTO_FOLLOW_CHANNEL_ID, {
        name: "AutoFollow",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: "default",
      })
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "AutoFollow concluído",
        body: buildAutoFollowMessage(params),
        sound: true,
        data: { type: "auto-follow-complete" },
        ...(Platform.OS === "android" ? { channelId: AUTO_FOLLOW_CHANNEL_ID } : {}),
      },
      trigger: null,
    })
  } catch {
    // Sem notificação nativa disponível — a tela de resultados já exibe o resumo.
  }
}
