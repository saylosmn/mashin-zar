import { useCallback, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useLiveSync } from "@/lib/live";
import { C } from "@/lib/theme";
import { errMsg, money } from "@/lib/format";
import { staffRpc } from "@/lib/staff";
import { expiryInfo, isFeatured } from "@shared/commission";
import { PAY_STATUS } from "@/lib/payments";
import { BackButton, Button, Field, Input, Photo, Skeleton, StateView, T, s } from "@/components/ui";
import type { Ad, Payment } from "@shared/types";

/** Онцлох зарын төлбөр: дансны мэдээлэл, гүйлгээний утга, «Төлбөр төлсөн» (орлогыг SMS апп автоматаар батална) */
export default function PayScreen() {
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  const { session, settings } = useAuth();
  const uid = session?.user.id;
  const [ad, setAd] = useState<Ad | null>(null);
  const [pays, setPays] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!uid || !id) return;
    try {
      setError(null);
      const [a, p] = await Promise.all([
        supabase.from("ads").select("*").eq("id", id).eq("user_id", uid).maybeSingle(),
        supabase
          .from("payments")
          .select("*")
          .eq("ad_id", id)
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      if (a.error) throw a.error;
      if (p.error) throw p.error;
      setAd((a.data as Ad | null) ?? null);
      setPays((p.data ?? []) as Payment[]);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [uid, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  // Төлбөр батлагдахад шууд шинэчлэгдэнэ
  useLiveSync(() => load(), ["payments", "ads"]);

  const back = <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace("/my"))} />;

  if (error)
    return (
      <StateView icon="warning" title="Алдаа гарлаа" text={error}>
        <Button title="Дахин оролдох" onPress={load} />
      </StateView>
    );
  if (loading)
    return (
      <View style={{ flex: 1, padding: 16, gap: 12, backgroundColor: C.paper }}>
        {back}
        <Skeleton style={{ height: 90, borderRadius: 14 }} />
        <Skeleton style={{ height: 240, borderRadius: 18 }} />
      </View>
    );
  if (!ad)
    return (
      <StateView icon="search" title="Зар олдсонгүй" text="Энэ зар устгагдсан эсвэл таных биш байна.">
        <Button title="Миний зар" onPress={() => router.replace("/my")} />
      </StateView>
    );

  const open = pays.find((p) => p.status === "awaiting" || p.status === "submitted" || p.status === "rejected") ?? null;
  const confirmed = pays.find((p) => p.status === "confirmed") ?? null;
  const featured = isFeatured(ad.featured_until);
  const canStart = ad.status === "active" && !expiryInfo(ad.expires_at).expired;

  async function start() {
    setBusy(true);
    const r = await staffRpc("open_payment", { p_ad: ad!.id });
    setBusy(false);
    if (r.ok) load();
  }
  async function submit(p: Payment) {
    setBusy(true);
    const r = await staffRpc("submit_payment", { p_id: p.id, p_note: note.trim().slice(0, 300) || null });
    setBusy(false);
    if (r.ok) {
      Alert.alert("Илгээгдлээ", "Орлого баталгаажмагц танд мэдэгдэл ирнэ.");
      load();
    }
  }
  const copy = (text: string) => Share.share({ message: text }).catch(() => {});

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: C.paper }}
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={C.ink} />}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {back}
          <T w="display" style={{ fontSize: 20 }}>
            Онцлох зарын төлбөр
          </T>
        </View>

        {created ? (
          <View style={{ backgroundColor: C.ink, borderRadius: 16, padding: 14 }}>
            <T style={{ color: C.paper, fontSize: 14, lineHeight: 20 }}>
              <T w="bold" style={{ color: C.yellow }}>
                Зар хадгалагдлаа.{" "}
              </T>
              Доорх данс руу шилжүүлээд «Төлбөр төлсөн» дарна уу. Орлого баталгаажмагц зар тань шууд нийтлэгдэж, онцлох
              болно.
            </T>
          </View>
        ) : null}

        <View style={[s.card, { flexDirection: "row", gap: 12, padding: 12, alignItems: "center" }]}>
          <Photo path={ad.photos[0]} style={{ width: 84, height: 64, borderRadius: 10 }} />
          <View style={{ flex: 1, gap: 3 }}>
            <T w="semibold">
              {ad.brand} {ad.model} · {ad.year_made}
            </T>
            <T w="display" style={{ fontSize: 15 }}>
              {money(ad.price)}
            </T>
            {featured ? (
              <T w="semibold" style={{ fontSize: 12, color: C.pendingFg }}>
                ⭐ Онцлох зар
              </T>
            ) : null}
          </View>
        </View>

        {open ? (
          <>
            <View style={{ backgroundColor: C.ink, borderRadius: 18, padding: 18, gap: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <T w="display" style={{ color: C.paper, fontSize: 17 }}>
                  Шилжүүлэх
                </T>
                <View
                  style={{
                    backgroundColor: PAY_STATUS[open.status].bg,
                    borderRadius: 6,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                >
                  <T w="semibold" style={{ fontSize: 11, color: PAY_STATUS[open.status].fg }}>
                    {PAY_STATUS[open.status].label}
                  </T>
                </View>
              </View>
              <PayRow label="Дүн" value={money(open.amount)} big onCopy={() => copy(String(open.amount))} />
              <PayRow label="Гүйлгээний утга" value={open.ref} big accent onCopy={() => copy(open.ref)} />
              {settings.pay_account ? (
                <>
                  <PayRow
                    label="Данс"
                    value={settings.pay_account}
                    onCopy={() => copy(settings.pay_account!.replace(/\s/g, ""))}
                  />
                  {settings.pay_bank ? <PayRow label="Банк" value={settings.pay_bank} /> : null}
                  {settings.pay_holder ? <PayRow label="Хүлээн авагч" value={settings.pay_holder} /> : null}
                </>
              ) : (
                <T style={{ color: C.pale, fontSize: 13 }}>
                  Дансны мэдээлэл удахгүй нэмэгдэнэ. Манай ажилтан тантай холбогдож төлбөрийг тохирно.
                </T>
              )}
              <T style={{ color: C.pale, fontSize: 12.5, lineHeight: 18 }}>
                ⚠ Гүйлгээний утгад заавал{" "}
                <T w="monoBold" style={{ color: C.yellow }}>
                  {open.ref}
                </T>{" "}
                гэж бичнэ үү. ⭐ {open.days} хоног онцлох, шимтгэлгүй.
              </T>
            </View>

            {open.status === "submitted" ? (
              <View style={[s.card, { padding: 16, gap: 4 }]}>
                <T w="bold" style={{ fontSize: 16 }}>
                  ⏳ Шалгаж байна
                </T>
                <T style={{ color: C.body, fontSize: 14, lineHeight: 20 }}>
                  Орлого баталгаажмагц танд мэдэгдэл ирж,{" "}
                  {ad.status === "active"
                    ? "зар тань шууд онцлох болно"
                    : ad.status === "pending"
                      ? "зар тань шууд нийтлэгдэнэ"
                      : "зарыг шалгаж нийтэлнэ"}
                  .
                </T>
              </View>
            ) : (
              <View style={[s.card, { padding: 16, gap: 12 }]}>
                {open.status === "rejected" ? (
                  <View style={{ backgroundColor: C.dangerBg, borderRadius: 12, padding: 10 }}>
                    <T style={{ color: C.danger, fontSize: 13.5, lineHeight: 19 }}>
                      Таны төлбөр орж ирээгүй байна{open.admin_note ? `: ${open.admin_note}` : "."} Дүн, гүйлгээний
                      утгаа шалгаад дахин илгээнэ үү.
                    </T>
                  </View>
                ) : null}
                <Field label="Шилжүүлсэн хүний нэр / данс (заавал биш)">
                  <Input value={note} onChangeText={setNote} maxLength={300} placeholder="Жишээ: Б.Болд, Хаан банк" />
                </Field>
                <Button
                  title="Төлбөр төлсөн"
                  variant="yellow"
                  icon="check"
                  loading={busy}
                  onPress={() => submit(open)}
                />
                <T style={{ fontSize: 12, color: C.muted, textAlign: "center" }}>
                  Шилжүүлсний дараа дарна уу. Бид орлогыг шалгаад баталгаажуулна.
                </T>
              </View>
            )}
          </>
        ) : confirmed && (ad.status === "pending" || ad.status === "rejected") ? (
          <Done text={`Зар шалгагдаж нийтлэгдмэгц ${confirmed.days} хоног онцлох болно.`} />
        ) : canStart ? (
          <View style={[s.card, { padding: 16, gap: 12 }]}>
            {confirmed && featured ? <Done text="Таны зар одоо онцлох байна." /> : null}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <T w="bold" style={{ fontSize: 17, flex: 1 }}>
                {featured ? "Онцлох хугацааг сунгах" : "Зараа онцлох болгох"}
              </T>
              <T w="display" style={{ fontSize: 20 }}>
                {money(settings.featured_price ?? 50000)}
              </T>
            </View>
            <T style={{ fontSize: 14, color: C.body, lineHeight: 20 }}>
              ⭐ {settings.featured_days ?? 7} хоног жагсаалтын эхэнд, тэмдэгтэй харагдана. Дансаар шилжүүлээд «Төлбөр
              төлсөн» дарна.
            </T>
            <Button
              title="Төлбөрийн мэдээлэл авах"
              variant="yellow"
              icon="credit-card"
              loading={busy}
              onPress={start}
            />
          </View>
        ) : (
          <T style={{ textAlign: "center", color: C.muted, paddingVertical: 24 }}>
            {ad.status === "pending"
              ? "Зар шалгалтад байна. Нийтлэгдсэний дараа онцлох болгох боломжтой."
              : "Энэ зарыг одоогоор онцлох болгох боломжгүй."}
          </T>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PayRow({
  label,
  value,
  onCopy,
  big = false,
  accent = false,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
  big?: boolean;
  accent?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        borderTopWidth: 1,
        borderColor: C.inkLine,
        paddingTop: 10,
      }}
    >
      <T style={{ color: C.pale, fontSize: 13 }}>{label}</T>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
        <T
          selectable
          w={big ? "display" : "monoBold"}
          style={{ color: accent ? C.yellow : C.paper, fontSize: big ? 20 : 15, flexShrink: 1 }}
        >
          {value}
        </T>
        {onCopy ? (
          <Pressable
            accessibilityLabel={`${label} хуулах`}
            onPress={onCopy}
            hitSlop={6}
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              backgroundColor: C.yellow,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="copy" size={16} color={C.ink} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Done({ text }: { text: string }) {
  return (
    <View style={[s.card, { padding: 14, flexDirection: "row", gap: 12, alignItems: "center" }]}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: C.yellow,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Feather name="check" size={22} color={C.ink} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T w="bold" style={{ fontSize: 15 }}>
          Төлбөр баталгаажсан
        </T>
        <T style={{ fontSize: 13.5, color: C.body }}>{text}</T>
      </View>
    </View>
  );
}
