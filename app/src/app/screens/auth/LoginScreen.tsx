import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { GOOGLE_OAUTH } from "../../config/env";
import { loginWithGoogleToken } from "../../services/auth/authApi";
import { useAuth } from "../../state/AuthContext";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { saveSession } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const hasGoogleConfig = useMemo(
    () => Boolean(GOOGLE_OAUTH.webClientId || GOOGLE_OAUTH.expoClientId || GOOGLE_OAUTH.androidClientId || GOOGLE_OAUTH.iosClientId),
    []
  );

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_OAUTH.expoClientId || GOOGLE_OAUTH.webClientId || undefined,
    androidClientId: GOOGLE_OAUTH.androidClientId || undefined,
    iosClientId: GOOGLE_OAUTH.iosClientId || undefined,
    webClientId: GOOGLE_OAUTH.webClientId || undefined,
    scopes: ["openid", "profile", "email"],
    responseType: "id_token",
    selectAccount: true,
  });

  useEffect(() => {
    const run = async () => {
      if (response?.type === "error") {
        setError(response.error?.message || "Google sign-in failed");
        return;
      }

      if (response?.type !== "success") {
        return;
      }

      try {
        setError(null);
        const idToken = response.authentication?.idToken || (response.params?.id_token as string | undefined);
        if (!idToken) {
          throw new Error("Google authentication did not return an ID token");
        }

        const data = await loginWithGoogleToken(idToken);
        await saveSession(data.token, {
          userId: data.userId,
          email: data.email,
          name: data.name,
          profilePictureUrl: data.profilePictureUrl,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Google sign-in failed";
        setError(message);
      }
    };

    run();
  }, [response, saveSession]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>SENTINEL Mobile</Text>
        <Text style={styles.subtitle}>Sign in with Google to continue.</Text>

        <Pressable
          onPress={() => promptAsync()}
          disabled={!request || !hasGoogleConfig}
          style={({ pressed }) => [
            styles.button,
            (!request || !hasGoogleConfig || pressed) && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>Continue with Google</Text>
        </Pressable>

        {!hasGoogleConfig && (
          <Text style={styles.caption}>Set EXPO_PUBLIC_GOOGLE_* client IDs in .env to enable sign-in.</Text>
        )}

        {response?.type === "success" && <ActivityIndicator size="small" color="#ef4444" />}

        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, padding: 24, justifyContent: "center", gap: 16 },
  title: { fontSize: 28, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 14, color: "#4b5563", lineHeight: 20 },
  button: {
    backgroundColor: "#ef4444",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.6,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  caption: { fontSize: 12, color: "#6b7280" },
  error: { fontSize: 12, color: "#dc2626" },
});
