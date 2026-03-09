import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useCalendarData } from "../../hooks/useCalendarData";
import { useAuth } from "../../state/AuthContext";

const CELL_SIZE = 38;

export default function ProgressScreen() {
  const [month, setMonth] = useState(dayjs().startOf("month"));
  const { signOut } = useAuth();
  const yearMonth = month.format("YYYY-MM");
  const { data, isLoading, isError, error, refetch } = useCalendarData(yearMonth);

  const firstDay = month.startOf("month");
  const daysInMonth = month.daysInMonth();
  const startOffset = (firstDay.day() + 6) % 7;

  const cells = useMemo(() => {
    const pre = Array.from({ length: startOffset }, (_, index) => ({ key: `empty-${index}`, day: 0 }));
    const days = Array.from({ length: daysInMonth }, (_, index) => ({ key: `day-${index + 1}`, day: index + 1 }));
    return [...pre, ...days];
  }, [startOffset, daysInMonth]);

  const isAuthExpired = error instanceof Error && error.message === "AUTH_EXPIRED";

  const statusForDay = (day: number): "vacation" | "green" | "red" | "active" | "none" => {
    if (!day || !data) return "none";
    if (data.vacationDays?.includes(day)) return "vacation";
    if (data.greenDays?.includes(day)) return "green";
    if (data.redDays?.includes(day)) return "red";
    if (data.activeDays?.includes(day)) return "active";
    return "none";
  };

  const cellStyle = (status: ReturnType<typeof statusForDay>) => {
    if (status === "vacation") return [styles.dayCell, styles.vacationCell];
    if (status === "green") return [styles.dayCell, styles.greenCell];
    if (status === "red") return [styles.dayCell, styles.redCell];
    if (status === "active") return [styles.dayCell, styles.activeCell];
    return [styles.dayCell];
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Progress</Text>

        <View style={styles.monthRow}>
          <Pressable
            onPress={() => setMonth((prev) => prev.subtract(1, "month"))}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            style={styles.monthButton}
          >
            <Text style={styles.monthButtonText}>◀</Text>
          </Pressable>
          <Text style={styles.monthText}>{month.format("MMMM YYYY")}</Text>
          <Pressable
            onPress={() => setMonth((prev) => prev.add(1, "month"))}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            style={styles.monthButton}
          >
            <Text style={styles.monthButtonText}>▶</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#ef4444" />
            <Text style={styles.text}>Loading monthly data...</Text>
          </View>
        ) : null}

        {isError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Failed to load progress</Text>
            <Text style={styles.errorText}>{isAuthExpired ? "Session expired." : (error as Error).message}</Text>
            <View style={styles.errorActions}>
              {isAuthExpired ? (
                <Pressable onPress={signOut} accessibilityRole="button" accessibilityLabel="Sign in again" style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Sign in again</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => refetch()} accessibilityRole="button" accessibilityLabel="Retry loading progress" style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Retry</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {data ? (
          <>
            <View style={styles.statRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Current Streak</Text>
                <Text style={styles.statValue}>{data.streak}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Missed Target</Text>
                <Text style={styles.statValue}>{data.daysMissedTarget}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Vacation Days</Text>
                <Text style={styles.statValue}>{data.vacationDays?.length || 0}</Text>
              </View>
            </View>

            <View style={styles.legendRow}>
              <Text style={styles.legendItem}>🟢 within limit</Text>
              <Text style={styles.legendItem}>🔴 over limit</Text>
              <Text style={styles.legendItem}>🏖️ vacation</Text>
            </View>

            <View style={styles.weekdaysRow}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
                <Text key={label} style={styles.weekdayText}>{label}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {cells.map((cell) => {
                if (cell.day === 0) {
                  return <View key={cell.key} style={[styles.dayCell, styles.emptyCell]} />;
                }

                const status = statusForDay(cell.day);
                return (
                  <View
                    key={cell.key}
                    style={cellStyle(status)}
                    accessible
                    accessibilityRole="text"
                    accessibilityLabel={`Day ${cell.day}, ${status}`}
                  >
                    <Text style={styles.dayNumber}>{cell.day}</Text>
                    {status === "vacation" ? <Text style={styles.dayEmoji}>🏖️</Text> : null}
                  </View>
                );
              })}
            </View>
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, padding: 20, gap: 12 },
  title: { fontSize: 24, fontWeight: "700", color: "#111827" },
  text: { fontSize: 14, color: "#4b5563" },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthButton: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  monthButtonText: { color: "#111827", fontWeight: "700" },
  monthText: { fontSize: 16, color: "#111827", fontWeight: "700" },
  centerBox: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    gap: 8,
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  errorTitle: { color: "#991b1b", fontWeight: "700" },
  errorText: { color: "#b91c1c", fontSize: 12 },
  errorActions: { flexDirection: "row", gap: 8 },
  primaryButton: {
    backgroundColor: "#ef4444",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  primaryButtonText: { color: "#fff", fontWeight: "700" },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryButtonText: { color: "#111827", fontWeight: "600" },
  statRow: { flexDirection: "row", gap: 8 },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#f9fafb",
  },
  statLabel: { fontSize: 11, color: "#6b7280" },
  statValue: { marginTop: 4, fontSize: 18, color: "#111827", fontWeight: "800" },
  legendRow: { flexDirection: "row", justifyContent: "space-between" },
  legendItem: { fontSize: 11, color: "#6b7280" },
  weekdaysRow: { flexDirection: "row", justifyContent: "space-between" },
  weekdayText: { width: CELL_SIZE, textAlign: "center", color: "#6b7280", fontSize: 11 },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    position: "relative",
  },
  emptyCell: { borderColor: "transparent", backgroundColor: "transparent" },
  greenCell: { backgroundColor: "#dcfce7", borderColor: "#86efac" },
  redCell: { backgroundColor: "#fee2e2", borderColor: "#fca5a5" },
  vacationCell: { backgroundColor: "#fef3c7", borderColor: "#fcd34d" },
  activeCell: { backgroundColor: "#f3f4f6", borderColor: "#d1d5db" },
  dayNumber: { fontSize: 12, color: "#111827", fontWeight: "600" },
  dayEmoji: { position: "absolute", bottom: -2, right: -1, fontSize: 10 },
});
