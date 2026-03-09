import dayjs from "dayjs";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useNutritionSummary } from "../../hooks/useNutritionSummary";
import { useAuth } from "../../state/AuthContext";

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const today = dayjs().format("YYYY-MM-DD");
  const { data, isLoading, isRefetching, isError, error, refetch } = useNutritionSummary(today);

  const isAuthExpired = error instanceof Error && error.message === "AUTH_EXPIRED";

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Home</Text>
        {user?.name ? <Text style={styles.welcome}>Hi, {user.name}</Text> : null}
        <Text style={styles.subtitle}>Today • {today}</Text>

        {isLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#ef4444" />
            <Text style={styles.text}>Loading daily summary...</Text>
          </View>
        ) : null}

        {isError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Failed to load daily summary</Text>
            <Text style={styles.errorText}>
              {isAuthExpired ? "Session expired. Please sign in again." : (error as Error).message}
            </Text>
            <View style={styles.row}>
              {isAuthExpired ? (
                <Pressable
                  onPress={signOut}
                  accessibilityRole="button"
                  accessibilityLabel="Sign in again"
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
                >
                  <Text style={styles.secondaryButtonText}>Sign in again</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => refetch()}
                accessibilityRole="button"
                accessibilityLabel="Retry loading daily summary"
                style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
              >
                <Text style={styles.primaryButtonText}>Retry</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {data ? (
          <View style={styles.cardsWrap}>
            <View style={styles.mainCard}>
              <Text style={styles.cardLabel}>Calories</Text>
              <Text style={styles.mainValue}>{Math.max(0, data.caloriesConsumed + data.caloriesRemaining)}</Text>
              <Text style={styles.cardSub}>Target kcal</Text>
              <Text style={styles.rowValue}>Consumed: {data.caloriesConsumed}</Text>
              <Text style={styles.rowValue}>Remaining: {data.caloriesRemaining}</Text>
            </View>

            <View style={styles.macroRow}>
              <View style={styles.macroCard}>
                <Text style={styles.cardLabel}>Protein</Text>
                <Text style={styles.macroValue}>{data.protein}g</Text>
                <Text style={styles.cardSub}>/{data.proteinLimit}g</Text>
              </View>
              <View style={styles.macroCard}>
                <Text style={styles.cardLabel}>Carbs</Text>
                <Text style={styles.macroValue}>{data.carbs}g</Text>
                <Text style={styles.cardSub}>/{data.carbsLimit}g</Text>
              </View>
              <View style={styles.macroCard}>
                <Text style={styles.cardLabel}>Fats</Text>
                <Text style={styles.macroValue}>{data.fats}g</Text>
                <Text style={styles.cardSub}>/{data.fatsLimit}g</Text>
              </View>
            </View>
          </View>
        ) : null}

        <Pressable
          onPress={() => refetch()}
          disabled={isRefetching}
          accessibilityRole="button"
          accessibilityLabel="Refresh home summary"
          style={({ pressed }) => [styles.refreshButton, (pressed || isRefetching) && styles.buttonPressed]}
        >
          <Text style={styles.refreshText}>{isRefetching ? "Refreshing..." : "Refresh"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, padding: 20, gap: 12 },
  title: { fontSize: 24, fontWeight: "700", color: "#111827" },
  welcome: { fontSize: 16, color: "#1f2937", fontWeight: "600" },
  subtitle: { fontSize: 13, color: "#6b7280" },
  text: { fontSize: 14, color: "#4b5563" },
  centerBox: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  errorTitle: { color: "#991b1b", fontWeight: "700" },
  errorText: { color: "#b91c1c", fontSize: 12 },
  row: { flexDirection: "row", gap: 8 },
  primaryButton: {
    backgroundColor: "#ef4444",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryButtonText: { color: "#991b1b", fontWeight: "600" },
  buttonPressed: { opacity: 0.7 },
  cardsWrap: { gap: 12 },
  mainCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardLabel: { fontSize: 13, color: "#6b7280", fontWeight: "600" },
  mainValue: { fontSize: 28, fontWeight: "800", color: "#111827" },
  cardSub: { fontSize: 12, color: "#9ca3af" },
  rowValue: { fontSize: 13, color: "#374151", marginTop: 4 },
  macroRow: { flexDirection: "row", gap: 8 },
  macroCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  macroValue: { fontSize: 18, fontWeight: "700", color: "#111827", marginTop: 2 },
  refreshButton: {
    marginTop: "auto",
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  refreshText: { color: "#1f2937", fontWeight: "600" },
});
