import { View } from "react-native";
import { C } from "@/lib/theme";
import { CONTRACT_TITLE, contractDate, contractSections, type ContractData } from "@/lib/contract";
import { T } from "./ui";

/** Гэрээний текст (PDF-тэй ижил агуулга) */
export function ContractView({ data }: { data: ContractData }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ alignItems: "center", gap: 2 }}>
        <T w="bold" style={{ fontSize: 15, textAlign: "center" }}>{CONTRACT_TITLE}</T>
        <T style={{ fontSize: 12, color: C.muted }}>Улаанбаатар хот · {contractDate(data.date ?? new Date().toISOString())}</T>
      </View>
      {contractSections(data).map((s, i) => (
        <View key={i} style={{ gap: 3 }}>
          {s.heading ? <T w="bold" style={{ fontSize: 14 }}>{s.heading}</T> : null}
          {s.lines.map((l, j) => {
            const bullet = l.trim().startsWith("•");
            return (
              <T key={j} w={bullet ? "semibold" : "body"} style={{ fontSize: 13.5, lineHeight: 20, color: bullet ? C.ink : C.body, paddingLeft: bullet ? 12 : 0 }}>
                {l.trim()}
              </T>
            );
          })}
        </View>
      ))}
    </View>
  );
}
