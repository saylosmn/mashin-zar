import { useCallback, useEffect, useState } from "react";
import { Alert, Dimensions, FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useLiveSync } from "@/lib/live";
import { C } from "@/lib/theme";
import { categoryLong, errMsg, money, timeAgo } from "@/lib/format";
import { staffAdCache } from "@/lib/cache";
import { isFeatured } from "@/lib/commission";
import { STAFF_AD_SELECT, confirm, digits, isAdmin, isStaff, openContract, staffRpc, type StaffAd } from "@/lib/staff";
import { Button, Field, Input, Photo, Skeleton, StateView, StatusBadge, T, s } from "@/components/ui";

const W = Dimensions.get("window").width;

export default function PanelAd() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, settings } = useAuth();
  const admin = isAdmin(profile);
  const [ad, setAd] = useState<StaffAd | null>(() => staffAdCache.get(id) ?? null);
  const [loading, setLoading] = useState(() => !staffAdCache.has(id));
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState(() => staffAdCache.get(id)?.manager_note ?? "");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data, error: e } = await supabase.from("ads").select(STAFF_AD_SELECT).eq("id", id).maybeSingle();
      if (e) throw e;
      const a = (data as StaffAd) ?? null;
      setAd(a);
      if (a) {
        setNote((n) => (n ? n : a.manager_note ?? ""));
      }
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useLiveSync((e) => { if (!e.id || e.id === id) load(); }, ["ads"]);

  async function act(key: string, fn: () => Promise<{ ok: boolean }>, okMsg?: string) {
    setBusy(key);
    const r = await fn();
    setBusy(null);
    if (r.ok) {
      await load();
      if (okMsg) Alert.alert("Амжилттай", okMsg);
    }
    return r.ok;
  }

  if (!isStaff(profile)) return <StateView icon="lock" title="Эрх хүрэхгүй" text="Энэ хэсэг зөвхөн менежер, админд нээлттэй."><Button title="Буцах" onPress={() => router.back()} /></StateView>;
  if (loading)
    return (
      <View style={{ flex: 1, backgroundColor: C.paper }}>
        <Skeleton style={{ height: 260, borderRadius: 0 }} />
        <View style={{ padding: 20, gap: 12 }}>
          <Skeleton style={{ width: "70%", height: 24 }} />
          <Skeleton style={{ width: "45%", height: 28 }} />
          <Skeleton style={{ height: 140, borderRadius: 12 }} />
        </View>
      </View>
    );
  if (error) return <StateView icon="warning" title="Алдаа гарлаа" text={error}><Button title="Дахин оролдох" icon="refresh-cw" onPress={() => { setLoading(true); load(); }} /><Button title="Буцах" variant="ghost" onPress={() => router.back()} /></StateView>;
  if (!ad) return <StateView icon="slash" title="Зар олдсонгүй" text="Энэ зар устгагдсан байж магадгүй."><Button title="Буцах" onPress={() => router.back()} /></StateView>;

  const cy = settings.cutoff_year;
  const pct = settings.offer_percent;
  const offerAmt = pct != null ? Math.round((ad.price * pct) / 100) : null;
  const call = (phone?: string | null) => phone && Linking.openURL(`tel:${digits(phone)}`).catch(() => {});

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.paper }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <View>
          {ad.photos.length ? (
            <FlatList
              data={ad.photos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(p) => p}
              onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / W))}
              renderItem={({ item }) => <Photo path={item} style={{ width: W, height: 260 }} />}
            />
          ) : (
            <Photo style={{ width: W, height: 200 }} />
          )}
          <Pressable accessibilityLabel="Буцах" onPress={() => router.back()} style={{ position: "absolute", left: 16, top: 16, width: 44, height: 44, borderRadius: 12, backgroundColor: C.card, alignItems: "center", justifyContent: "center" }}>
            <Feather name="chevron-left" size={22} color={C.ink} />
          </Pressable>
          {ad.photos.length > 0 && (
            <View style={{ position: "absolute", right: 16, bottom: 14, backgroundColor: C.ink, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
              <T w="mono" style={{ color: C.paper, fontSize: 12 }}>{idx + 1} / {ad.photos.length}</T>
            </View>
          )}
        </View>

        <View style={{ padding: 16, gap: 14 }}>
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <StatusBadge s={ad.status} />
              <T style={{ fontSize: 12, color: C.muted }}>{categoryLong(ad.category, cy)} · {timeAgo(ad.created_at)} · {ad.views} үзэлт</T>
            </View>
            <T w="bold" style={{ fontSize: 22, lineHeight: 28 }}>{ad.brand} {ad.model}{ad.trim ? ` · ${ad.trim}` : ""}</T>
            <T w="display" style={{ fontSize: 24 }}>{money(ad.price)}</T>
          </View>

          {/* Зар тавьсан хүн */}
          <View style={s.section}>
            <T w="bold" style={s.h2}>Зар тавьсан хүн</T>
            <Row k="Нэр" v={ad.owner?.full_name ?? "—"} />
            <Row k="И-мэйл" v={ad.owner?.email ?? "—"} />
            <Row k="Хот" v={ad.owner?.city ?? "—"} />
            <Row k="Профайлын утас" v={ad.owner?.phone ?? "—"} />
            <Row k="Зарын утас" v={ad.phone} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button small title="Залгах" icon="phone" variant="yellow" style={{ flex: 1 }} onPress={() => call(ad.phone)} />
              <Button small title="Мессеж" icon="message-square" variant="ghost" style={{ flex: 1 }} onPress={() => Linking.openURL(`sms:${digits(ad.phone)}`).catch(() => {})} />
            </View>
          </View>

          {/* Машины мэдээлэл */}
          <View style={s.section}>
            <T w="bold" style={s.h2}>Машин</T>
            <Row k="Улсын дугаар" v={ad.plate_number} mono />
            <Row k="Арлын дугаар (VIN)" v={ad.vin} mono />
            <Row k="Үйлдвэрлэсэн он" v={String(ad.year_made)} />
            <Row k="Орж ирсэн он" v={ad.year_imported ? String(ad.year_imported) : "—"} />
            <Row k="Сер" v={ad.trim || "—"} />
            {ad.contract_id ? (
              <Button small title="Гарын үсэгтэй гэрээ (PDF)" icon="file-text" variant="ghost" onPress={() => openContract(ad.contract_id!)} />
            ) : (
              <T style={{ fontSize: 12, color: C.muted }}>Гэрээгүй (гэрээ нэвтрэхээс өмнөх зар)</T>
            )}
            {ad.options?.length ? (
              <View style={{ gap: 6 }}>
                <T style={{ fontSize: 13, color: C.muted }}>Опшн</T>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {ad.options.map((o) => (
                    <View key={o} style={{ backgroundColor: C.soft, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                      <T style={{ fontSize: 12 }}>{o}</T>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            {ad.modifications ? <Block k="Өөрчлөлт" v={ad.modifications} /> : null}
            {ad.description ? <Block k="Тайлбар" v={ad.description} /> : null}
          </View>

          {/* Санал */}
          {ad.status !== "sold" && (
            <View style={s.section}>
              <T w="bold" style={s.h2}>Санал илгээх</T>
              {ad.offer_amount != null ? (
                <View style={{ backgroundColor: C.pendingBg, borderRadius: 10, padding: 12 }}>
                  <T w="semibold" style={{ color: C.pendingFg }}>
                    Илгээсэн: {money(ad.offer_amount)} ({ad.offer_percent}%) · {ad.offer_sent_at ? timeAgo(ad.offer_sent_at) : ""}
                  </T>
                </View>
              ) : null}
              {pct == null ? (
                <T style={{ color: C.muted, fontSize: 14, lineHeight: 20 }}>
                  Админ санал тооцох хувийг тохируулаагүй байна.{admin ? " Тохиргоо хэсэгт хувиа оруулна уу." : ""}
                </T>
              ) : (
                <>
                  <T style={{ fontSize: 14, color: C.body }}>{money(ad.price)} × {pct}% = <T w="bold">{money(offerAmt)}</T></T>
                  <Button
                    title={ad.offer_amount != null ? "Дахин санал илгээх" : `Санал илгээх · ${money(offerAmt)}`}
                    icon="send"
                    variant="yellow"
                    loading={busy === "offer"}
                    onPress={async () => {
                      if (!(await confirm("Санал илгээх үү?", `${money(offerAmt)} (${pct}%) санал хэрэглэгчид мэдэгдлээр очно.`, "Илгээх"))) return;
                      act("offer", () => staffRpc("send_offer", { p_ad: ad.id }), "Санал хэрэглэгчид илгээгдлээ");
                    }}
                  />
                </>
              )}
            </View>
          )}

          {/* Тэмдэглэл */}
          <View style={s.section}>
            <T w="bold" style={s.h2}>Менежерийн тэмдэглэл</T>
            {ad.contacted_at ? <T style={{ fontSize: 13, color: C.activeFg }}>✓ Холбогдсон · {timeAgo(ad.contacted_at)}</T> : null}
            <Input multiline value={note} onChangeText={setNote} placeholder="Ярилцсан зүйл, дараагийн алхам..." />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button small title="Хадгалах" icon="save" variant="ghost" style={{ flex: 1 }} loading={busy === "note"} onPress={() => act("note", () => staffRpc("save_note", { p_ad: ad.id, p_note: note }), "Тэмдэглэл хадгалагдлаа")} />
              {!ad.contacted_at && ad.status !== "sold" && (
                <Button small title="Холбогдсон" icon="check" style={{ flex: 1 }} loading={busy === "contact"} onPress={() => act("contact", () => staffRpc("mark_contacted", { p_ad: ad.id, p_note: note || null }))} />
              )}
            </View>
          </View>

          {/* Үйлдлүүд */}
          <View style={s.section}>
            <T w="bold" style={s.h2}>Шийдвэр</T>

            {(ad.status === "pending" || ad.status === "rejected") && (
              <Button
                title="Батлах — бүгдэд харуулах"
                icon="check-circle"
                variant="yellow"
                loading={busy === "approve"}
                onPress={() => act("approve", () => staffRpc("approve_ad", { p_ad: ad.id }), "Зар батлагдаж, хэрэглэгчдэд мэдэгдэл явлаа")}
              />
            )}

            {ad.status !== "rejected" && ad.status !== "sold" && (
              rejecting ? (
                <View style={{ gap: 8 }}>
                  <Field label="Татгалзах шалтгаан (хэрэглэгчид харагдана)">
                    <Input value={reason} onChangeText={setReason} placeholder="Жишээ: Зураг тодорхой биш" />
                  </Field>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Button small title="Болих" variant="ghost" style={{ flex: 1 }} onPress={() => setRejecting(false)} />
                    <Button small title="Татгалзах" variant="danger" icon="x-circle" style={{ flex: 1 }} loading={busy === "reject"} onPress={async () => {
                      const ok = await act("reject", () => staffRpc("reject_ad", { p_ad: ad.id, p_note: reason.trim() || null }), "Зар татгалзагдлаа");
                      if (ok) setRejecting(false);
                    }} />
                  </View>
                </View>
              ) : (
                <Button title="Татгалзах" icon="x-circle" variant="danger" onPress={() => setRejecting(true)} />
              )
            )}

            {ad.status === "active" && (
              <Button title="Зарагдсан тайлан илгээх" icon="file-text" onPress={() => router.push({ pathname: "/panel/reports", params: { ad: ad.id } })} />
            )}

            {admin && ad.status === "active" && (
              <View style={{ gap: 6 }}>
                {ad.featured_requested_at ? <T w="semibold" style={{ fontSize: 13, color: C.pendingFg }}>⭐ Эзэн нь онцлох болгох хүсэлт илгээсэн</T> : null}
                {isFeatured(ad.featured_until) ? (
                  <Button title="Онцлохыг болиулах" icon="star" variant="ghost" loading={busy === "feat"} onPress={() => act("feat", () => staffRpc("set_featured", { p_ad: ad.id, p_days: 0 }), "Онцлох байдал цуцлагдлаа")} />
                ) : (
                  <Button title={`⭐ ${settings.featured_days ?? 7} хоног онцлох`} variant="yellow" loading={busy === "feat"} onPress={() => act("feat", () => staffRpc("set_featured", { p_ad: ad.id, p_days: settings.featured_days ?? 7 }), "Зар онцлох боллоо")} />
                )}
              </View>
            )}

            {ad.status === "sold" && (
              <T style={{ color: C.body }}>Зарагдсан: {money(ad.sold_price ?? ad.price)} · {ad.sold_at ? timeAgo(ad.sold_at) : ""}</T>
            )}

            <Button title="Хэрэглэгчийн харагдах байдлаар" icon="eye" variant="ghost" onPress={() => router.push(`/ads/${ad.id}`)} />

            {admin && (
              <Button
                title="Зарыг устгах"
                icon="trash-2"
                variant="danger"
                loading={busy === "delete"}
                onPress={async () => {
                  if (!(await confirm("Зар устгах уу?", `${ad.brand} ${ad.model} зарыг бүр мөсөн устгана.`, "Устгах", true))) return;
                  setBusy("delete");
                  const { error: e } = await supabase.from("ads").delete().eq("id", ad.id);
                  if (!e && ad.photos.length) await supabase.storage.from("ad-photos").remove(ad.photos);
                  setBusy(null);
                  if (e) return Alert.alert("Устгаж чадсангүй", errMsg(e));
                  router.back();
                }}
              />
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <T style={{ fontSize: 14, color: C.muted }}>{k}</T>
      <T w={mono ? "monoBold" : "semibold"} style={{ fontSize: 14, flexShrink: 1, textAlign: "right" }} selectable>{v}</T>
    </View>
  );
}

function Block({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ gap: 4 }}>
      <T style={{ fontSize: 13, color: C.muted }}>{k}</T>
      <T style={{ fontSize: 14, lineHeight: 21, color: C.body }} selectable>{v}</T>
    </View>
  );
}
