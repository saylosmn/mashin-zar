import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { registerPush } from "./push";
import { useLiveSync } from "./live";
import type { Profile, Settings } from "./types";

WebBrowser.maybeCompleteAuthSession();

const DEFAULT_SETTINGS: Settings = {
  offer_percent: null,
  cutoff_year: 2016,
  max_photos: 16,
  min_photos: 3,
  ad_days: 60,
  notify_all_on_approve: true,
  notify_staff_on_new: true,
};

type Ctx = {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  settings: Settings;
  refreshProfile: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const loadProfile = useCallback(async (uid: string | undefined) => {
    if (!uid) return setProfile(null);
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    if (p) setProfile(p as Profile);
    else {
      const { data: u } = await supabase.auth.getUser();
      const meta = u.user?.user_metadata ?? {};
      const { data: created } = await supabase
        .from("profiles")
        .insert({ id: uid, email: u.user?.email, full_name: meta.full_name ?? meta.name ?? null, avatar_url: meta.avatar_url ?? null })
        .select("*")
        .maybeSingle();
      setProfile((created as Profile) ?? null);
    }
    if (s) setSettings(s as Settings);
  }, []);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        setSession(data.session);
        try {
          await loadProfile(data.session?.user.id);
        } catch (e) {
          console.log("profile load failed", e);
        }
      })
      .finally(() => setReady(true));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      // Supabase-ийн зөвлөмж: энэ callback дотор шууд өөр supabase дуудлага хийхгүй
      setTimeout(() => {
        loadProfile(s?.user.id).catch(() => {});
        if (s?.user.id) registerPush(s.user.id);
      }, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  // Профайл (эрх, хаагдсан эсэх) болон тохиргоо өөрчлөгдвөл шууд шинэчилнэ
  useLiveSync((e) => {
    const uid = session?.user.id;
    if (uid && (e.table !== "profiles" || !e.id || e.id === uid)) loadProfile(uid);
  }, ["profiles", "settings", "staff_invites"]);

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = makeRedirectUri({ scheme: "mashinzar", path: "auth/callback" });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: Platform.OS !== "web" },
    });
    if (error) throw error;
    if (Platform.OS === "web") return;
    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (res.type !== "success") return;
    const { params, errorCode } = QueryParams.getQueryParams(res.url);
    if (errorCode) throw new Error(errorCode);
    if (params.code) {
      const { error: exErr } = await supabase.auth.exchangeCodeForSession(params.code);
      if (exErr) throw exErr;
    } else if (params.access_token && params.refresh_token) {
      await supabase.auth.setSession({ access_token: params.access_token, refresh_token: params.refresh_token });
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      ready,
      session,
      profile,
      settings,
      refreshProfile: () => loadProfile(session?.user.id),
      signInWithGoogle,
      signOut,
    }),
    [ready, session, profile, settings, loadProfile, signInWithGoogle, signOut],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
}
