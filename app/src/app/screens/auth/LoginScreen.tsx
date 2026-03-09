import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { GOOGLE_OAUTH } from "../../config/env";
import { loginWithGoogleToken } from "../../services/auth/authApi";
import { useAuth } from "../../state/AuthContext";

export default function LoginScreen() {
  const { saveSession } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: GOOGLE_OAUTH.webClientId,
      offlineAccess: false,
    });
  }, []);

  const handleSignIn = async () => {
    try {
      setError(null);
      setLoading(true);
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      await GoogleSignin.signIn();
      const tokens = await GoogleSignin.getTokens();
      if (!tokens.idToken) throw new Error("Google authentication did not return an ID token");
      const data = await loginWithGoogleToken(tokens.idToken);
      await saveSession(data.token, {
        userId: data.userId,
        email: data.email,
        name: data.name,
        profilePictureUrl: data.profilePictureUrl,
      });
    } catch (err: any) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled, no-op
      } else if (err.code === statusCodes.IN_PROGRESS) {
        setError("Sign in already in progress");
      } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setError("Google Play Services not available");
      } else {
        setError(err instanceof Error ? err.message : "Google sign-in failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>SENTINEL Mobile</Text>
        <Text style={styles.subtitle}>Sign in with Google to continue.</Text>

        <Pressable
          onPress={handleSignIn}
          disabled={loading}
          style={({ pressed }) => [styles.button, (loading || pressed) && styles.buttonPressed]}
        >
          {loading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.buttonText}>Continue with Google</Text>}
        </Pressable>

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
  button: { backgroundColor: "#ef4444", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  buttonPressed: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  error: { fontSize: 12, color: "#dc2626" },
});

