import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { GuestGate } from "@/components/GuestGate";
import { C } from "@/lib/theme";
import { errMsg, money, timeAgo } from "@/lib/format";
import { useLiveSync } from "@/lib/live";
import { Button, CardSkeleton, Photo, StateView, T, s } from "@/components/ui";
import type { ChatRow } from "@shared/types";

function MessagesInner() {
  const [rows, setRows] = useState<ChatRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.rpc("my_chats");
    if (e) setError(errMsg(e));
    else {
      setError(null);
      setRows((data ?? []) as ChatRow[]);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useLiveSync(() => load(), ["messages"]);

  if (error && !rows)
    return (
      <StateView icon="warning" title="Алдаа гарлаа" text={error}>
        <Button title="Дахин оролдох" onPress={load} />
      </StateView>
    );

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
        <T w="display" style={{ fontSize: 22 }}>
          Чат
        </T>
      </View>
      <FlatList
        data={rows ?? []}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 8, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={C.ink} />}
        ListEmptyComponent={
          rows ? (
            <View style={{ alignItems: "center", gap: 12, paddingVertical: 48 }}>
              <T style={{ fontSize: 40 }}>💬</T>
              <T style={{ color: C.body, textAlign: "center", lineHeight: 21 }}>
                Чат алга. Зарын дэлгэц дээрх «Чат» товчоор худалдагчид бичнэ үү.
              </T>
            </View>
          ) : (
            <CardSkeleton />
          )
        }
        renderItem={({ item: c }) => (
          <Pressable
            onPress={() => router.push({ pathname: "/chat/[id]", params: { id: c.id } })}
            style={[
              s.card,
              {
                padding: 12,
                flexDirection: "row",
                gap: 12,
                alignItems: "center",
                borderColor: c.unread ? C.ink : C.line,
              },
            ]}
          >
            <Photo path={c.photo} style={{ width: 64, height: 52, borderRadius: 8 }} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                <T w={c.unread ? "bold" : "semibold"} style={{ fontSize: 15, flexShrink: 1 }} numberOfLines={1}>
                  {c.other_name}
                </T>
                <T style={{ fontSize: 12, color: C.muted }}>{timeAgo(c.last_message_at)}</T>
              </View>
              <T style={{ fontSize: 12, color: C.muted }} numberOfLines={1}>
                {c.role === "buyer" ? "Авах" : "Зарах"} · {c.car}
                {c.price ? ` · ${money(c.price)}` : ""}
              </T>
              <T
                w={c.unread ? "semibold" : "body"}
                style={{ fontSize: 13, color: c.unread ? C.ink : C.body }}
                numberOfLines={1}
              >
                {c.last_from_me ? "Та: " : ""}
                {c.last_message ?? ""}
              </T>
            </View>
            {c.unread > 0 ? (
              <View
                style={{
                  minWidth: 24,
                  height: 24,
                  borderRadius: 12,
                  paddingHorizontal: 6,
                  backgroundColor: "#FF7A1A",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <T w="bold" style={{ fontSize: 12 }}>
                  {c.unread}
                </T>
              </View>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}

export default function MessagesTab() {
  return (
    <GuestGate
      icon="message-circle"
      title="Чат"
      text="Нэвтэрч худалдагч, худалдан авагчтай шууд чатлана."
      next="/messages"
    >
      <MessagesInner />
    </GuestGate>
  );
}
