import dayjs from "dayjs";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useFoodLogs } from "../../hooks/useFoodDiary";
import { useUserSettings } from "../../hooks/useUserSettings";
import { useVacationDay } from "../../hooks/useVacationDay";
import { applyQuickFillDay } from "../../services/quickfill/quickFillService";
import { resolveDayLimits } from "../../services/settings/userSettingsApi";
import { useAuth } from "../../state/AuthContext";

const QUICK_FILL_LEVELS = [1.25, 1.5, 2, 3];

export default function QuickActionsScreen() {
  const [selectedDate, setSelectedDate] = useState(dayjs().format("YYYY-MM-DD"));
  const { token, signOut } = useAuth();
  const queryClient = useQueryClient();
  const { data: logs } = useFoodLogs(selectedDate);
  const settings = useUserSettings();
  const vacation = useVacationDay(selectedDate);

  const totals = {
    calories: (logs || []).reduce((sum, item) => sum + (item.calories || 0), 0),
    protein: (logs || []).reduce((sum, item) => sum + (item.protein || 0), 0),
    carbs: (logs || []).reduce((sum, item) => sum + (item.carbs || 0), 0),
    fats: (logs || []).reduce((sum, item) => sum + (item.fats || 0), 0),
  };

  const quickFillMutation = useMutation({
    mutationFn: async (multiplier: number) => {
      if (!token) throw new Error("AUTH_REQUIRED");
      if (vacation.isVacationDay) throw new Error("Quick Fill is disabled on vacation days");

      return applyQuickFillDay({
        token,
        date: selectedDate,
        multiplier,
        totals,
        limits: resolveDayLimits(settings.data, selectedDate),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["foodLogs", selectedDate] }),
        queryClient.invalidateQueries({ queryKey: ["nutritionSummary", selectedDate] }),
      ]);
    },
  });

  const onToggleVacation = async () => {
    try {
      const next = await vacation.toggle();
      Alert.alert("Vacation", next ? "Day marked as vacation" : "Vacation removed for this day");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to toggle vacation day";
      if (message === "AUTH_EXPIRED") {
        await signOut();
        return;
      }
      Alert.alert("Vacation error", message);
    }
  };

  const onQuickFill = async (multiplier: number) => {
    try {
      const result = await quickFillMutation.mutateAsync(multiplier);
      if (result.skipped) {
        Alert.alert("Quick Fill", `Already at or above ${Math.round(multiplier * 100)}% target.`);
        return;
      }
      Alert.alert("Quick Fill", `Added ${result.createdEntries} nutrient entries.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Quick Fill failed";
      if (message === "AUTH_EXPIRED") {
        await signOut();
        return;
      }
      Alert.alert("Quick Fill failed", message);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Quick Actions</Text>

        <View style={styles.dateRow}>
          <Pressable onPress={() => setSelectedDate(dayjs(selectedDate).subtract(1, "day").format("YYYY-MM-DD"))} style={styles.dateButton}>
            <Text style={styles.dateButtonText}>◀</Text>
          </Pressable>
          <Text style={styles.dateText}>{dayjs(selectedDate).format("ddd, MMM D")}</Text>
          <Pressable onPress={() => setSelectedDate(dayjs(selectedDate).add(1, "day").format("YYYY-MM-DD"))} style={styles.dateButton}>
            <Text style={styles.dateButtonText}>▶</Text>
          </Pressable>
        </View>

        <Pressable onPress={onToggleVacation} style={[styles.button, vacation.isVacationDay && styles.vacationActive]}>
          <Text style={[styles.buttonText, vacation.isVacationDay && styles.vacationActiveText]}>
            {vacation.isVacationDay ? "🏖️ Unmark Vacation" : "🏖️ Mark Vacation"}
          </Text>
        </Pressable>

        <Text style={styles.text}>Quick Fill for off-plan days</Text>
        <View style={styles.quickFillRow}>
          {QUICK_FILL_LEVELS.map((level) => (
            <Pressable
              key={level}
              onPress={() => onQuickFill(level)}
              disabled={vacation.isVacationDay || quickFillMutation.isPending || settings.isLoading}
              style={[styles.quickFillButton, (vacation.isVacationDay || quickFillMutation.isPending || settings.isLoading) && styles.disabled]}
            >
              <Text style={styles.quickFillText}>{Math.round(level * 100)}%</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.smallText}>
          Uses calorie-first target and logs Quick Fill Protein/Carbs/Fats entries by your macro ratio.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, padding: 20, gap: 12 },
  title: { fontSize: 24, fontWeight: "700", color: "#111827" },
  dateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateButton: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dateButtonText: { color: "#111827", fontWeight: "700" },
  dateText: { fontSize: 14, color: "#374151", fontWeight: "600" },
  button: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  buttonText: { color: "#111827", fontWeight: "700" },
  vacationActive: { backgroundColor: "#f59e0b", borderColor: "#f59e0b" },
  vacationActiveText: { color: "#fff" },
  text: { fontSize: 14, color: "#4b5563" },
  quickFillRow: { flexDirection: "row", gap: 8 },
  quickFillButton: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#ef4444",
    paddingVertical: 10,
    alignItems: "center",
  },
  quickFillText: { color: "#fff", fontWeight: "700" },
  disabled: { opacity: 0.4 },
  smallText: { fontSize: 12, color: "#6b7280" },
});
