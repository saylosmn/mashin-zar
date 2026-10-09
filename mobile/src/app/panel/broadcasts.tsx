import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { useLiveSync } from "@/lib/live";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/theme";
import { errMsg, timeAgo } from "@/lib/format";
import { confirm, isAdmin, staffRpc } from "@/lib/staff";
import { Button, Field, Input, Skeleton, StateView, T, s } from "@/components/ui";

type Row = { id: string; title: string; body: string | null; created_at: string; recipients: number; read_count: number; author: string | null };

export default function Broadcasts() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data, error: e } = await supabase.rpc("broadcast_list");
      if (e) throw e;
      setRows((data ?? []) as Row[]);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useLiveSync(() => load(), ["broadcasts"]);

  if (!isAdmin(profile)) return <StateView icon="lock" title="Эрх хүрэхгүй" text="Зарлалыг зөвхөн админ удирдана."><Button title="Буцах" onPress={() => router.back()} /></StateView>;

  async function send() {
    if (!title.trim()) return Alert.alert("Гарчиг оруулна уу");
    if (!(await confirm("Бүх хэрэглэгчид илгээх үү?", `"${title.trim()}" мэдэгдэл бүх хэрэглэгчийн утсанд очно.`, "Илгээх"))) return;
    setSending(true);
    const r = await staffRpc<number>("broadcast", { p_title: title.trim(), p_body: body.trim() || null });
    setSending(false);
    if (r.ok) {
      setTitle("");
      setBody("");
      Alert.alert("Илгээгдлээ", `${r.data ?? 0} хэрэглэгчид мэдэгдэл очлоо.`);
      load();
    }
  }

  async function resend(b: Row) {
    if (!(await confirm("Дахин илгээх үү?", `"${b.title}" зарлал бүх хэрэглэгчид дахин очно.`, "Илгээх"))) return;
    setBusyId(b.id);
    const r = await staffRpc<number>("resend_broadcast", { p_id: b.id });
    setBusyId(null);
    if (r.ok) {
      Alert.alert("Илгээгдлээ", `${r.data ?? 0} хэрэглэгчид дахин очлоо.`);
      load();
    }
  }

  async function remove(b: Row) {
    if (!(await confirm("Зарлал устгах уу?", `"${b.title}" бүх хэрэглэгчийн мэдэгдлээс устна. Утсанд аль хэдийн ирсэн push мэдэгдлийг буцааж татах боломжгүй.`, "Устгах", true))) return;
    setBusyId(b.id);
    const r = await staffRpc("delete_broadcast", { p_id: b.id });
    setBusyId(null);
    if (r.ok) setRows((x) => x.filter((y) => y.id !== b.id));
  }

  const header = (
    <View style={{ gap: 14, paddingBottom: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable accessibilityLabel="Буцах" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line2, alignItems: "center", justifyContent: "center" }}>
          <Feather name="chevron-left" size={22} color={C.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <T w="display" style={{ fontSize: 20 }}>Мэдэгдэл</T>
          <T style={{ fontSize: 12, color: C.muted }}>Зарлал илгээх, устгах</T>
        </View>
      </View>

      <View style={s.section}>
        <T w="bold" style={s.h2}>Шинэ зарлал</T>
        <Field label="Гарчиг"><Input value={title} onChangeText={setTitle} placeholder="Апп шинэчлэгдлээ" maxLength={80} /></Field>
        <Field label="Дэлгэрэнгүй (заавал биш)"><Input multiline value={body} onChangeText={setBody} placeholder="Шинэ боломжууд..." maxLength={300} /></Field>
        <Button title="Бүгдэд илгээх" icon="send" variant="yellow" loading={sending} onPress={send} />
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <T w="bold" style={s.h2}>Илгээсэн зарлалууд</T>
        <T style={{ fontSize: 12, color: C.muted }}>{rows.length}</T>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.paper }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <FlatList
        data={loading ? [] : rows}
        keyExtractor={(b) => b.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 10, paddingBottom: 48 }}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={C.ink} />}
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: 10 }}>{[0, 1].map((i) => <Skeleton key={i} style={{ height: 120, borderRadius: 14 }} />)}</View>
          ) : error ? (
            <T style={{ color: C.danger, textAlign: "center", paddingVertical: 24 }}>{error}</T>
          ) : (
            <View style={{ alignItems: "center", gap: 8, paddingVertical: 30 }}>
              <Feather name="bell" size={30} color={C.pale} />
              <T style={{ color: C.muted }}>Одоогоор зарлал илгээгээгүй</T>
            </View>
          )
        }
        renderItem={({ item: b }) => {
          const pct = b.recipients ? Math.round((b.read_count / b.recipients) * 100) : 0;
          return (
            <View style={[s.card, { padding: 14, gap: 10 }]}>
              <View style={{ gap: 4 }}>
                <T w="bold" style={{ fontSize: 15 }}>{b.title}</T>
                {b.body ? <T style={{ fontSize: 14, color: C.body, lineHeight: 20 }}>{b.body}</T> : null}
                <T style={{ fontSize: 12, color: C.muted }}>{timeAgo(b.created_at)}{b.author ? ` · ${b.author}` : ""}</T>
              </View>
              <View style={{ gap: 5 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <T style={{ fontSize: 12, color: C.muted }}>{b.recipients} хүнд очсон</T>
                  <T style={{ fontSize: 12, color: C.muted }}>{b.read_count} уншсан · {pct}%</T>
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: C.soft, overflow: "hidden" }}>
                  <View style={{ width: `${pct}%`, height: "100%", backgroundColor: C.yellow }} />
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button small title="Дахин илгээх" icon="repeat" variant="ghost" style={{ flex: 1 }} disabled={busyId === b.id} onPress={() => resend(b)} />
                <Button small title="Устгах" icon="trash-2" variant="danger" style={{ flex: 1 }} loading={busyId === b.id} onPress={() => remove(b)} />
              </View>
            </View>
          );
        }}
      />
    </KeyboardAvoidingView>
  );
}
