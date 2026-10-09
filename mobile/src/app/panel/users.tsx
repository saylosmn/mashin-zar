import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Linking, Modal, Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useLiveSync } from "@/lib/live";
import { C, F } from "@/lib/theme";
import { errMsg, initial, roleLabel, timeAgo } from "@/lib/format";
import { confirm, digits, isAdmin, isStaff, staffRpc } from "@/lib/staff";
import { Button, Field, Input, Skeleton, StateView, T, s } from "@/components/ui";
import type { Profile } from "@/lib/types";

type Filter = "all" | "staff" | "dealer" | "blocked";
type Row = Profile & { ads?: { count: number }[] };

export default function Users() {
  const { profile } = useAuth();
  const admin = isAdmin(profile);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<Row | null>(null);
  const [dealerMode, setDealerMode] = useState(false);
  const [shop, setShop] = useState("");

  const load = useCallback(async () => {
    try {
      setError(null);
      let query = supabase.from("profiles").select("*, ads:ads!ads_user_id_fkey(count)", { count: "exact" });
      if (filter === "staff") query = query.in("role", ["manager", "admin"]);
      if (filter === "blocked") query = query.eq("is_blocked", true);
      if (filter === "dealer") query = query.eq("role", "dealer");
      const term = q.trim().replace(/[,()%]/g, " ").trim();
      if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,shop_name.ilike.%${term}%`);
      const { data, count, error: e } = await query.order("created_at", { ascending: false }).limit(200);
      if (e) throw e;
      setRows((data ?? []) as Row[]);
      setTotal(count ?? 0);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [filter, q]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);
  useLiveSync(() => load(), ["profiles", "staff_invites"]);

  if (!isStaff(profile)) return <StateView icon="lock" title="Эрх хүрэхгүй" text="Энэ хэсэг зөвхөн менежер, админд нээлттэй."><Button title="Буцах" onPress={() => router.back()} /></StateView>;

  function manage(u: Row) {
    if (!admin || u.id === profile?.id) return;
    setShop(u.shop_name ?? "");
    setDealerMode(false);
    setSel(u);
  }

  async function makeDealer(u: Row) {
    if (!u.email) return Alert.alert("И-мэйлгүй хэрэглэгч");
    if (!shop.trim()) return Alert.alert("Авто худалдааны нэрийг оруулна уу");
    const r = await staffRpc("invite_dealer", { p_email: u.email, p_shop: shop.trim(), p_phone: u.phone });
    if (r.ok) {
      setSel(null);
      Alert.alert("Амжилттай", `${shop.trim()} авто худалдааны эрхтэй боллоо. Зар нь шууд нийтлэгдэнэ.`);
      load();
    }
  }

  async function removeDealer(u: Row) {
    if (!(await confirm("Авто худалдааны эрх хасах уу?", `${u.shop_name ?? u.email} энгийн хэрэглэгч болно.`, "Хасах", true))) return;
    const r = await staffRpc("remove_dealer", { p_user: u.id });
    if (r.ok) load();
  }

  async function setRole(u: Row, role: "manager" | "admin") {
    if (!u.email) return Alert.alert("И-мэйлгүй хэрэглэгч", "Эрх олгохын тулд и-мэйл хэрэгтэй.");
    if (!(await confirm(`${roleLabel(role)} болгох уу?`, `${u.full_name ?? u.email} панел руу нэвтрэх эрхтэй болно.`, "Тийм"))) return;
    const r = await staffRpc("invite_staff", { p_email: u.email, p_role: role, p_name: u.full_name, p_phone: u.phone });
    if (r.ok) load();
  }

  async function removeStaff(u: Row) {
    if (!(await confirm("Эрх хасах уу?", `${u.full_name ?? u.email} энгийн хэрэглэгч болно.`, "Хасах", true))) return;
    const r = await staffRpc("remove_staff", { p_user: u.id });
    if (r.ok) load();
  }

  async function toggleBlock(u: Row) {
    const block = !u.is_blocked;
    if (!(await confirm(block ? "Аккаунт хаах уу?" : "Аккаунт нээх үү?", block ? "Хэрэглэгч апп, вэбийг ашиглах боломжгүй болно." : "Хэрэглэгч дахин ашиглах боломжтой болно.", block ? "Хаах" : "Нээх", block))) return;
    const r = await staffRpc("set_blocked", { p_user: u.id, p_blocked: block });
    if (r.ok) load();
  }

  async function invite() {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) return Alert.alert("И-мэйл буруу байна");
    setBusy(true);
    const r = await staffRpc("invite_staff", { p_email: e, p_role: "manager", p_name: null, p_phone: null });
    setBusy(false);
    if (r.ok) {
      setEmail("");
      setInviteOpen(false);
      Alert.alert("Амжилттай", `${e} менежерийн эрхтэй боллоо. Google-ээр нэвтэрмэгц Удирдлага хэсэг нээгдэнэ.`);
      load();
    }
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "Бүгд" },
    { key: "staff", label: "Менежер, админ" },
    { key: "dealer", label: "Авто худалдаа" },
    { key: "blocked", label: "Хаагдсан" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 }}>
        <Pressable accessibilityLabel="Буцах" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line2, alignItems: "center", justifyContent: "center" }}>
          <Feather name="chevron-left" size={22} color={C.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <T w="display" style={{ fontSize: 20 }}>Хэрэглэгчид</T>
          <T style={{ fontSize: 12, color: C.muted }}>Нийт {total}</T>
        </View>
        {admin && <Button small title="Нэмэх" icon="user-plus" variant="yellow" onPress={() => setInviteOpen((v) => !v)} />}
      </View>

      <FlatList
        data={loading ? [] : rows}
        keyExtractor={(u) => u.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingTop: 6, gap: 8, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={C.ink} />}
        ListHeaderComponent={
          <View style={{ gap: 10, paddingBottom: 6 }}>
            {inviteOpen && (
              <View style={s.section}>
                <Field label="Шинэ менежерийн Google и-мэйл" hint="Тэр хүн энэ и-мэйлээр нэвтэрмэгц менежерийн эрх автоматаар идэвхжинэ.">
                  <Input value={email} onChangeText={setEmail} placeholder="name@gmail.com" autoCapitalize="none" keyboardType="email-address" />
                </Field>
                <Button title="Эрх олгох" icon="check" loading={busy} onPress={invite} />
              </View>
            )}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.line2, borderRadius: 12, paddingHorizontal: 12, height: 46 }}>
              <Feather name="search" size={18} color={C.muted} />
              <TextInput value={q} onChangeText={setQ} placeholder="Нэр, и-мэйл, утас" placeholderTextColor="#9AA0A9" style={{ flex: 1, fontFamily: F.body, fontSize: 15, color: C.ink, paddingVertical: 0 }} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {filters.map((f) => {
                const on = f.key === filter;
                return (
                  <Pressable key={f.key} onPress={() => { setLoading(true); setFilter(f.key); }} style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: on ? C.ink : C.card, borderWidth: on ? 0 : 1, borderColor: C.line2, justifyContent: "center" }}>
                    <T w={on ? "semibold" : "body"} style={{ fontSize: 13, color: on ? C.yellow : C.ink }}>{f.label}</T>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: 8 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} style={{ height: 72, borderRadius: 14 }} />)}</View>
          ) : error ? (
            <T style={{ color: C.danger, textAlign: "center", paddingVertical: 30 }}>{error}</T>
          ) : (
            <T style={{ color: C.muted, textAlign: "center", paddingVertical: 30 }}>Хэрэглэгч олдсонгүй</T>
          )
        }
        renderItem={({ item: u }) => (
          <Pressable onPress={() => manage(u)} style={({ pressed }) => [s.card, { padding: 12, flexDirection: "row", alignItems: "center", gap: 12, opacity: pressed && admin ? 0.85 : 1 }]}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: u.is_blocked ? C.dangerBg : C.ink, alignItems: "center", justifyContent: "center" }}>
              <T w="bold" style={{ color: u.is_blocked ? C.danger : C.yellow, fontSize: 17 }}>{initial(u.full_name ?? u.email)}</T>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <T w="semibold" style={{ fontSize: 15, flexShrink: 1 }} numberOfLines={1}>{u.role === "dealer" && u.shop_name ? u.shop_name : u.full_name ?? "Нэргүй"}</T>
                {u.role !== "user" && <Chip text={roleLabel(u.role)} bg={C.pendingBg} fg={C.pendingFg} />}
                {u.is_blocked && <Chip text="Хаагдсан" bg={C.dangerBg} fg={C.danger} />}
              </View>
              <T style={{ fontSize: 12, color: C.muted }} numberOfLines={1}>{u.email ?? "—"}</T>
              <T style={{ fontSize: 12, color: C.muted }} numberOfLines={1}>
                {u.phone ?? "Утасгүй"} · {u.ads?.[0]?.count ?? 0} зар · {timeAgo(u.created_at)}
              </T>
            </View>
            {u.phone ? (
              <Pressable accessibilityLabel="Залгах" hitSlop={8} onPress={() => Linking.openURL(`tel:${digits(u.phone!)}`).catch(() => {})} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.yellow, alignItems: "center", justifyContent: "center" }}>
                <Feather name="phone" size={18} color={C.ink} />
              </Pressable>
            ) : null}
            {admin && u.id !== profile?.id && <Feather name="more-vertical" size={18} color={C.muted} />}
          </Pressable>
        )}
      />
      <Modal visible={!!sel} transparent animationType="fade" onRequestClose={() => setSel(null)}>
        <Pressable onPress={() => setSel(null)} style={{ flex: 1, backgroundColor: "rgba(17,19,23,.5)", justifyContent: "flex-end" }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, gap: 10, paddingBottom: 34 }}>
            {sel && (
              <>
                <View style={{ gap: 2, paddingBottom: 6 }}>
                  <T w="bold" style={{ fontSize: 17 }}>{sel.role === "dealer" && sel.shop_name ? sel.shop_name : sel.full_name ?? sel.email}</T>
                  <T style={{ fontSize: 13, color: C.muted }}>{sel.email} · {roleLabel(sel.role)}{sel.is_blocked ? " · Хаагдсан" : ""}</T>
                </View>
                {dealerMode ? (
                  <>
                    <Field label="Авто худалдааны нэр" hint="Зар дээр нь энэ нэр харагдана. Зар нь шууд нийтлэгдэж, өөрсдөө засаж, нууж чадна.">
                      <Input value={shop} onChangeText={setShop} placeholder="Мега Авто" autoFocus />
                    </Field>
                    <Button title="Авто худалдаа болгох" icon="shopping-bag" variant="yellow" onPress={() => makeDealer(sel)} />
                    <Button title="Буцах" variant="ghost" onPress={() => setDealerMode(false)} />
                  </>
                ) : (
                  <>
                    {sel.role === "user" && <Button title="Менежер болгох" icon="briefcase" variant="ghost" onPress={() => { const u = sel; setSel(null); setRole(u, "manager"); }} />}
                    {sel.role === "user" && <Button title="Авто худалдаа болгох" icon="shopping-bag" variant="ghost" onPress={() => setDealerMode(true)} />}
                    {sel.role === "dealer" && <Button title="Нэрийг өөрчлөх" icon="edit-2" variant="ghost" onPress={() => setDealerMode(true)} />}
                    {sel.role === "dealer" && <Button title="Авто худалдааны эрх хасах" icon="user-x" variant="ghost" onPress={() => { const u = sel; setSel(null); removeDealer(u); }} />}
                    {(sel.role === "manager" || sel.role === "admin") && <Button title="Менежерийн эрх хасах" icon="user-x" variant="ghost" onPress={() => { const u = sel; setSel(null); removeStaff(u); }} />}
                    <Button title={sel.is_blocked ? "Аккаунт нээх" : "Аккаунт хаах"} icon={sel.is_blocked ? "unlock" : "lock"} variant={sel.is_blocked ? "ghost" : "danger"} onPress={() => { const u = sel; setSel(null); toggleBlock(u); }} />
                    <Button title="Болих" variant="ghost" onPress={() => setSel(null)} />
                  </>
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}


function Chip({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 }}>
      <T w="semibold" style={{ fontSize: 10, color: fg }}>{text}</T>
    </View>
  );
}
