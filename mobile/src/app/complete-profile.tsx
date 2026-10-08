import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { C } from "@/lib/theme";
import { CITIES } from "@/lib/cars";
import { errMsg, initial } from "@/lib/format";
import { Button, Field, Input, T } from "@/components/ui";

export default function CompleteProfile() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { profile, refreshProfile, session } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [city, setCity] = useState(profile?.city ?? "Улаанбаатар");
  const [consent, setConsent] = useState(!!profile?.profile_completed);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const creating = !profile?.profile_completed;

  async function save() {
    const ph = phone.replace(/[^\d+]/g, "");
    if (!name.trim() || ph.length < 8) return setErr("Нэр, утасны дугаараа (8+ орон) бөглөнө үү.");
    if (!consent) return setErr("Менежер холбогдохыг зөвшөөрнө үү.");
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from("profiles").update({ full_name: name.trim(), phone: ph, city, profile_completed: true }).eq("id", session?.user.id ?? "");
    setBusy(false);
    if (error) return setErr(errMsg(error));
    await refreshProfile();
    if (next === "post") router.replace("/post");
    else router.back();
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: C.paper }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable accessibilityLabel="Буцах" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line2, alignItems: "center", justifyContent: "center" }}>
            <Feather name="chevron-left" size={22} color={C.ink} />
          </Pressable>
          {next === "post" && <T style={{ fontSize: 13, color: C.muted }}>Алхам 1 / 2 · Профайл</T>}
        </View>
        <View style={{ gap: 8 }}>
          <T w="display" style={{ fontSize: 23, lineHeight: 29 }}>{creating ? "Зар тавихын өмнө профайлаа үүсгэнэ үү" : "Профайл засах"}</T>
          <T style={{ fontSize: 14, color: C.muted, lineHeight: 21 }}>Менежер тантай энэ мэдээллээр холбогдоно. Нэг удаа бөглөхөд хангалттай.</T>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
            <T w="bold" style={{ color: C.yellow, fontSize: 18 }}>{initial(profile?.full_name ?? profile?.email)}</T>
          </View>
          <View style={{ flex: 1 }}>
            <T w="semibold">Google аккаунт</T>
            <T style={{ fontSize: 13, color: C.muted }} numberOfLines={1}>{profile?.email}</T>
          </View>
          <Feather name="check" size={20} color="#1E4FD6" />
        </View>
        <Field label="Овог нэр"><Input value={name} onChangeText={setName} autoComplete="name" /></Field>
        <Field label="Утасны дугаар"><Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" mono strong placeholder="9911 2233" /></Field>
        <Field label="Хот / аймаг">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {CITIES.map((c) => (
              <Pressable key={c} onPress={() => setCity(c)} accessibilityRole="radio" accessibilityState={{ selected: city === c }} style={{ height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: city === c ? C.ink : C.line2, backgroundColor: city === c ? C.ink : C.card, justifyContent: "center" }}>
                <T style={{ fontSize: 13, color: city === c ? C.paper : C.ink }}>{c}</T>
              </Pressable>
            ))}
          </View>
        </Field>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }} onPress={() => setConsent((v) => !v)} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
          <View style={{ width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: C.ink, backgroundColor: consent ? C.ink : C.card, alignItems: "center", justifyContent: "center" }}>
            {consent && <Feather name="check" size={14} color={C.yellow} />}
          </View>
          <T style={{ flex: 1, fontSize: 13, lineHeight: 20, color: "#2B2F35" }}>Менежер миний утсаар холбогдохыг зөвшөөрч байна</T>
        </Pressable>
        {err && <View accessibilityRole="alert" style={{ backgroundColor: C.dangerBg, borderRadius: 12, padding: 12 }}><T style={{ color: "#9B1C1C", fontSize: 14 }}>{err}</T></View>}
        <Button title={next === "post" ? "Профайл үүсгээд зар нэмэх" : "Хадгалах"} loading={busy} onPress={save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
