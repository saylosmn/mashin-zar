import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetInfo } from "@react-native-community/netinfo";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { C, F } from "@/lib/theme";
import { BRANDS } from "@/lib/cars";
import { OptionPicker } from "@/components/OptionPicker";
import { errMsg } from "@/lib/format";
import { Button, Field, Input, T, s } from "@/components/ui";
import { SignaturePad } from "@/components/SignaturePad";
import { ContractView } from "@/components/ContractView";
import { termsFrom } from "@/lib/contract";
import { WEB_URL } from "@/lib/staff";

type Pic = { uri: string; id: string };

async function compress(uri: string) {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 1600 });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return out.uri;
}

export default function Post() {
  const { profile, settings, session } = useAuth();
  const uid = session?.user.id ?? profile?.id ?? "";
  const insets = useSafeAreaInsets();
  const net = useNetInfo();
  const { max_photos: maxP, min_photos: minP, cutoff_year: cy } = settings;
  const [pics, setPics] = useState<Pic[]>([]);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [trim, setTrim] = useState("");
  const [yearMade, setYearMade] = useState("");
  const [yearImp, setYearImp] = useState("");
  const [plate, setPlate] = useState("");
  const [vin, setVin] = useState("");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [options, setOptions] = useState<string[]>([]);
  const [mods, setMods] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | { done: number; step: 1 | 2 | 3 }>(null);
  const [contractOpen, setContractOpen] = useState(false);
  const [signName, setSignName] = useState(profile?.full_name ?? "");
  const [signature, setSignature] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const ct = termsFrom(settings);
  const dealer = profile?.role === "dealer";

  useEffect(() => {
    if (profile && !profile.profile_completed) router.replace({ pathname: "/complete-profile", params: { next: "post" } });
  }, [profile]);

  const y = Number(yearMade);
  const cat = y ? (y >= cy ? "new" : "old") : null;

  async function pick(camera = false) {
    const room = maxP - pics.length;
    if (room <= 0) return;
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Зөвшөөрөл хэрэгтэй", "Тохиргооноос зураг/камерын зөвшөөрөл олгоно уу.");
    const res = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: room, orderedSelection: true, quality: 0.9 });
    if (res.canceled) return;
    setPics((p) => [...p, ...res.assets.slice(0, room).map((a) => ({ uri: a.uri, id: `${a.assetId ?? a.uri}-${Math.random()}` }))]);
  }

  function makeCover(i: number) {
    setPics((p) => [p[i], ...p.filter((_, j) => j !== i)]);
  }

  async function submit() {
    setErr(null);
    const priceNum = Number(price.replace(/\D/g, ""));
    if (pics.length < minP) return setErr(`Хамгийн багадаа ${minP} зураг оруулна уу.`);
    if (!brand.trim() || !model.trim()) return setErr("Марк, загвараа оруулна уу.");
    if (!y || y < 1950 || y > new Date().getFullYear() + 1) return setErr("Үйлдвэрлэсэн оноо зөв оруулна уу.");
    if (!plate.trim() || !vin.trim()) return setErr("Улсын болон арлын дугаараа оруулна уу.");
    if (phone.replace(/\D/g, "").length < 8) return setErr("Утасны дугаараа оруулна уу.");
    if (!priceNum) return setErr("Үнээ оруулна уу.");
    // Авто худалдаа: гэрээгүй, шууд нийтлэнэ
    if (dealer) return send(true);
    setAgree(false);
    setSignature(null);
    setContractOpen(true);
  }

  /** Гэрээнд гарын үсэг зурж зөвшөөрөөд зар илгээнэ */
  async function send(noContract = false) {
    setErr(null);
    const priceNum = Number(price.replace(/\D/g, ""));
    if (!noContract) {
      if (!signName.trim()) return setErr("Овог нэрээ бичнэ үү.");
      if (!signature) return setErr("Гарын үсгээ зурна уу.");
      if (!agree) return setErr("Гэрээг уншиж зөвшөөрснөө тэмдэглэнэ үү.");
    }
    if (net.isConnected === false) return setErr("Интернэт холболт алга. Холболтоо шалгаад дахин илгээнэ үү.");

    const uploaded: string[] = [];
    setBusy({ done: 0, step: 1 });
    try {
      let contractId: string | null = null;
      if (!noContract) {
      const { data: cid, error: cErr } = await supabase.rpc("sign_contract", {
        p_full_name: signName.trim(),
        p_phone: phone.replace(/[^\d+]/g, ""),
        p_brand: brand.trim(),
        p_model: model.trim(),
        p_year: y,
        p_plate: plate.trim().toUpperCase(),
        p_vin: vin.trim().toUpperCase(),
        p_price: priceNum,
        p_signature: signature,
        p_ua: `Машин зар апп (${Platform.OS})`,
      });
      if (cErr) throw cErr;
      contractId = cid as string;
      }
      setBusy({ done: 0, step: 2 });
      for (const [i, p] of pics.entries()) {
        const small = await compress(p.uri);
        const buf = await fetch(small).then((r) => r.arrayBuffer());
        const path = `${uid}/${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await supabase.storage.from("ad-photos").upload(path, buf, { contentType: "image/jpeg" });
        if (error) throw error;
        uploaded.push(path);
        setBusy({ done: i + 1, step: 2 });
      }
      setBusy({ done: pics.length, step: 3 });
      const { error } = await supabase.from("ads").insert({
        user_id: uid,
        brand: brand.trim(),
        model: model.trim(),
        trim: trim.trim() || null,
        plate_number: plate.trim().toUpperCase(),
        vin: vin.trim().toUpperCase(),
        phone: phone.replace(/[^\d+]/g, ""),
        year_made: y,
        year_imported: Number(yearImp) || null,
        options,
        modifications: mods.trim() || null,
        description: desc.trim() || null,
        price: priceNum,
        photos: uploaded,
        contract_id: contractId,
      });
      if (error) throw error;
      // Гарын үсэгтэй гэрээний PDF-ийг ард нь бэлдэнэ
      if (contractId && session?.access_token) {
        fetch(`${WEB_URL}/api/contracts/${contractId}/pdf`, { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } }).catch(() => {});
      }
      router.replace({ pathname: "/success", params: { title: `${brand} ${model} · ${y}`, price: String(priceNum), cover: uploaded[0], dealer: dealer ? "1" : "0" } });
    } catch (e) {
      if (uploaded.length) await supabase.storage.from("ad-photos").remove(uploaded);
      setBusy(null);
      setErr(`Илгээж чадсангүй: ${errMsg(e)}`);
    }
  }

  if (busy)
    return (
      <View style={{ flex: 1, backgroundColor: C.paper, padding: 24, paddingTop: 56, justifyContent: "center", gap: 24 }} accessibilityLiveRegion="polite">
        <View style={{ alignItems: "center", gap: 12 }}>
          <Feather name="upload-cloud" size={56} color={C.ink} />
          <T w="display" style={{ fontSize: 22 }}>Зар илгээж байна</T>
          <T style={{ color: C.body, textAlign: "center" }}>Уншиж байна, түр хүлээнэ үү. Аппаас гаралгүй байгаарай.</T>
        </View>
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <T w="semibold" style={{ fontSize: 14 }}>Зураг байршуулж байна</T>
            <T w="monoBold" style={{ fontSize: 14 }}>{busy.done} / {pics.length}</T>
          </View>
          <View accessibilityRole="progressbar" style={{ height: 12, borderRadius: 6, backgroundColor: C.line, overflow: "hidden" }}>
            <View style={{ width: `${(busy.done / Math.max(pics.length, 1)) * 100}%`, height: 12, borderRadius: 6, backgroundColor: C.yellow }} />
          </View>
        </View>
        <View style={[s.section, { gap: 14 }]}>
          {[[dealer ? "Мэдээлэл шалгасан" : "Гэрээнд гарын үсэг зурсан", true], [`Зураг байршуулж байна`, busy.step >= 2], [dealer ? "Нийтлэх" : "Менежерт илгээх", busy.step === 3]].map(([t, on], i) => (
            <View key={String(t)} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: on ? C.ink : "transparent", borderWidth: on ? 0 : 2, borderColor: C.pale, alignItems: "center", justifyContent: "center" }}>
                {on && <Feather name="check" size={14} color={C.yellow} />}
              </View>
              <T w={i === busy.step - 1 ? "semibold" : "body"} style={{ color: on ? C.ink : C.muted, fontSize: 14 }}>{t}</T>
            </View>
          ))}
        </View>
      </View>
    );

  if (contractOpen)
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: C.paper }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <Pressable accessibilityLabel="Буцах" onPress={() => setContractOpen(false)} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line2, alignItems: "center", justifyContent: "center" }}>
            <Feather name="chevron-left" size={22} color={C.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <T style={{ fontSize: 12, color: C.muted }}>Сүүлийн алхам</T>
            <T w="display" style={{ fontSize: 19 }}>Зуучлалын гэрээ</T>
          </View>
        </View>
        <ScrollView scrollEnabled={!drawing} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 150 }} keyboardShouldPersistTaps="handled">
          <View style={[s.section, { backgroundColor: C.card }]}>
            <ContractView
              data={{
                company: ct.company,
                terms: ct.terms,
                fullName: signName || null,
                phone: phone.replace(/[^\d+]/g, ""),
                brand: brand.trim(),
                model: model.trim(),
                yearMade: y || null,
                plate: plate.trim().toUpperCase(),
                vin: vin.trim().toUpperCase(),
                price: Number(price.replace(/\D/g, "")) || null,
              }}
            />
          </View>
          <Field label="Овог нэр (гэрээнд бичигдэнэ)"><Input value={signName} onChangeText={setSignName} placeholder="Овог нэр" /></Field>
          <View style={{ gap: 6 }}>
            <T w="semibold" style={{ fontSize: 13 }}>Гарын үсэг</T>
            <SignaturePad onChange={setSignature} onDrawing={setDrawing} />
          </View>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: agree }} onPress={() => setAgree((v) => !v)} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
            <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: C.ink, backgroundColor: agree ? C.ink : C.card, alignItems: "center", justifyContent: "center", marginTop: 1 }}>
              {agree && <Feather name="check" size={16} color={C.yellow} />}
            </View>
            <T style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>Би гэрээг бүрэн уншиж танилцсан бөгөөд шимтгэлийн нөхцөлийг зөвшөөрч байна.</T>
          </Pressable>
          {err && <View accessibilityRole="alert" style={{ backgroundColor: C.dangerBg, borderRadius: 12, padding: 12 }}><T style={{ color: "#9B1C1C", fontSize: 14 }}>{err}</T></View>}
        </ScrollView>
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16), backgroundColor: C.card, borderTopWidth: 1, borderColor: C.line, gap: 8 }}>
          <Button title="Зөвшөөрч, зар илгээх" variant="yellow" icon="check" disabled={!signature || !agree} onPress={() => send()} />
          <T style={{ textAlign: "center", fontSize: 12, color: C.muted }}>Гарын үсэгтэй гэрээний PDF “Миний зар” хэсэгт хадгалагдана</T>
        </View>
      </KeyboardAvoidingView>
    );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderColor: C.line }}>
        <Pressable accessibilityLabel="Буцах" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line2, alignItems: "center", justifyContent: "center" }}>
          <Feather name="chevron-left" size={22} color={C.ink} />
        </Pressable>
        <View>
          <T w="display" style={{ fontSize: 17 }}>Зар нэмэх</T>
          <T style={{ fontSize: 12, color: C.muted }}>Алхам 2 / 2 · Машины мэдээлэл</T>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 26, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <T w="bold" style={s.h2}>1 · Зураг</T>
            <T w="mono" style={{ fontSize: 13, color: C.muted }}>{pics.length} / {maxP}</T>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {pics.map((p, i) => (
              <Pressable key={p.id} onLongPress={() => makeCover(i)} onPress={() => i > 0 && makeCover(i)} accessibilityLabel={`Зураг ${i + 1}${i === 0 ? ", нүүр зураг" : ", дарж нүүр болгох"}`} style={{ width: "23%", aspectRatio: 1, borderRadius: 10, overflow: "hidden", borderWidth: i === 0 ? 2 : 0, borderColor: C.ink }}>
                <Image source={{ uri: p.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                {i === 0 && <View style={{ position: "absolute", left: 4, bottom: 4, backgroundColor: C.ink, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 }}><T w="monoBold" style={{ color: C.yellow, fontSize: 9 }}>НҮҮР</T></View>}
                <Pressable accessibilityLabel={`Зураг ${i + 1} хасах`} hitSlop={6} onPress={() => setPics((x) => x.filter((q) => q.id !== p.id))} style={{ position: "absolute", right: 3, top: 3, width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(17,19,23,.8)", alignItems: "center", justifyContent: "center" }}>
                  <Feather name="x" size={14} color={C.paper} />
                </Pressable>
              </Pressable>
            ))}
            {pics.length < maxP && (
              <>
                <Pressable onPress={() => pick(false)} accessibilityLabel="Зургийн сангаас нэмэх" style={{ width: "23%", aspectRatio: 1, borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#9AA0A9", backgroundColor: C.card, alignItems: "center", justifyContent: "center", gap: 2 }}>
                  <Feather name="image" size={20} color={C.ink} />
                  <T style={{ fontSize: 11 }}>Нэмэх</T>
                </Pressable>
                <Pressable onPress={() => pick(true)} accessibilityLabel="Камераар авах" style={{ width: "23%", aspectRatio: 1, borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#9AA0A9", backgroundColor: C.card, alignItems: "center", justifyContent: "center", gap: 2 }}>
                  <Feather name="camera" size={20} color={C.ink} />
                  <T style={{ fontSize: 11 }}>Камер</T>
                </Pressable>
              </>
            )}
          </View>
          <T style={{ fontSize: 12, color: C.muted }}>Эхний зураг нүүр зураг болно. Аль нэг зураг дээр дарж нүүр болгоно. {minP}–{maxP} зураг.</T>
        </View>

        <View style={{ gap: 12 }}>
          <T w="bold" style={s.h2}>2 · Машин ба сер</T>
          <Field label="Марк"><Input value={brand} onChangeText={setBrand} placeholder="Toyota" /></Field>
          {!brand || !BRANDS[brand] ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {Object.keys(BRANDS).filter((b) => !brand || b.toLowerCase().startsWith(brand.toLowerCase())).slice(0, 8).map((b) => (
                <Pressable key={b} onPress={() => setBrand(b)} style={{ paddingHorizontal: 10, height: 32, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line2, justifyContent: "center" }}><T style={{ fontSize: 13 }}>{b}</T></Pressable>
              ))}
            </View>
          ) : null}
          <Field label="Загвар"><Input value={model} onChangeText={setModel} placeholder="Prius" /></Field>
          {BRANDS[brand] && !BRANDS[brand].includes(model) ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {BRANDS[brand].filter((m) => !model || m.toLowerCase().startsWith(model.toLowerCase())).slice(0, 10).map((m) => (
                <Pressable key={m} onPress={() => setModel(m)} style={{ paddingHorizontal: 10, height: 32, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line2, justifyContent: "center" }}><T style={{ fontSize: 13 }}>{m}</T></Pressable>
              ))}
            </View>
          ) : null}
          <Field label="Аль сер"><Input value={trim} onChangeText={setTrim} placeholder="ZVW55 · S Touring" /></Field>
        </View>

        <View style={{ gap: 12 }}>
          <T w="bold" style={s.h2}>3 · Он</T>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Field label="Үйлдвэрлэсэн он"><Input value={yearMade} onChangeText={setYearMade} keyboardType="number-pad" maxLength={4} mono placeholder="2017" /></Field></View>
            <View style={{ flex: 1 }}><Field label="Орж ирсэн он"><Input value={yearImp} onChangeText={setYearImp} keyboardType="number-pad" maxLength={4} mono placeholder="2023" /></Field></View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12, backgroundColor: C.ink, borderRadius: 10 }}>
            {cat ? (
              <>
                <View style={{ backgroundColor: C.yellow, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 }}><T w="monoBold" style={{ fontSize: 11 }}>{cat === "new" ? `${cy}+` : `${cy}-аас өмнө`}</T></View>
                <T style={{ color: C.paper, fontSize: 13 }}>Ангилал оноор автоматаар тогтлоо</T>
              </>
            ) : (
              <T style={{ color: C.pale, fontSize: 13 }}>Ангилал үйлдвэрлэсэн оноор автоматаар тогтоно</T>
            )}
          </View>
        </View>

        <View style={{ gap: 12 }}>
          <T w="bold" style={s.h2}>4 · Дугаар ба холбоо барих</T>
          <Field label="Улсын дугаар"><Input value={plate} onChangeText={setPlate} autoCapitalize="characters" strong mono placeholder="1234 УБА" style={{ textAlign: "center", fontSize: 18, letterSpacing: 2 }} /></Field>
          <Field label="Арлын дугаар"><Input value={vin} onChangeText={setVin} autoCapitalize="characters" mono placeholder="ZVW55-8012345" /></Field>
          <Field label="Утасны дугаар"><Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" mono /></Field>
          <T style={{ fontSize: 12, color: C.muted, lineHeight: 18 }}>Улсын болон арлын дугаар бусдад нуугдмал харагдана. Зөвхөн менежер бүтнээр нь харна.</T>
        </View>

        <View style={{ gap: 12 }}>
          <T w="bold" style={s.h2}>5 · Нэмэлт опшн</T>
          <OptionPicker value={options} onChange={setOptions} />
        </View>

        <Field label="6 · Нэмж хийсэн зүйлс"><Input value={mods} onChangeText={setMods} multiline placeholder="Өвлийн шинэ дугуй, автозапуск, салоны бүрээс..." /></Field>
        <Field label="7 · Нэмэлт тайлбар"><Input value={desc} onChangeText={setDesc} multiline placeholder="Машины байдал, эзэмшлийн түүх, үзүүлэх цаг..." style={{ minHeight: 110 }} /></Field>

        <View style={{ gap: 12 }}>
          <T w="bold" style={s.h2}>8 · Үнэ</T>
          <View style={{ flexDirection: "row", alignItems: "center", height: 60, borderWidth: 2, borderColor: C.ink, borderRadius: 14, backgroundColor: C.card, paddingHorizontal: 16, gap: 8 }}>
            <Input
              value={price}
              onChangeText={(t) => { const d = t.replace(/\D/g, ""); setPrice(d ? d.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : ""); }}
              keyboardType="number-pad"
              placeholder="48,500,000"
              accessibilityLabel="Үнэ"
              style={{ flex: 1, borderWidth: 0, height: 56, paddingHorizontal: 0, fontFamily: F.display, fontSize: 22 }}
            />
            <T w="display" style={{ fontSize: 20 }}>₮</T>
          </View>
        </View>

        {err && <View accessibilityRole="alert" style={{ backgroundColor: C.dangerBg, borderRadius: 12, padding: 12 }}><T style={{ color: "#9B1C1C", fontSize: 14 }}>{err}</T></View>}
      </ScrollView>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16), backgroundColor: C.card, borderTopWidth: 1, borderColor: C.line, gap: 8 }}>
        <Button title={dealer ? "Зар нийтлэх" : "Үргэлжлүүлэх · Гэрээ"} variant="yellow" icon={dealer ? "check" : "arrow-right"} onPress={submit} />
        <T style={{ textAlign: "center", fontSize: 12, color: C.muted }}>{dealer ? "Авто худалдааны зар шууд нийтлэгдэнэ" : "Дараа нь гэрээнд гарын үсэг зурна · Нийтлэхээс өмнө менежер шалгана"}</T>
      </View>
    </KeyboardAvoidingView>
  );
}
