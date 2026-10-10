import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { errMsg } from "@/lib/format";
import { C } from "@/lib/theme";
import { Button, Input, T } from "./ui";

export const FLAG_REASONS: { key: string; label: string }[] = [
  { key: "fake", label: "Хуурамч зар" },
  { key: "sold", label: "Аль хэдийн зарагдсан" },
  { key: "wrong_price", label: "Үнэ буруу" },
  { key: "wrong_info", label: "Мэдээлэл, зураг буруу" },
  { key: "scam", label: "Залилан, сэжигтэй" },
  { key: "other", label: "Бусад" },
];

/** Зарыг мэдээлэх доод цонх */
export function ReportAdSheet({ adId, visible, onClose }: { adId: string; visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const close = () => {
    if (busy) return;
    onClose();
    setTimeout(() => { setReason(""); setNote(""); setErr(null); setDone(false); }, 300);
  };

  async function send() {
    if (!reason) return setErr("Шалтгаанаа сонгоно уу");
    setBusy(true);
    setErr(null);
    const { error } = await supabase.rpc("report_ad", { p_ad: adId, p_reason: reason, p_note: note.trim().slice(0, 500) || null });
    setBusy(false);
    if (error) setErr(errMsg(error));
    else setDone(true);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable onPress={close} style={{ flex: 1, backgroundColor: "rgba(17,19,23,.55)" }} />
        <View style={{ backgroundColor: C.paper, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85%", paddingBottom: Math.max(insets.bottom, 16) }}>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <T w="bold" style={{ fontSize: 18 }}>Зарыг мэдээлэх</T>
              <Pressable accessibilityLabel="Хаах" onPress={close} hitSlop={12}><Feather name="x" size={22} color={C.ink} /></Pressable>
            </View>
            {done ? (
              <>
                <T style={{ fontSize: 15, lineHeight: 22 }}>✓ Баярлалаа. Менежер шалгаж, шаардлагатай бол арга хэмжээ авна.</T>
                <Button title="Хаах" onPress={close} />
              </>
            ) : (
              <>
                {FLAG_REASONS.map((r) => {
                  const on = reason === r.key;
                  return (
                    <Pressable
                      key={r.key}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      onPress={() => setReason(r.key)}
                      style={{ height: 48, borderRadius: 12, borderWidth: on ? 2 : 1, borderColor: on ? C.ink : C.line2, backgroundColor: C.card, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14 }}
                    >
                      <Feather name={on ? "check-circle" : "circle"} size={18} color={on ? C.ink : C.muted} />
                      <T w={on ? "semibold" : "body"} style={{ fontSize: 15 }}>{r.label}</T>
                    </Pressable>
                  );
                })}
                <Input multiline value={note} onChangeText={setNote} maxLength={500} placeholder={reason === "other" ? "Шалтгаанаа бичнэ үү" : "Нэмэлт тайлбар (заавал биш)"} />
                {err ? <T style={{ color: C.danger, fontSize: 13 }}>{err}</T> : null}
                <Button title="Илгээх" loading={busy} onPress={send} />
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
