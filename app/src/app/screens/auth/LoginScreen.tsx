import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import * as AuthSession from "expo-auth-session";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { GOOGLE_OAUTH } from "../../config/env";
import { loginWithGoogleToken } from "../../services/auth/authApi";
import { useAuth } from "../../state/AuthContext";

WebBrowser.maybeCompleteAuthSession();

// Computed once so the same URI is used in both the auth request and the code exchange.
// Log it so you can verify the exact string to register in Google Console.
const WEB_REDIRECT_URI = Platform.OS === "web" ? AuthSession.makeRedirectUri() : "";
if (Platform.OS === "web") console.log("[Auth] Redirect URI:", WEB_REDIRECT_URI);

const getNativeSignIn = () => {
  if (Platform.OS === "web") return null;
  return require("@react-native-google-signin/google-signin");
};

export default function LoginScreen() {
  const { saveSession } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") {
      const { GoogleSignin } = getNativeSignIn();
      GoogleSignin.configure({ webClientId: GOOGLE_OAUTH.webClientId, offlineAccess: false });
    }
  }, []);

  const [request, response, promptAsync] = Google.useAuthRequest(
    Platform.OS === "web"
      ? {
          clientId: GOOGLE_OAUTH.webClientId || undefined,
          scopes: ["openid", "profile", "email"],
          // id_token implicit flow — Google returns id_token directly in the fragment.
          // No backend code exchange = no client_secret needed (Web client type restriction).
          responseType: AuthSession.ResponseType.IdToken,
          usePKCE: false,
          redirectUri: WEB_REDIRECT_URI,
        }
      : {
          // Android uses @react-native-google-signin (never calls promptAsync),
          // but the hook requires androidClientId to be defined or it throws.
          androidClientId: GOOGLE_OAUTH.androidClientId || undefined,
        }
  );

  useEffect(() => {
    if (Platform.OS !== "web" || response?.type !== "success") return;
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log("[Auth] Web response:", JSON.stringify({ type: response.type, params: response.params, hasAuthentication: !!response.authentication, idToken: response.authentication?.idToken }));

        // id_token implicit flow: Google puts id_token in the fragment params directly
        let idToken: string | undefined =
          response.authentication?.idToken ??
          (response.params?.id_token as string | undefined) ??
          undefined;

        // Fallback: auto-exchange failed (usually a redirect URI mismatch) — try manually
        if (!idToken && response.params?.code && request?.codeVerifier) {
          console.log("[Auth] Auto-exchange missing idToken, trying manual PKCE exchange...");
          const tokenResponse = await AuthSession.exchangeCodeAsync(
            { clientId: GOOGLE_OAUTH.webClientId, code: response.params.code, redirectUri: WEB_REDIRECT_URI, codeVerifier: request.codeVerifier },
            { tokenEndpoint: "https://oauth2.googleapis.com/token" }
          );
          idToken = tokenResponse.idToken ?? undefined;
          console.log("[Auth] Manual exchange idToken present:", !!idToken);
        }

        if (!idToken) throw new Error("Google did not return an ID token");
        const data = await loginWithGoogleToken(idToken);
        await saveSession(data.token, { userId: data.userId, email: data.email, name: data.name, profilePictureUrl: data.profilePictureUrl });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sign-in failed");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [response]);

  const handlePress = async () => {
    setError(null);
    if (Platform.OS === "web") {
      promptAsync().catch((err: any) => setError(err?.message ?? "Sign-in failed"));
      return;
    }
    const { GoogleSignin, statusCodes } = getNativeSignIn();
    try {
      setLoading(true);
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      await GoogleSignin.signIn();
      const tokens = await GoogleSignin.getTokens();
      if (!tokens.idToken) throw new Error("Google did not return an ID token");
      const data = await loginWithGoogleToken(tokens.idToken);
      await saveSession(data.token, { userId: data.userId, email: data.email, name: data.name, profilePictureUrl: data.profilePictureUrl });
    } catch (err: any) {
      if (err.code === statusCodes?.SIGN_IN_CANCELLED) return;
      setError(err instanceof Error ? err.message : "Sign-in failed");
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
          onPress={handlePress}
          disabled={loading || (Platform.OS === "web" && !request)}
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
