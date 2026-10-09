import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase, photoUrl } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { C, F } from "@/lib/theme";
import { errMsg } from "@/lib/format";
import { digits } from "@/lib/staff";
import { Button, Field, Input, Skeleton, StateView, T, s } from "@/components/ui";
import { OptionPicker } from "@/components/OptionPicker";
import type { Ad } from "@/lib/types";

type Pic = { key: string; path?: string; uri: string };

async function compress(uri: string) {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 1600 });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return out.uri;
}
const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** Авто худалдаа: өөрийн зарыг засах (мэдээлэл, үнэ, зураг) */
export default function EditAd() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, settings, session } = useAuth();
  const insets = useSafeAreaInsets();
  const uid = session?.user.id ?? "";
  const [ad, setAd] = useState<Ad | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pics, setPics] = useState<Pic[]>([]);
  const [f, setF] = useState({ brand: "", model: "", trim: "", year_made: "", year_imported: "", plate_number: "", vin: "", phone: "", options: "", modifications: "", description: "", price: "" });
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const [opts, setOpts] = useState<string[]>([]);

  useEffect(() => {
    supabase.from("ads").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      const a = data as Ad | null;
      setAd(a);
      if (a) {
        setPics(a.photos.map((p) => ({ key: p, path: p, uri: photoUrl(p) ?? "" })));
        setOpts(a.options);
        setF({
          brand: a.brand, model: a.model, trim: a.trim ?? "", year_made: String(a.year_made), year_imported: a.year_imported ? String(a.year_imported) : "",
          plate_number: a.plate_number, vin: a.vin, phone: a.phone, options: a.options.join(", "), modifications: a.modifications ?? "",
          description: a.description ?? "", price: fmt(a.price),
        });
      }
      setLoading(false);
    });
  }, [id]);

  if (loading) return <View style={{ flex: 1, padding: 20, gap: 12, backgroundColor: C.paper }}><Skeleton style={{ height: 120, borderRadius: 14 }} /><Skeleton style={{ height: 300, borderRadius: 14 }} /></View>;
  if (!ad || (ad.user_id !== uid && profile?.role !== "admin")) return <StateView icon="slash" title="Зар олдсонгүй" text="Энэ зарыг засах эрхгүй байна."><Button title="Буцах" onPress={() => router.back()} /></StateView>;
  if (ad.status === "sold") return <StateView icon="check-circle" title="Зарагдсан зар" text="Зарагдсан зарыг засах боломжгүй."><Button title="Буцах" onPress={() => router.back()} /></StateView>;

  const maxP = settings.max_photos;

  async function pick() {
    const room = maxP - pics.length;
    if (room <= 0) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Зөвшөөрөл хэрэгтэй", "Тохиргооноос зургийн зөвшөөрөл олгоно уу.");
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: room, quality: 0.9 });
    if (res.canceled) return;
    setPics((p) => [...p, ...res.assets.slice(0, room).map((a) => ({ key: `${a.uri}-${Math.random()}`, uri: a.uri }))]);
  }

  async function save() {
    setErr(null);
    const price = Number(digits(f.price));
    if (!pics.length) return setErr("Дор хаяж нэг зураг байх ёстой.");
    if (!f.brand.trim() || !f.model.trim()) return setErr("Марк, загвараа оруулна уу.");
    if (!price) return setErr("Үнээ оруулна уу.");
    setBusy(true);
    const uploaded: string[] = [];
    try {
      const paths: string[] = [];
      for (const [i, p] of pics.entries()) {
        if (p.path) {
          paths.push(p.path);
          continue;
        }
        const small = await compress(p.uri);
        const buf = await fetch(small).then((r) => r.arrayBuffer());
        const path = `${uid}/${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await supabase.storage.from("ad-photos").upload(path, buf, { contentType: "image/jpeg" });
        if (error) throw error;
        uploaded.push(path);
        paths.push(path);
      }
      const { error } = await supabase.rpc("dealer_update_ad", {
        p_ad: ad!.id,
        p: {
          brand: f.brand, model: f.model, trim: f.trim, year_made: Number(f.year_made) || ad!.year_made, year_imported: f.year_imported,
          plate_number: f.plate_number, vin: f.vin, phone: f.phone.replace(/[^\d+]/g, ""),
          options: opts,
          modifications: f.modifications, description: f.description, price, photos: paths,
        },
      });
      if (error) throw error;
      const removed = ad!.photos.filter((x) => !paths.includes(x));
      if (removed.length) await supabase.storage.from("ad-photos").remove(removed);
      Alert.alert("Хадгалагдлаа", "Зар шинэчлэгдлээ.");
      router.back();
    } catch (e) {
      if (uploaded.length) await supabase.storage.from("ad-photos").remove(uploaded);
      setErr(`Хадгалж чадсангүй: ${errMsg(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
        <Pressable accessibilityLabel="Буцах" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line2, alignItems: "center", justifyContent: "center" }}>
          <Feather name="chevron-left" size={22} color={C.ink} />
        </Pressable>
        <T w="display" style={{ fontSize: 20 }}>Зар засах</T>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 130 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <T w="bold" style={s.h2}>Зураг</T>
            <T w="mono" style={{ fontSize: 13, color: C.muted }}>{pics.length} / {maxP}</T>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {pics.map((p, i) => (
              <View key={p.key} style={{ width: "31.5%", aspectRatio: 1, borderRadius: 12, overflow: "hidden", backgroundColor: C.soft }}>
                <Image source={{ uri: p.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                {i === 0 ? (
                  <View style={{ position: "absolute", left: 6, bottom: 6, backgroundColor: C.yellow, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}><T w="bold" style={{ fontSize: 10 }}>НҮҮР</T></View>
                ) : (
                  <Pressable onPress={() => setPics((x) => [x[i], ...x.filter((_, j) => j !== i)])} style={{ position: "absolute", left: 6, bottom: 6, backgroundColor: "rgba(17,19,23,.8)", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
                    <T w="semibold" style={{ fontSize: 10, color: C.paper }}>Нүүр болгох</T>
                  </Pressable>
                )}
                <Pressable accessibilityLabel="Зураг хасах" onPress={() => setPics((x) => x.filter((_, j) => j !== i))} style={{ position: "absolute", right: 6, top: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(17,19,23,.8)", alignItems: "center", justifyContent: "center" }}>
                  <Feather name="x" size={15} color={C.paper} />
                </Pressable>
              </View>
            ))}
            {pics.length < maxP && (
              <Pressable onPress={pick} style={{ width: "31.5%", aspectRatio: 1, borderRadius: 12, borderWidth: 2, borderStyle: "dashed", borderColor: C.line2, alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: C.card }}>
                <Feather name="plus" size={22} color={C.muted} />
                <T style={{ fontSize: 12, color: C.muted }}>Нэмэх</T>
              </Pressable>
            )}
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Марк"><Input value={f.brand} onChangeText={set("brand")} /></Field></View>
          <View style={{ flex: 1 }}><Field label="Загвар"><Input value={f.model} onChangeText={set("model")} /></Field></View>
        </View>
        <Field label="Сер"><Input value={f.trim} onChangeText={set("trim")} /></Field>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Үйлдвэрлэсэн он"><Input value={f.year_made} onChangeText={(t) => set("year_made")(digits(t).slice(0, 4))} keyboardType="number-pad" mono /></Field></View>
          <View style={{ flex: 1 }}><Field label="Орж ирсэн он"><Input value={f.year_imported} onChangeText={(t) => set("year_imported")(digits(t).slice(0, 4))} keyboardType="number-pad" mono /></Field></View>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Улсын дугаар"><Input value={f.plate_number} onChangeText={set("plate_number")} autoCapitalize="characters" mono /></Field></View>
          <View style={{ flex: 1.3 }}><Field label="Арлын дугаар"><Input value={f.vin} onChangeText={set("vin")} autoCapitalize="characters" mono /></Field></View>
        </View>
        <Field label="Утас"><Input value={f.phone} onChangeText={set("phone")} keyboardType="phone-pad" mono /></Field>
        <View style={{ gap: 6 }}>
          <T w="semibold" style={{ fontSize: 13 }}>Опшн</T>
          <OptionPicker value={opts} onChange={setOpts} />
        </View>
        <Field label="Нэмж хийсэн зүйлс"><Input value={f.modifications} onChangeText={set("modifications")} multiline /></Field>
        <Field label="Тайлбар"><Input value={f.description} onChangeText={set("description")} multiline /></Field>
        <View style={{ gap: 8 }}>
          <T w="bold" style={s.h2}>Үнэ</T>
          <View style={{ flexDirection: "row", alignItems: "center", height: 60, borderWidth: 2, borderColor: C.ink, borderRadius: 14, backgroundColor: C.card, paddingHorizontal: 16, gap: 8 }}>
            <Input value={f.price} onChangeText={(t) => { const d = digits(t); set("price")(d ? fmt(Number(d)) : ""); }} keyboardType="number-pad" style={{ flex: 1, borderWidth: 0, height: 56, paddingHorizontal: 0, fontFamily: F.display, fontSize: 22 }} />
            <T w="display" style={{ fontSize: 20 }}>₮</T>
          </View>
        </View>
        {err && <View accessibilityRole="alert" style={{ backgroundColor: C.dangerBg, borderRadius: 12, padding: 12 }}><T style={{ color: "#9B1C1C", fontSize: 14 }}>{err}</T></View>}
      </ScrollView>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16), backgroundColor: C.card, borderTopWidth: 1, borderColor: C.line }}>
        <Button title="Хадгалах" icon="save" variant="yellow" loading={busy} onPress={save} />
      </View>
    </KeyboardAvoidingView>
  );
}
