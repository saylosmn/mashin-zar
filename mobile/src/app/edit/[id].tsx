import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { draftError, emptyAdFields, priceInput, toDraft, type AdFields } from "@shared/ad-post";
import type { Ad } from "@shared/types";
import { supabase, photoUrl } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { C } from "@/lib/theme";
import { errMsg } from "@/lib/format";
import { Button, ScreenHeader, Skeleton, StateView, T, s } from "@/components/ui";
import { AdDetailsForm } from "@/features/post/AdDetailsForm";
import { uploadAdPhoto } from "@/features/post/backend";
import { BottomBar, PhotoGrid, type Pic } from "@/features/post/parts";

const fieldsFrom = (a: Ad): AdFields => ({
  ...emptyAdFields(a.phone),
  brand: a.brand,
  model: a.model,
  trim: a.trim ?? "",
  yearMade: String(a.year_made),
  yearImported: a.year_imported ? String(a.year_imported) : "",
  plate: a.plate_number,
  vin: a.vin,
  options: a.options,
  modifications: a.modifications ?? "",
  description: a.description ?? "",
  price: priceInput(String(a.price)),
});

/** Авто худалдаа (эсвэл админ) өөрийн зарыг засна: мэдээлэл, үнэ, зураг */
export default function EditAd() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, settings, session } = useAuth();
  const uid = session?.user.id ?? "";
  const [ad, setAd] = useState<Ad | null>(null);
  const [loading, setLoading] = useState(true);
  const [pics, setPics] = useState<Pic[]>([]);
  const [fields, setFields] = useState<AdFields>(() => emptyAdFields());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("ads")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        const a = data as Ad | null;
        setAd(a);
        if (a) {
          setPics(a.photos.map((p) => ({ id: p, path: p, uri: photoUrl(p) ?? "" })));
          setFields(fieldsFrom(a));
        }
        setLoading(false);
      });
  }, [id]);

  if (loading)
    return (
      <View style={{ flex: 1, padding: 20, gap: 12, backgroundColor: C.paper }}>
        <Skeleton style={{ height: 120, borderRadius: 14 }} />
        <Skeleton style={{ height: 300, borderRadius: 14 }} />
      </View>
    );
  if (!ad || (ad.user_id !== uid && profile?.role !== "admin"))
    return (
      <StateView icon="slash" title="Зар олдсонгүй" text="Энэ зарыг засах эрхгүй байна.">
        <Button title="Буцах" onPress={() => router.back()} />
      </StateView>
    );
  if (ad.status === "sold")
    return (
      <StateView icon="check-circle" title="Зарагдсан зар" text="Зарагдсан зарыг засах боломжгүй.">
        <Button title="Буцах" onPress={() => router.back()} />
      </StateView>
    );

  const set =
    <K extends keyof AdFields>(k: K) =>
    (v: AdFields[K]) =>
      setFields((f) => ({ ...f, [k]: v }));

  async function pick(camera: boolean) {
    const room = settings.max_photos - pics.length;
    if (room <= 0) return;
    const perm = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Зөвшөөрөл хэрэгтэй", "Тохиргооноос зураг/камерын зөвшөөрөл олгоно уу.");
    const res = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsMultipleSelection: true,
          selectionLimit: room,
          quality: 0.9,
        });
    if (res.canceled) return;
    setPics((p) => [...p, ...res.assets.slice(0, room).map((a) => ({ id: `${a.uri}-${Math.random()}`, uri: a.uri }))]);
  }

  async function save() {
    if (!ad) return;
    setError(null);
    const draft = toDraft(fields);
    const invalid = draftError(draft, pics.length, 1);
    if (invalid) return setError(invalid);
    setBusy(true);
    const uploaded: string[] = [];
    try {
      const paths: string[] = [];
      for (const [i, p] of pics.entries()) {
        const path = p.path ?? (await uploadAdPhoto(uid, p.uri, i));
        if (!p.path) uploaded.push(path);
        paths.push(path);
      }
      const { error: e } = await supabase.rpc("dealer_update_ad", { p_ad: ad.id, p: { ...draft, photos: paths } });
      if (e) throw e;
      const removed = ad.photos.filter((x) => !paths.includes(x));
      if (removed.length) await supabase.storage.from("ad-photos").remove(removed);
      Alert.alert("Хадгалагдлаа", "Зар шинэчлэгдлээ.");
      router.back();
    } catch (e) {
      if (uploaded.length) await supabase.storage.from("ad-photos").remove(uploaded);
      setError(`Хадгалж чадсангүй: ${errMsg(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: C.paper }}
    >
      <ScreenHeader title="Зар засах" style={{ paddingHorizontal: 16, paddingVertical: 8 }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 22, paddingBottom: error ? 200 : 130 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <T w="bold" style={s.h2}>
              1 · Зураг
            </T>
            <T w="mono" style={{ fontSize: 13, color: C.muted }}>
              {pics.length} / {settings.max_photos}
            </T>
          </View>
          <PhotoGrid pics={pics} max={settings.max_photos} onChange={setPics} onPick={pick} />
        </View>
        <AdDetailsForm fields={fields} set={set} cutoff={settings.cutoff_year} />
      </ScrollView>
      <BottomBar error={error}>
        <Button title="Хадгалах" icon="save" variant="yellow" loading={busy} onPress={save} />
      </BottomBar>
    </KeyboardAvoidingView>
  );
}
