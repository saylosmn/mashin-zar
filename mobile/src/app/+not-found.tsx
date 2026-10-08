import { router } from "expo-router";
import { Button, StateView } from "@/components/ui";

export default function NotFound() {
  return (
    <StateView icon="map" title="Буруу эргэлт хийчихлээ" text="Таны хайсан хуудас олдсонгүй.">
      <Button title="Нүүр хуудас" onPress={() => router.replace("/")} />
    </StateView>
  );
}
