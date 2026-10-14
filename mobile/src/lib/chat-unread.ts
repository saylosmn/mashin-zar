import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useLiveSync } from "./live";

/** Уншаагүй чатын мессежийн тоо - шинэ мессеж ирэх, уншихад шууд шинэчлэгдэнэ. */
export function useChatUnread(signedIn: boolean) {
  const [n, setN] = useState(0);
  const load = useCallback(() => {
    if (!signedIn) return setN(0);
    supabase.rpc("chat_unread").then(
      ({ data, error }) => setN(error ? 0 : Number(data ?? 0)),
      () => setN(0),
    );
  }, [signedIn]);
  useEffect(() => {
    load();
  }, [load]);
  useLiveSync(() => load(), ["messages"]);
  return n;
}
