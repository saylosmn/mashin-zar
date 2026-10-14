import { View } from "react-native";
import { categoryOf, priceInput, toDraft, type AdFields } from "@shared/ad-post";
import { BRANDS } from "@shared/cars";
import { C, F } from "@/lib/theme";
import { OptionPicker } from "@/components/OptionPicker";
import { Field, Input, T, s } from "@/components/ui";
import { Suggestions } from "./parts";

type Props = {
  fields: AdFields;
  set: <K extends keyof AdFields>(key: K) => (value: AdFields[K]) => void;
  cutoff: number;
};

/** Машины мэдээлэл: марк, загвар, он, дугаар, опшн, тайлбар, үнэ */
export function AdDetailsForm({ fields, set, cutoff }: Props) {
  const knownModels = BRANDS[fields.brand];
  const category = categoryOf(toDraft(fields).year_made, cutoff);
  return (
    <>
      <View style={{ gap: 12 }}>
        <T w="bold" style={s.h2}>
          2 · Машин ба сер
        </T>
        <Field label="Марк">
          <Input value={fields.brand} onChangeText={set("brand")} placeholder="Toyota" />
        </Field>
        {!knownModels && (
          <Suggestions items={Object.keys(BRANDS)} query={fields.brand} limit={8} onPick={set("brand")} />
        )}
        <Field label="Загвар">
          <Input value={fields.model} onChangeText={set("model")} placeholder="Prius" />
        </Field>
        {knownModels && !knownModels.includes(fields.model) && (
          <Suggestions items={knownModels} query={fields.model} limit={10} onPick={set("model")} />
        )}
        <Field label="Аль сер">
          <Input value={fields.trim} onChangeText={set("trim")} placeholder="ZVW55 · S Touring" />
        </Field>
      </View>

      <View style={{ gap: 12 }}>
        <T w="bold" style={s.h2}>
          3 · Он
        </T>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label="Үйлдвэрлэсэн он">
              <Input
                value={fields.yearMade}
                onChangeText={set("yearMade")}
                keyboardType="number-pad"
                maxLength={4}
                mono
                placeholder="2017"
              />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Орж ирсэн он">
              <Input
                value={fields.yearImported}
                onChangeText={set("yearImported")}
                keyboardType="number-pad"
                maxLength={4}
                mono
                placeholder="2023"
              />
            </Field>
          </View>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            padding: 12,
            backgroundColor: C.ink,
            borderRadius: 10,
          }}
        >
          {category ? (
            <>
              <View style={{ backgroundColor: C.yellow, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 }}>
                <T w="monoBold" style={{ fontSize: 11 }}>
                  {category === "new" ? `${cutoff}+` : `${cutoff}-аас өмнө`}
                </T>
              </View>
              <T style={{ color: C.paper, fontSize: 13 }}>Ангилал оноор автоматаар тогтлоо</T>
            </>
          ) : (
            <T style={{ color: C.pale, fontSize: 13 }}>Ангилал үйлдвэрлэсэн оноор автоматаар тогтоно</T>
          )}
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <T w="bold" style={s.h2}>
          4 · Дугаар ба холбоо барих
        </T>
        <Field label="Улсын дугаар">
          <Input
            value={fields.plate}
            onChangeText={set("plate")}
            autoCapitalize="characters"
            strong
            mono
            placeholder="1234 УБА"
            style={{ textAlign: "center", fontSize: 18, letterSpacing: 2 }}
          />
        </Field>
        <Field label="Арлын дугаар">
          <Input
            value={fields.vin}
            onChangeText={set("vin")}
            autoCapitalize="characters"
            mono
            placeholder="ZVW55-8012345"
          />
        </Field>
        <Field label="Утасны дугаар">
          <Input value={fields.phone} onChangeText={set("phone")} keyboardType="phone-pad" mono />
        </Field>
        <T style={{ fontSize: 12, color: C.muted, lineHeight: 18 }}>
          Улсын болон арлын дугаар бусдад нуугдмал харагдана. Зөвхөн манай ажилтан бүтнээр нь харна.
        </T>
      </View>

      <View style={{ gap: 12 }}>
        <T w="bold" style={s.h2}>
          5 · Нэмэлт опшн
        </T>
        <OptionPicker value={fields.options} onChange={set("options")} />
      </View>

      <Field label="6 · Нэмж хийсэн зүйлс">
        <Input
          value={fields.modifications}
          onChangeText={set("modifications")}
          multiline
          placeholder="Өвлийн шинэ дугуй, автозапуск, салоны бүрээс..."
        />
      </Field>
      <Field label="7 · Нэмэлт тайлбар">
        <Input
          value={fields.description}
          onChangeText={set("description")}
          multiline
          placeholder="Машины байдал, эзэмшлийн түүх, үзүүлэх цаг..."
          style={{ minHeight: 110 }}
        />
      </Field>

      <View style={{ gap: 12 }}>
        <T w="bold" style={s.h2}>
          8 · Үнэ
        </T>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            height: 60,
            borderWidth: 2,
            borderColor: C.ink,
            borderRadius: 14,
            backgroundColor: C.card,
            paddingHorizontal: 16,
            gap: 8,
          }}
        >
          <Input
            value={fields.price}
            onChangeText={(t) => set("price")(priceInput(t))}
            keyboardType="number-pad"
            placeholder="48,500,000"
            accessibilityLabel="Үнэ"
            style={{ flex: 1, borderWidth: 0, height: 56, paddingHorizontal: 0, fontFamily: F.display, fontSize: 22 }}
          />
          <T w="display" style={{ fontSize: 20 }}>
            ₮
          </T>
        </View>
      </View>
    </>
  );
}
