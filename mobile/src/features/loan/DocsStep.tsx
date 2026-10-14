import type { MutableRefObject } from "react";
import { Alert, Linking, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/theme";
import { errMsg } from "@/lib/format";
import { LOAN_DOCS, MAX_DOC_PAGES, docHint, docLabel, docPageKeys, type Partner } from "@/lib/loan";
import { Button, T, s } from "@/components/ui";
import { Notice } from "./controls";
import { packDocs } from "@shared/loan-form";

type Docs = Record<string, string>;

const quietRemove = (path: string) => {
  supabase.storage
    .from("loan-docs")
    .remove([path])
    .then(
      () => {},
      () => {},
    );
};

async function pickImage(camera: boolean) {
  const perm = camera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert("Зөвшөөрөл хэрэгтэй", "Тохиргооноос зураг/камерын зөвшөөрөл олгоно уу.");
    return null;
  }
  const opts = { mediaTypes: ["images"] as ImagePicker.MediaType[], quality: 0.9 };
  const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  return res.canceled ? null : (res.assets[0] ?? null);
}

/** 2000px-ээс том зургийг багасгаж JPEG болгоно */
async function toJpeg(asset: ImagePicker.ImagePickerAsset) {
  const ctx = ImageManipulator.manipulate(asset.uri);
  if ((asset.width ?? 0) > 2000) ctx.resize({ width: 2000 });
  const out = await (await ctx.renderAsync()).saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
  return fetch(out.uri).then((r) => r.arrayBuffer());
}

export function DocsStep({
  uid,
  batch,
  partner,
  docs,
  setDocs,
  reused,
  required,
  hasCosigner,
  onError,
  uploading,
  setUploading,
}: {
  uid: string;
  batch: string;
  partner: Partner;
  docs: Docs;
  setDocs: (fn: (d: Docs) => Docs) => void;
  /** Өмнөх хүсэлтээс авсан файлууд. Тэр хүсэлт ч ашигладаг тул storage-аас устгахгүй. */
  reused: MutableRefObject<Set<string>>;
  required: string[];
  hasCosigner: boolean;
  onError: (e: string | null) => void;
  uploading: string | null;
  setUploading: (kind: string | null) => void;
}) {
  async function upload(kind: string, camera: boolean) {
    onError(null);
    const asset = await pickImage(camera);
    if (!asset) return;
    setUploading(kind);
    try {
      const body = await toJpeg(asset);
      const path = `${uid}/${batch}/${kind}-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("loan-docs").upload(path, body, { contentType: "image/jpeg" });
      if (error) throw error;
      setDocs((d) => {
        const key = docPageKeys(kind).find((k) => !d[k]);
        if (!key) {
          quietRemove(path);
          return d;
        }
        return { ...d, [key]: path };
      });
    } catch (e) {
      onError(`Хавсаргаж чадсангүй: ${errMsg(e)}`);
    } finally {
      setUploading(null);
    }
  }

  function choose(kind: string) {
    const key = docPageKeys(kind).find((k) => !docs[k]);
    if (!key) return;
    Alert.alert(docLabel(key), "Баримтаа хэрхэн оруулах вэ?", [
      { text: "Болих", style: "cancel" },
      { text: "Галерей", onPress: () => upload(kind, false) },
      { text: "Зураг авах", onPress: () => upload(kind, true) },
    ]);
  }

  function remove(key: string) {
    const path = docs[key];
    setDocs((d) => {
      const next = { ...d };
      delete next[key];
      return packDocs(next);
    });
    if (path && !reused.current.has(path)) quietRemove(path);
  }

  const kinds = LOAN_DOCS.filter((x) => x.kind !== "cosigner_id" || hasCosigner);
  const hasReused = Object.values(docs).some((v) => reused.current.has(v));

  return (
    <>
      <T w="bold" style={s.h2}>
        Баримт бичиг
      </T>
      <T style={{ fontSize: 13, color: C.muted, lineHeight: 19 }}>
        Баримтынхаа зургийг авч эсвэл галерейгаас оруулна. Лавлагааг e-mongolia.mn-ээс гаргаад дэлгэцийн зургийг оруулж
        болно. Файлууд зөвхөн {partner.name}-д харагдана.
      </T>
      <Button
        small
        title="e-mongolia.mn нээх"
        icon="external-link"
        variant="ghost"
        onPress={() => Linking.openURL("https://e-mongolia.mn")}
      />
      {hasReused && (
        <Notice tone="ok">
          Өмнөх хүсэлтэд хавсаргасан баримтуудыг автоматаар орууллаа. Хуучирсан бол хасаад шинээр оруулна уу.
        </Notice>
      )}
      {kinds.map((x) => (
        <DocCard
          key={x.kind}
          label={x.label}
          hint={docHint(x)}
          required={required.includes(x.kind)}
          pages={docPageKeys(x.kind).filter((k) => docs[k])}
          isReused={(k) => reused.current.has(docs[k])}
          busy={uploading === x.kind}
          disabled={!!uploading}
          onAdd={() => choose(x.kind)}
          onRemove={remove}
        />
      ))}
    </>
  );
}

function DocCard({
  label,
  hint,
  required,
  pages,
  isReused,
  busy,
  disabled,
  onAdd,
  onRemove,
}: {
  label: string;
  hint: string | null;
  required: boolean;
  pages: string[];
  isReused: (key: string) => boolean;
  busy: boolean;
  disabled: boolean;
  onAdd: () => void;
  onRemove: (key: string) => void;
}) {
  const have = pages.length > 0;
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: have ? "#9BD3AE" : C.line,
        backgroundColor: have ? "#F1FAF4" : C.card,
        borderRadius: 12,
        padding: 12,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <T w="semibold" style={{ fontSize: 14, flex: 1 }}>
          {label}
        </T>
        {required ? (
          <View style={{ backgroundColor: C.pendingBg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
            <T w="semibold" style={{ fontSize: 11, color: C.pendingFg }}>
              заавал
            </T>
          </View>
        ) : (
          <T style={{ fontSize: 11, color: C.muted }}>заавал биш</T>
        )}
      </View>
      {!have && hint ? <T style={{ fontSize: 12, color: C.muted, lineHeight: 17 }}>{hint}</T> : null}
      {pages.map((k, i) => (
        <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <T style={{ fontSize: 13, color: "#1D6B3A", flex: 1 }}>
            ✓ {i + 1}-р хуудас{isReused(k) ? " · өмнөх хүсэлтээс" : ""}
          </T>
          <Button small title="Хасах" variant="danger" disabled={disabled} onPress={() => onRemove(k)} />
        </View>
      ))}
      {!have ? (
        <Button
          small
          title="Хавсаргах"
          icon="paperclip"
          variant="ink"
          loading={busy}
          disabled={disabled}
          onPress={onAdd}
        />
      ) : pages.length < MAX_DOC_PAGES ? (
        <Button
          small
          title="Хуудас нэмэх"
          icon="plus"
          variant="ghost"
          loading={busy}
          disabled={disabled}
          onPress={onAdd}
        />
      ) : (
        <T style={{ fontSize: 12, color: C.muted }}>Хамгийн ихдээ {MAX_DOC_PAGES} хуудас</T>
      )}
    </View>
  );
}
