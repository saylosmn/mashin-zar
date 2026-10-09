import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { C } from "@/lib/theme";
import { digits, isAdmin, openWebPanel, staffRpc } from "@/lib/staff";
import { Button, Field, Input, StateView, T, s } from "@/components/ui";

export default function PanelSettings() {
  const { profile, settings, refreshProfile } = useAuth();
  const [pct, setPct] = useState("");
  const [cutoff, setCutoff] = useState("");
  const [minP, setMinP] = useState("");
  const [maxP, setMaxP] = useState("");
  const [days, setDays] = useState("");
  const [notifyAll, setNotifyAll] = useState(true);
  const [notifyStaff, setNotifyStaff] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPct(settings.offer_percent != null ? String(settings.offer_percent) : "");
    setCutoff(String(settings.cutoff_year));
    setMinP(String(settings.min_photos));
    setMaxP(String(settings.max_photos));
    setDays(String(settings.ad_days));
    setNotifyAll(settings.notify_all_on_approve);
    setNotifyStaff(settings.notify_staff_on_new);
  }, [settings]);

  if (!isAdmin(profile)) return <StateView icon="lock" title="Эрх хүрэхгүй" text="Тохиргоог зөвхөн админ өөрчилнө."><Button title="Буцах" onPress={() => router.back()} /></StateView>;

  async function save() {
    const p = pct.replace(",", ".").trim();
    if (p && (isNaN(Number(p)) || Number(p) <= 0 || Number(p) > 100)) return Alert.alert("Хувь буруу", "0-ээс 100-ийн хооронд тоо оруулна уу.");
    setSaving(true);
    const r = await staffRpc("update_settings", {
      p_offer_percent: p ? Number(p) : null,
      p_cutoff_year: Number(cutoff) || 2016,
      p_max_photos: Number(maxP) || 16,
      p_min_photos: Number(minP) || 3,
      p_ad_days: Number(days) || 60,
      p_notify_all: notifyAll,
      p_notify_staff: notifyStaff,
    });
    setSaving(false);
    if (r.ok) {
      await refreshProfile();
      Alert.alert("Хадгалагдлаа", "Тохиргоо бүх хэрэглэгчид шууд үйлчилнэ.");
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.paper }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable accessibilityLabel="Буцах" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line2, alignItems: "center", justifyContent: "center" }}>
            <Feather name="chevron-left" size={22} color={C.ink} />
          </Pressable>
          <T w="display" style={{ fontSize: 20 }}>Тохиргоо</T>
        </View>

        <View style={s.section}>
          <T w="bold" style={s.h2}>Санал</T>
          <Field label="Санал тооцох хувь (%)" hint="Санал = зарын үнэ × энэ хувь. Хоосон бол менежер санал илгээж чадахгүй.">
            <Input keyboardType="decimal-pad" value={pct} onChangeText={(t) => setPct(t.replace(/[^0-9.,]/g, ""))} placeholder="жишээ нь 85" />
          </Field>
        </View>

        <View style={s.section}>
          <T w="bold" style={s.h2}>Зар</T>
          <Field label="Ангилах он" hint={`${cutoff || 2016} ба хойш / ${cutoff || 2016}-аас өмнө`}>
            <Input keyboardType="number-pad" value={cutoff} onChangeText={(t) => setCutoff(digits(t).slice(0, 4))} />
          </Field>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Хамгийн бага зураг"><Input keyboardType="number-pad" value={minP} onChangeText={(t) => setMinP(digits(t))} /></Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Хамгийн их зураг"><Input keyboardType="number-pad" value={maxP} onChangeText={(t) => setMaxP(digits(t))} /></Field>
            </View>
          </View>
          <Field label="Зарын хугацаа (өдөр)"><Input keyboardType="number-pad" value={days} onChangeText={(t) => setDays(digits(t))} /></Field>
        </View>

        <View style={s.section}>
          <T w="bold" style={s.h2}>Мэдэгдэл</T>
          <Toggle label="Зар батлагдахад бүх хэрэглэгчид мэдэгдэх" value={notifyAll} onChange={setNotifyAll} />
          <Toggle label="Шинэ зар ирэхэд менежерүүдэд мэдэгдэх" value={notifyStaff} onChange={setNotifyStaff} />
        </View>

        <Button title="Хадгалах" icon="save" variant="yellow" loading={saving} onPress={save} />

        <Button title="Зарлал, мэдэгдэл удирдах" icon="bell" variant="ghost" onPress={() => router.push("/panel/broadcasts")} />

        <Button title="Вэб админ панел нээх" icon="external-link" variant="ghost" onPress={() => openWebPanel("/admin")} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <T style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>{label}</T>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: C.yellow, false: C.line2 }} thumbColor={value ? C.ink : "#FFFFFF"} />
    </View>
  );
}
