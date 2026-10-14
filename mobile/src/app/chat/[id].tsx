import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { C, F } from "@/lib/theme";
import { errMsg, money } from "@/lib/format";
import { dayLabel, timeHM } from "@shared/chat";
import { useLiveSync } from "@/lib/live";
import { BackButton, Button, Photo, Skeleton, StateView, T } from "@/components/ui";
import type { ChatInfo, Message } from "@shared/types";

const QUICK = ["Сайн байна уу, машин зарагдаагүй байна уу?", "Хэзээ, хаана үзэж болох вэ?", "Үнэ тохирох уу?"];
type AdHead = {
  id: string;
  brand: string;
  model: string;
  year_made: number;
  price: number;
  photos: string[];
  seller_name: string;
  seller_shop?: string | null;
};

/**
 * Чат. id="new" бол ?ad=<зар>-аар шинэ чат эхэлнэ (байгаа бол түүн рүү шилжинэ).
 */
export default function ChatScreen() {
  const params = useLocalSearchParams<{ id: string; ad?: string }>();
  const { session } = useAuth();
  const uid = session?.user.id;
  const insets = useSafeAreaInsets();
  const [convId, setConvId] = useState<string | null>(params.id === "new" ? null : params.id);
  const [info, setInfo] = useState<ChatInfo | null>(null);
  const [adHead, setAdHead] = useState<AdHead | null>(null);
  const [msgs, setMsgs] = useState<Message[] | null>(null);
  const [text, setText] = useState(params.id === "new" ? QUICK[0] : "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = useRef<FlatList<Message>>(null);

  // Шинэ чат: аль хэдийн байгаа эсэхийг шалгах, зарын мэдээлэл
  useEffect(() => {
    if (convId || !params.ad || !uid) return;
    (async () => {
      const { data: ex } = await supabase
        .from("conversations")
        .select("id")
        .eq("ad_id", params.ad!)
        .eq("buyer_id", uid)
        .maybeSingle();
      if (ex) {
        setText("");
        return setConvId(ex.id);
      }
      const { data } = await supabase
        .from("public_ads")
        .select("id,brand,model,year_made,price,photos,seller_name,seller_shop")
        .eq("id", params.ad!)
        .maybeSingle();
      if (!data) setError("Зар олдсонгүй эсвэл идэвхгүй болсон");
      else setAdHead(data as AdHead);
      setMsgs([]);
    })();
  }, [convId, params.ad, uid]);

  const load = useCallback(async () => {
    if (!convId) return;
    const [{ data: inf, error: e1 }, { data: m, error: e2 }] = await Promise.all([
      supabase.rpc("chat_info", { p_conv: convId }),
      supabase.from("messages").select("*").eq("conversation_id", convId).order("id", { ascending: false }).limit(300),
    ]);
    if (e1 || e2) return setError(errMsg(e1 ?? e2));
    const row = (Array.isArray(inf) ? inf[0] : null) as ChatInfo | null;
    if (!row) return setError("Чат олдсонгүй");
    setInfo(row);
    setMsgs(((m ?? []) as Message[]).reverse());
    if (row.role !== "staff")
      supabase.rpc("mark_chat_read", { p_conv: convId }).then(
        () => {},
        () => {},
      );
  }, [convId]);
  useEffect(() => {
    load();
  }, [load]);
  useLiveSync(
    (e) => {
      if (!e.id || e.id === convId) load();
    },
    ["messages"],
  );

  useEffect(() => {
    if (msgs?.length) setTimeout(() => list.current?.scrollToEnd({ animated: false }), 50);
  }, [msgs?.length]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    if (!convId) {
      const { data, error: e } = await supabase.rpc("start_chat", { p_ad: params.ad, p_body: body });
      setSending(false);
      if (e) return setError(errMsg(e));
      setText("");
      router.setParams({ id: String(data) });
      return setConvId(String(data));
    }
    const temp: Message = {
      id: -Date.now(),
      conversation_id: convId,
      sender_id: uid ?? null,
      body,
      created_at: new Date().toISOString(),
    };
    setMsgs((x) => [...(x ?? []), temp]);
    setText("");
    const { error: e } = await supabase.rpc("send_message", { p_conv: convId, p_body: body });
    setSending(false);
    if (e) {
      setError(errMsg(e));
      setText(body);
      setMsgs((x) => (x ?? []).filter((y) => y.id !== temp.id));
    } else load();
  }

  const title = info?.other_name ?? (adHead ? (adHead.seller_shop ?? adHead.seller_name) : "Чат");
  const sub = info
    ? `${info.car}${info.price ? ` · ${money(info.price)}` : ""}`
    : adHead
      ? `${adHead.brand} ${adHead.model} · ${adHead.year_made} · ${money(adHead.price)}`
      : "";
  const photo = info?.photo ?? adHead?.photos?.[0];
  const adId = info?.ad_id ?? adHead?.id;
  const canWrite = !info || info.role !== "staff";

  if (error && !msgs)
    return (
      <StateView icon="warning" title="Алдаа гарлаа" text={error}>
        <Button title="Буцах" onPress={() => router.back()} />
      </StateView>
    );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: C.paper }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderColor: C.line,
          backgroundColor: C.card,
        }}
      >
        <BackButton plain style={{ width: 40, height: 40 }} />
        <Pressable
          disabled={!adId}
          onPress={() => adId && router.push(`/ads/${adId}`)}
          style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}
        >
          <Photo path={photo} style={{ width: 44, height: 36, borderRadius: 6 }} />
          <View style={{ flex: 1 }}>
            <T w="bold" style={{ fontSize: 15 }} numberOfLines={1}>
              {title}
            </T>
            <T style={{ fontSize: 12, color: C.muted }} numberOfLines={1}>
              {sub}
            </T>
          </View>
        </Pressable>
      </View>

      {!msgs ? (
        <View style={{ padding: 16, gap: 10 }}>
          <Skeleton style={{ height: 40, width: "60%" }} />
          <Skeleton style={{ height: 40, width: "50%", alignSelf: "flex-end" }} />
        </View>
      ) : (
        <FlatList
          ref={list}
          data={msgs}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ padding: 12, gap: 6, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 8, padding: 24 }}>
              <T style={{ color: C.muted, textAlign: "center" }}>Худалдагчид анхны мессежээ бичээрэй.</T>
              <T style={{ color: C.muted, fontSize: 12, textAlign: "center" }}>
                Урьдчилгаа мөнгө машинаа үзэхээс өмнө бүү шилжүүл.
              </T>
            </View>
          }
          renderItem={({ item: m, index }) => {
            const mine = m.sender_id === uid;
            const day = dayLabel(m.created_at);
            const showDay = index === 0 || day !== dayLabel(msgs[index - 1].created_at);
            return (
              <View>
                {showDay ? (
                  <View
                    style={{
                      alignSelf: "center",
                      backgroundColor: C.soft,
                      borderRadius: 10,
                      paddingHorizontal: 10,
                      paddingVertical: 2,
                      marginVertical: 6,
                    }}
                  >
                    <T style={{ fontSize: 11, color: C.muted }}>{day}</T>
                  </View>
                ) : null}
                <View
                  style={{
                    maxWidth: "80%",
                    alignSelf: mine ? "flex-end" : "flex-start",
                    backgroundColor: mine ? C.ink : C.card,
                    borderWidth: mine ? 0 : 1,
                    borderColor: C.line,
                    borderRadius: 16,
                    borderBottomRightRadius: mine ? 4 : 16,
                    borderBottomLeftRadius: mine ? 16 : 4,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    opacity: m.id < 0 ? 0.6 : 1,
                  }}
                >
                  <T style={{ fontSize: 15, lineHeight: 21, color: mine ? C.paper : C.ink }}>{m.body}</T>
                  <T style={{ fontSize: 10, color: mine ? C.pale : C.muted, alignSelf: "flex-end", marginTop: 2 }}>
                    {timeHM(m.created_at)}
                  </T>
                </View>
              </View>
            );
          }}
        />
      )}

      {canWrite ? (
        <View
          style={{
            borderTopWidth: 1,
            borderColor: C.line,
            backgroundColor: C.card,
            paddingHorizontal: 12,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 10),
            gap: 8,
          }}
        >
          {!convId && msgs?.length === 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {QUICK.map((q) => (
                <Pressable
                  key={q}
                  onPress={() => setText(q)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: text === q ? C.ink : C.line2,
                  }}
                >
                  <T style={{ fontSize: 12 }}>{q}</T>
                </Pressable>
              ))}
            </View>
          ) : null}
          {error ? <T style={{ color: C.danger, fontSize: 13 }}>{error}</T> : null}
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Мессеж бичих…"
              placeholderTextColor="#9AA0A9"
              multiline
              maxLength={1000}
              style={{
                flex: 1,
                minHeight: 44,
                maxHeight: 120,
                borderWidth: 1,
                borderColor: C.line2,
                borderRadius: 14,
                paddingHorizontal: 12,
                paddingTop: 11,
                paddingBottom: 11,
                fontFamily: F.body,
                fontSize: 15,
                color: C.ink,
                backgroundColor: C.paper,
              }}
            />
            <Pressable
              accessibilityLabel="Илгээх"
              disabled={!text.trim() || sending}
              onPress={send}
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: C.yellow,
                alignItems: "center",
                justifyContent: "center",
                opacity: !text.trim() || sending ? 0.5 : 1,
              }}
            >
              <Feather name="send" size={20} color={C.ink} />
            </Pressable>
          </View>
        </View>
      ) : (
        <T style={{ padding: 12, paddingBottom: Math.max(insets.bottom, 12), fontSize: 13, color: C.muted }}>
          Та энэ чатыг админы эрхээр харж байна.
        </T>
      )}
    </KeyboardAvoidingView>
  );
}
