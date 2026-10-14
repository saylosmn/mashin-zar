import { notifyRoute } from "./notify-route";
import { useEffect } from "react";
import { Platform } from "react-native";
import { router } from "expo-router";
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

export type PushStatus =
  | { ok: true; token: string }
  | { ok: false; reason: "unsupported" | "emulator" | "denied" | "no-project" | "token" | "save"; detail?: string };

let lastToken: string | null = null;

/** Push токен авч Supabase-д хадгална. Үр дүнг буцаана (апп хэзээ ч унахгүй). */
export async function registerPush(userId: string): Promise<PushStatus> {
  const Notifications = notifications();
  if (!Notifications) return { ok: false, reason: "unsupported" };
  try {
    const Device = await import("expo-device");
    if (!Device.isDevice) return { ok: false, reason: "emulator" };
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
    if (status !== "granted") return { ok: false, reason: "denied" };
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) return { ok: false, reason: "no-project" };
    let token: string;
    try {
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } catch (e) {
      return { ok: false, reason: "token", detail: e instanceof Error ? e.message : String(e) };
    }
    // Токеныг энэ хэрэглэгчид шилжүүлнэ (өмнө нь өөр аккаунтаар нэвтэрсэн байсан ч)
    let { error } = await supabase.rpc("save_push_token", { p_token: token, p_platform: Platform.OS });
    if (error && /save_push_token|PGRST202|function/i.test(error.message)) {
      ({ error } = await supabase.from("push_tokens").upsert({ token, user_id: userId, platform: Platform.OS }));
    }
    if (error) return { ok: false, reason: "save", detail: error.message };
    lastToken = token;
    return { ok: true, token };
  } catch (e) {
    console.log("push register skipped", e);
    return { ok: false, reason: "token", detail: e instanceof Error ? e.message : String(e) };
  }
}

/** Гарахаас өмнө дуудна: энэ утасны токеныг аккаунтаас салгана */
export async function unregisterPush() {
  if (!lastToken) return;
  const t = lastToken;
  lastToken = null;
  await supabase.rpc("remove_push_token", { p_token: t }).then(
    () => {},
    () => {},
  );
}

export const PUSH_REASON: Record<Exclude<PushStatus, { ok: true }>["reason"], string> = {
  unsupported: "Энэ орчинд (Expo Go эсвэл вэб) push ажиллахгүй. Сайтаас татсан APK-г суулгана уу.",
  emulator: "Эмулятор дээр push ажиллахгүй. Жинхэнэ утсан дээр туршина уу.",
  denied: "Мэдэгдлийн зөвшөөрөл хаалттай байна. Утасны Тохиргоо → Апп → Autoshop.mn → Мэдэгдэл хэсгийг асаана уу.",
  "no-project": "Апп-ын тохиргоонд EAS projectId алга (шинэ APK build хэрэгтэй).",
  token: "Push токен авч чадсангүй. Интернэт, Google Play үйлчилгээ асаалттай эсэхийг шалгана уу.",
  save: "Токеныг серверт хадгалж чадсангүй.",
};

type PushData = { adId?: string | null; type?: string };

function openFromPush(data: PushData | undefined) {
  if (!data) return;
  router.push(notifyRoute(data.type, data.adId) as never);
}

/** Push мэдэгдэл дээр дарахад холбогдох зар/хуудсыг нээнэ (апп хаалттай байсан ч). */
export function usePushRouting(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const Notifications = notifications();
    if (!Notifications) return;
    let handled: string | null = null;
    const clear = () => {
      try {
        if (typeof Notifications.clearLastNotificationResponse === "function")
          Notifications.clearLastNotificationResponse();
        else if (typeof Notifications.clearLastNotificationResponseAsync === "function")
          Notifications.clearLastNotificationResponseAsync().catch(() => {});
      } catch {
        // ignore
      }
    };
    const go = (r: { notification: { request: { identifier: string; content: { data?: unknown } } } } | null) => {
      if (!r || r.notification.request.identifier === handled) return;
      handled = r.notification.request.identifier;
      // Дахин нээхэд (жишээ нь апп дахин ачаалагдахад) ижил мэдэгдлийг дахин нээхгүйн тулд цэвэрлэнэ
      clear();
      setTimeout(() => openFromPush(r.notification.request.content.data as PushData), 300);
    };
    try {
      if (typeof Notifications.getLastNotificationResponse === "function")
        go(Notifications.getLastNotificationResponse());
      else
        Notifications.getLastNotificationResponseAsync()
          .then(go)
          .catch(() => {});
    } catch {
      // ignore
    }
    const sub = Notifications.addNotificationResponseReceivedListener(go);
    return () => sub.remove();
  }, [enabled]);
}
