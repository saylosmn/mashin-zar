import { useEffect } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useFonts, Onest_400Regular, Onest_500Medium, Onest_600SemiBold, Onest_700Bold } from "@expo-google-fonts/onest";
import { Unbounded_700Bold } from "@expo-google-fonts/unbounded";
import { JetBrainsMono_500Medium, JetBrainsMono_700Bold } from "@expo-google-fonts/jetbrains-mono";
import { AuthProvider, useAuth } from "@/lib/auth";
import { OfflineBanner } from "@/components/OfflineBanner";
import { UpdateBanner } from "@/components/UpdateBanner";
import { AppVersionBanner } from "@/components/AppVersionBanner";
import { usePushRouting } from "@/lib/push";
import { C } from "@/lib/theme";
import Splash from "@/components/Splash";
import Blocked from "@/components/Blocked";

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootStack() {
  const { ready, session, profile } = useAuth();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  usePushRouting(!!session && ready);
  if (!ready) return <Splash />;
  if (session && profile?.is_blocked) return <Blocked />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.paper }, animation: "fade_from_bottom", animationDuration: 180 }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="ads/[id]" />
        <Stack.Screen name="post" />
        <Stack.Screen name="complete-profile" />
        <Stack.Screen name="success" options={{ gestureEnabled: false }} />
        <Stack.Screen name="panel/ad/[id]" />
        <Stack.Screen name="panel/users" />
        <Stack.Screen name="panel/settings" />
        <Stack.Screen name="panel/broadcasts" />
        <Stack.Screen name="panel/reports" />
        <Stack.Screen name="edit/[id]" />
        <Stack.Screen name="loans" />
        <Stack.Screen name="panel/leasing" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    Onest_400Regular,
    Onest_500Medium,
    Onest_600SemiBold,
    Onest_700Bold,
    Unbounded_700Bold,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: C.ink }} />;
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <SafeAreaView edges={["top"]} style={{ backgroundColor: C.paper }}>
          <OfflineBanner />
          <UpdateBanner />
          <AppVersionBanner />
        </SafeAreaView>
        <View style={{ flex: 1 }}>
          <RootStack />
        </View>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
