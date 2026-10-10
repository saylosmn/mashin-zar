import type { ReactNode } from "react";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { requireLogin } from "@/lib/guest";
import { Button, StateView } from "./ui";

/** Нэвтрэх шаардлагатай табыг нэвтрээгүй хэрэглэгчид тайлбартай харуулна. */
export function GuestGate({ icon, title, text, next, children }: { icon: keyof typeof Feather.glyphMap; title: string; text: string; next: string; children: ReactNode }) {
  const { session } = useAuth();
  if (session) return <>{children}</>;
  return (
    <StateView icon={icon} title={title} text={text}>
      <Button title="Google-ээр нэвтрэх" icon="log-in" onPress={() => requireLogin(next)} />
    </StateView>
  );
}
