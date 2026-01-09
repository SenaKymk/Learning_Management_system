import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const PUSH_ENABLED_KEY = "lms_push_enabled";
const PUSH_TOKEN_KEY = "lms_push_token";

export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false
    })
  });

  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT
    });
  }
}

export async function getPushSettings() {
  const enabled = (await AsyncStorage.getItem(PUSH_ENABLED_KEY)) === "true";
  const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  return { enabled, token };
}

export async function enablePushNotifications(): Promise<string> {
  if (!Device.isDevice) {
    throw new Error("Push notifications require a physical device.");
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    const request = await Notifications.requestPermissionsAsync();
    status = request.status;
  }

  if (status !== "granted") {
    throw new Error("Notification permission not granted.");
  }

  const projectId =
    (Constants?.expoConfig as { extra?: { eas?: { projectId?: string } } } | undefined)?.extra?.eas
      ?.projectId ?? undefined;

  const tokenResponse = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();
  const token = tokenResponse.data;

  await AsyncStorage.setItem(PUSH_ENABLED_KEY, "true");
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
  return token;
}

export async function disablePushNotifications() {
  await AsyncStorage.removeItem(PUSH_ENABLED_KEY);
  await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
}
