import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { useNetInfo } from "@react-native-community/netinfo";
import {
  PAID_STEPS,
  agentCodeInput,
  draftError,
  emptyAdFields,
  planCards,
  publishAd,
  toDraft,
  type AdFields,
  type PublishStep,
} from "@shared/ad-post";

import { termsFrom, tierLines } from "@shared/contract";
import type { Plan } from "@shared/types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { C } from "@/lib/theme";
import { errMsg, money } from "@/lib/format";

import { SignaturePad } from "@/components/SignaturePad";
import { ContractView } from "@/components/ContractView";
import { BackButton, Button, Field, Input, ScreenHeader, T, s } from "@/components/ui";
import { adBackend, prepareContractPdf } from "@/features/post/backend";
import { BottomBar, PhotoGrid, PlanCard, Progress, type Pic } from "@/features/post/parts";
import { AdDetailsForm } from "@/features/post/AdDetailsForm";

type Stage = "form" | "plan" | "contract" | "paid";
type Agent = { code: string; id: string; name: string };

const pageStyle = { flex: 1, backgroundColor: C.paper };
const kbBehavior = Platform.OS === "ios" ? "padding" : undefined;
const headerStyle = { paddingHorizontal: 16, paddingVertical: 8 };

export default function PostScreen() {
  const { profile, settings, session } = useAuth();
  const uid = session?.user.id ?? profile?.id ?? "";
  const net = useNetInfo();
  const { max_photos: maxPhotos, min_photos: minPhotos, cutoff_year: cutoff } = settings;
  const dealer = profile?.role === "dealer";
  const ct = termsFrom(settings);
  const featuredPrice = settings.featured_price ?? 50000;
  const featuredDays = settings.featured_days ?? 7;
  const cards = planCards(ct.terms, {
    featuredPrice,
    featuredDays,
    commissionFeaturedDays: settings.commission_featured_days ?? 7,
  });

  const [pics, setPics] = useState<Pic[]>([]);
  const [fields, setFields] = useState<AdFields>(() => emptyAdFields(profile?.phone ?? ""));
  const [agentCode, setAgentCode] = useState("");
  const [agent, setAgent] = useState<Agent | null>(null);
  const [stage, setStage] = useState<Stage>("form");
  const [plan, setPlan] = useState<Plan>("commission");
  const [signName, setSignName] = useState(profile?.full_name ?? "");
  const [signature, setSignature] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ step: PublishStep; done: number } | null>(null);
  // Гарын үсэг зурсан гэрээ: дараагийн алхам унавал дахин оролдоход ашиглана
  const contract = useRef<{ key: string; id: string } | null>(null);

  const set =
    <K extends keyof AdFields>(k: K) =>
    (v: AdFields[K]) =>
      setFields((f) => ({ ...f, [k]: v }));
  const draft = toDraft(fields);

  useEffect(() => {
    if (profile && !profile.profile_completed)
      router.replace({ pathname: "/complete-profile", params: { next: "post" } });
  }, [profile]);

  const back = useCallback(() => {
    setError(null);
    setStage((st) => (st === "plan" ? "form" : "plan"));
  }, []);

  // Android-ын "буцах" товч: илгээж байхад хаахгүй, гэрээ/төлбөр -> сонголт -> маягт
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (busy) return true;
        if (stage === "form") return false;
        back();
        return true;
      });
      return () => sub.remove();
    }, [busy, stage, back]),
  );

  async function pick(camera: boolean) {
    const room = maxPhotos - pics.length;
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
          orderedSelection: true,
          quality: 0.9,
        });
    if (res.canceled) return;
    const added = res.assets.slice(0, room).map((a) => ({ uri: a.uri, id: `${a.assetId ?? a.uri}-${Math.random()}` }));
    setPics((p) => [...p, ...added]);
  }

  /** Маягтыг шалгаад сонголт руу (авто худалдаа бол шууд нийтэлнэ) */
  async function next() {
    setError(null);
    const e = draftError(draft, pics.length, minPhotos);
    if (e) return setError(e);
    let found = agent;
    if (!agentCode) found = null;
    else if (agent?.code !== agentCode) {
      const { data } = await supabase.rpc("agent_by_code", { p_code: agentCode });
      const row = Array.isArray(data) ? (data[0] as { id: string; name: string } | undefined) : undefined;
      if (!row) return setError("Агентын код олдсонгүй. Кодоо шалгах эсвэл хоосон орхино уу.");
      found = { code: agentCode, ...row };
    }
    setAgent(found);
    if (dealer) return send(null, found);
    setStage("plan");
  }

  async function send(chosen: Plan | null, withAgent = agent) {
    setError(null);
    const withContract = chosen === "commission";
    if (withContract) {
      if (!signName.trim()) return setError("Овог нэрээ бичнэ үү.");
      if (!signature) return setError("Гарын үсгээ зурна уу.");
      if (!agree) return setError("Гэрээг уншиж зөвшөөрснөө тэмдэглэнэ үү.");
    }
    if (net.isConnected === false) return setError("Интернэт холболт алга. Холболтоо шалгаад дахин илгээнэ үү.");
    try {
      const api = adBackend(
        uid,
        pics.map((p) => p.uri),
      );
      const res = await publishAd(
        api,
        {
          userId: uid,
          draft,
          photoCount: pics.length,
          plan: chosen,
          agentId: withAgent?.id ?? null,
          signer: signName.trim(),
          signature: withContract ? signature : null,
          contract,
        },
        (step, done) => setBusy({ step, done }),
      );
      if (res.contractId && session?.access_token) prepareContractPdf(res.contractId, session.access_token);
      if (chosen === "paid") return router.replace({ pathname: "/pay/[id]", params: { id: res.id, created: "1" } });
      router.replace({
        pathname: "/success",
        params: {
          title: `${draft.brand} ${draft.model} · ${draft.year_made}`,
          price: String(draft.price),
          cover: res.cover,
          dealer: dealer ? "1" : "0",
        },
      });
    } catch (e) {
      setBusy(null);
      setError(`Илгээж чадсангүй: ${errMsg(e)}`);
    }
  }

  if (busy)
    return (
      <Progress
        step={busy.step}
        done={busy.done}
        total={pics.length}
        labels={[
          "Зураг байршуулах",
          dealer ? "Мэдээлэл шалгах" : plan === "paid" ? "Онцлох төлбөртэй сонголт" : "Гэрээнд гарын үсэг зурах",
          dealer ? "Нийтлэх" : plan === "paid" ? "Илгээх" : "Шалгалтад илгээх",
        ]}
      />
    );

  if (stage === "plan")
    return (
      <View style={pageStyle}>
        <ScreenHeader eyebrow="Сонголт" title="Зараа хэрхэн байршуулах вэ?" onBack={back} style={headerStyle} />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
          <PlanCard
            {...cards.commission}
            highlight
            onPick={() => {
              setError(null);
              setAgree(false);
              setSignature(null);
              setPlan("commission");
              setStage("contract");
            }}
          />
          <PlanCard
            {...cards.paid}
            onPick={() => {
              setError(null);
              setPlan("paid");
              setStage("paid");
            }}
          />
          <T style={{ fontSize: 12, color: C.muted, lineHeight: 18 }}>
            Шимтгэлийн шат: {tierLines(ct.terms).join("; ")}.
          </T>
        </ScrollView>
      </View>
    );

  if (stage === "paid")
    return (
      <View style={pageStyle}>
        <ScreenHeader eyebrow="Сүүлийн алхам" title="Онцлох зар · шимтгэлгүй" onBack={back} style={headerStyle} />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 200 }}>
          <View style={{ backgroundColor: C.ink, borderRadius: 18, padding: 18, gap: 6 }}>
            <T style={{ color: C.pale, fontSize: 13 }}>
              {draft.brand} {draft.model} · {draft.year_made} · {money(draft.price)}
            </T>
            <T w="display" style={{ color: C.yellow, fontSize: 28 }}>
              {money(featuredPrice)}
            </T>
            <T style={{ color: C.paper, fontSize: 14 }}>⭐ {featuredDays} хоног онцлох · шимтгэлгүй</T>
          </View>
          {PAID_STEPS.map((t, i) => (
            <View key={t} style={{ flexDirection: "row", gap: 10 }}>
              <T w="monoBold" style={{ fontSize: 14 }}>
                {i + 1}.
              </T>
              <T style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>{t}</T>
            </View>
          ))}
        </ScrollView>
        <BottomBar error={error}>
          <Button title="Зар илгээх · төлбөр рүү" variant="yellow" icon="arrow-right" onPress={() => send("paid")} />
        </BottomBar>
      </View>
    );

  if (stage === "contract")
    return (
      <KeyboardAvoidingView behavior={kbBehavior} style={pageStyle}>
        <ScreenHeader eyebrow="Сүүлийн алхам" title="Зуучлалын гэрээ" onBack={back} style={headerStyle} />
        <ScrollView
          scrollEnabled={!drawing}
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: error ? 220 : 150 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[s.section, { backgroundColor: C.card }]}>
            <ContractView
              data={{
                company: ct.company,
                terms: ct.terms,
                fullName: signName || null,
                phone: draft.phone,
                brand: draft.brand,
                model: draft.model,
                yearMade: draft.year_made || null,
                plate: draft.plate_number,
                vin: draft.vin,
                price: draft.price || null,
              }}
            />
          </View>
          <Field label="Овог нэр (гэрээнд бичигдэнэ)">
            <Input value={signName} onChangeText={setSignName} placeholder="Овог нэр" />
          </Field>
          <View style={{ gap: 6 }}>
            <T w="semibold" style={{ fontSize: 13 }}>
              Гарын үсэг
            </T>
            <SignaturePad onChange={setSignature} onDrawing={setDrawing} />
          </View>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agree }}
            onPress={() => setAgree((v) => !v)}
            style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                borderWidth: 2,
                borderColor: C.ink,
                backgroundColor: agree ? C.ink : C.card,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 1,
              }}
            >
              {agree && <Feather name="check" size={16} color={C.yellow} />}
            </View>
            <T style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>
              Би гэрээг бүрэн уншиж танилцсан бөгөөд шимтгэлийн нөхцөлийг зөвшөөрч байна.
            </T>
          </Pressable>
        </ScrollView>
        <BottomBar error={error}>
          <Button
            title="Зөвшөөрч, зар илгээх"
            variant="yellow"
            icon="check"
            disabled={!signature || !agree}
            onPress={() => send("commission")}
          />
          <T style={{ textAlign: "center", fontSize: 12, color: C.muted }}>
            Гарын үсэгтэй гэрээний PDF «Миний зар» хэсэгт хадгалагдана
          </T>
        </BottomBar>
      </KeyboardAvoidingView>
    );

  return (
    <KeyboardAvoidingView behavior={kbBehavior} style={pageStyle}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderColor: C.line,
        }}
      >
        <BackButton />
        <View>
          <T w="display" style={{ fontSize: 17 }}>
            Зар нэмэх
          </T>
          <T style={{ fontSize: 12, color: C.muted }}>Алхам 2 / 2 · Машины мэдээлэл</T>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 26, paddingBottom: error ? 210 : 140 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <T w="bold" style={s.h2}>
              1 · Зураг
            </T>
            <T w="mono" style={{ fontSize: 13, color: C.muted }}>
              {pics.length} / {maxPhotos}
            </T>
          </View>
          <PhotoGrid pics={pics} max={maxPhotos} onChange={setPics} onPick={pick} />
          <T style={{ fontSize: 12, color: C.muted }}>
            Эхний зураг нүүр зураг болно. Аль нэг зураг дээр дарж нүүр болгоно. {minPhotos}–{maxPhotos} зураг.
          </T>
        </View>

        <AdDetailsForm fields={fields} set={set} cutoff={cutoff} />
        <Field
          label="Агентын код (заавал биш)"
          hint={
            agent && agent.code === agentCode
              ? `✓ Агент: ${agent.name}`
              : "Танд манай агент туслалцаа үзүүлсэн бол түүний кодыг оруулна уу."
          }
        >
          <Input
            value={agentCode}
            onChangeText={(t) => setAgentCode(agentCodeInput(t))}
            autoCapitalize="characters"
            autoCorrect={false}
            mono
            placeholder="K7M2QX"
          />
        </Field>
      </ScrollView>
      <BottomBar error={error}>
        <Button
          title={dealer ? "Зар нийтлэх" : "Үргэлжлүүлэх · Сонголт"}
          variant="yellow"
          icon={dealer ? "check" : "arrow-right"}
          onPress={next}
        />
        <T style={{ textAlign: "center", fontSize: 12, color: C.muted }}>
          {dealer
            ? "Авто худалдааны зар шууд нийтлэгдэнэ"
            : "Дараа нь: шимтгэлтэй (гэрээ, шалгалттай) эсвэл онцлох төлбөртэй (төлбөр ормогц шууд нийтлэгдэнэ)"}
        </T>
      </BottomBar>
    </KeyboardAvoidingView>
  );
}
