import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { supabase } from "./supabase";

// Expo Go (Android) дээр push мэдэгдэл дэмжигдэхгүй тул модулийг огт ачаалахгүй.
const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const canPush = Platform.OS !== "web" && !inExpoGo;

type NotifModule = typeof import("expo-notifications");
let N: NotifModule | null = null;
function notifications(): NotifModule | null {
  if (!canPush) return null;
  if (!N) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      N = require("expo-notifications") as NotifModule;
      N.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    } catch {
      N = null;
    }
  }
  return N;
}

/** Push токен авч Supabase-д хадгална. Боломжгүй орчинд чимээгүй алгасна — апп хэзээ ч унахгүй. */
export async function registerPush(userId: string) {
  const Notifications = notifications();
  if (!Notifications) return;
  try {
    const Device = await import("expo-device");
    if (!Device.isDevice) return;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Мэдэгдэл",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#F5B800",
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return;
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) return;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await supabase.from("push_tokens").upsert({ token, user_id: userId, platform: Platform.OS });
  } catch (e) {
    console.log("push register skipped", e);
  }
}
