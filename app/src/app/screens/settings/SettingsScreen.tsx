import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useUserSettings } from "../../hooks/useUserSettings";
import {
  DAYS_OF_WEEK,
  resolvePerDayLimitsForEdit,
  saveUserSettings,
  type MacroLimits,
  type PerDayLimitsResolved,
} from "../../services/settings/userSettingsApi";
import { useAuth } from "../../state/AuthContext";

export default function SettingsScreen() {
  const { token, signOut } = useAuth();
  const queryClient = useQueryClient();
  const settingsQuery = useUserSettings();

  const [selectedDay, setSelectedDay] = useState<(typeof DAYS_OF_WEEK)[number]>("Monday");
  const [name, setName] = useState("User");
  const [email, setEmail] = useState("user@example.com");
  const [targetWeight, setTargetWeight] = useState("");
  const [dailyCalorieLimit, setDailyCalorieLimit] = useState("2000");
  const [dailyProteinLimit, setDailyProteinLimit] = useState("150");
  const [dailyCarbsLimit, setDailyCarbsLimit] = useState("250");
  const [dailyFatsLimit, setDailyFatsLimit] = useState("65");
  const [perDay, setPerDay] = useState<PerDayLimitsResolved | null>(null);

  useEffect(() => {
    if (!settingsQuery.data) {
      return;
    }

    setName(settingsQuery.data.name || "User");
    setEmail(settingsQuery.data.email || "user@example.com");
    setTargetWeight(settingsQuery.data.targetWeight != null ? String(settingsQuery.data.targetWeight) : "");
    setDailyCalorieLimit(String(Math.round(settingsQuery.data.dailyCalorieLimit ?? 2000)));
    setDailyProteinLimit(String(Math.round(settingsQuery.data.dailyProteinLimit ?? 150)));
    setDailyCarbsLimit(String(Math.round(settingsQuery.data.dailyCarbsLimit ?? 250)));
    setDailyFatsLimit(String(Math.round(settingsQuery.data.dailyFatsLimit ?? 65)));
    setPerDay(resolvePerDayLimitsForEdit(settingsQuery.data));
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!token || !perDay) {
        throw new Error("AUTH_REQUIRED");
      }

      const payload = {
        name,
        email,
        targetWeight: targetWeight.trim() ? Number(targetWeight) : null,
        dailyCalorieLimit: Number(dailyCalorieLimit),
        dailyProteinLimit: Number(dailyProteinLimit),
        dailyCarbsLimit: Number(dailyCarbsLimit),
        dailyFatsLimit: Number(dailyFatsLimit),
        perDayCalorieLimits: perDay,
      };

      if (
        !Number.isFinite(payload.dailyCalorieLimit) ||
        !Number.isFinite(payload.dailyProteinLimit) ||
        !Number.isFinite(payload.dailyCarbsLimit) ||
        !Number.isFinite(payload.dailyFatsLimit)
      ) {
        throw new Error("Daily limits must be valid numbers");
      }

      return saveUserSettings(token, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["userSettings"] });
      Alert.alert("Settings", "Saved successfully");
    },
  });

  const updateDayOverall = (field: keyof MacroLimits, value: string) => {
    if (!perDay) return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;

    setPerDay({
      ...perDay,
      [selectedDay]: {
        ...perDay[selectedDay],
        overall: {
          ...perDay[selectedDay].overall,
          [field]: parsed,
        },
      },
    });
  };

  const updateMealCalories = (meal: "breakfast" | "lunch" | "dinner" | "snacks", value: string) => {
    if (!perDay) return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;

    setPerDay({
      ...perDay,
      [selectedDay]: {
        ...perDay[selectedDay],
        meals: {
          ...perDay[selectedDay].meals,
          [meal]: {
            ...perDay[selectedDay].meals[meal],
            calories: parsed,
          },
        },
      },
    });
  };

  const dayData = perDay?.[selectedDay];

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save settings";
      if (message === "AUTH_EXPIRED") {
        await signOut();
        return;
      }
      Alert.alert("Save failed", message);
    }
  };

  const isAuthExpired = settingsQuery.error instanceof Error && settingsQuery.error.message === "AUTH_EXPIRED";

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Settings</Text>

        {settingsQuery.isLoading ? (
          <View style={styles.statusBox}>
            <ActivityIndicator size="small" color="#ef4444" />
            <Text style={styles.statusText}>Loading settings...</Text>
          </View>
        ) : null}

        {settingsQuery.isError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Failed to load settings</Text>
            <Text style={styles.errorText}>{isAuthExpired ? "Session expired." : (settingsQuery.error as Error).message}</Text>
            <View style={styles.errorRow}>
              {isAuthExpired ? (
                <Pressable onPress={signOut} style={styles.errorSecondaryButton}>
                  <Text style={styles.errorSecondaryText}>Sign in again</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => settingsQuery.refetch()} style={styles.errorPrimaryButton}>
                <Text style={styles.errorPrimaryText}>Retry</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Name" style={styles.input} />
          <TextInput value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" style={styles.input} />
          <TextInput value={targetWeight} onChangeText={setTargetWeight} placeholder="Target weight (kg)" keyboardType="numeric" style={styles.input} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Daily Limits</Text>
          <TextInput value={dailyCalorieLimit} onChangeText={setDailyCalorieLimit} placeholder="Calories" keyboardType="numeric" style={styles.input} />
          <TextInput value={dailyProteinLimit} onChangeText={setDailyProteinLimit} placeholder="Protein (g)" keyboardType="numeric" style={styles.input} />
          <TextInput value={dailyCarbsLimit} onChangeText={setDailyCarbsLimit} placeholder="Carbs (g)" keyboardType="numeric" style={styles.input} />
          <TextInput value={dailyFatsLimit} onChangeText={setDailyFatsLimit} placeholder="Fats (g)" keyboardType="numeric" style={styles.input} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Per-Day Limits</Text>
          <View style={styles.dayRow}>
            {DAYS_OF_WEEK.map((day) => (
              <Pressable key={day} onPress={() => setSelectedDay(day)} style={[styles.dayChip, selectedDay === day && styles.dayChipActive]}>
                <Text style={[styles.dayChipText, selectedDay === day && styles.dayChipTextActive]}>{day.slice(0, 3)}</Text>
              </Pressable>
            ))}
          </View>

          {dayData ? (
            <>
              <Text style={styles.subTitle}>Overall ({selectedDay})</Text>
              <TextInput
                value={String(Math.round(dayData.overall.calories))}
                onChangeText={(v) => updateDayOverall("calories", v)}
                placeholder="Calories"
                keyboardType="numeric"
                style={styles.input}
              />
              <TextInput
                value={String(Math.round(dayData.overall.protein))}
                onChangeText={(v) => updateDayOverall("protein", v)}
                placeholder="Protein (g)"
                keyboardType="numeric"
                style={styles.input}
              />
              <TextInput
                value={String(Math.round(dayData.overall.carbs))}
                onChangeText={(v) => updateDayOverall("carbs", v)}
                placeholder="Carbs (g)"
                keyboardType="numeric"
                style={styles.input}
              />
              <TextInput
                value={String(Math.round(dayData.overall.fats))}
                onChangeText={(v) => updateDayOverall("fats", v)}
                placeholder="Fats (g)"
                keyboardType="numeric"
                style={styles.input}
              />

              <Text style={styles.subTitle}>Meal Calories (used by Quick Fill)</Text>
              <TextInput
                value={String(Math.round(dayData.meals.breakfast.calories))}
                onChangeText={(v) => updateMealCalories("breakfast", v)}
                placeholder="Breakfast calories"
                keyboardType="numeric"
                style={styles.input}
              />
              <TextInput
                value={String(Math.round(dayData.meals.lunch.calories))}
                onChangeText={(v) => updateMealCalories("lunch", v)}
                placeholder="Lunch calories"
                keyboardType="numeric"
                style={styles.input}
              />
              <TextInput
                value={String(Math.round(dayData.meals.dinner.calories))}
                onChangeText={(v) => updateMealCalories("dinner", v)}
                placeholder="Dinner calories"
                keyboardType="numeric"
                style={styles.input}
              />
              <TextInput
                value={String(Math.round(dayData.meals.snacks.calories))}
                onChangeText={(v) => updateMealCalories("snacks", v)}
                placeholder="Snacks calories"
                keyboardType="numeric"
                style={styles.input}
              />
            </>
          ) : null}
        </View>

        <Pressable
          onPress={handleSave}
          accessibilityRole="button"
          accessibilityLabel="Save settings"
          disabled={saveMutation.isPending || settingsQuery.isLoading || settingsQuery.isError}
          style={({ pressed }) => [
            styles.saveButton,
            (pressed || saveMutation.isPending || settingsQuery.isLoading || settingsQuery.isError) && styles.buttonPressed,
          ]}
        >
          <Text style={styles.saveButtonText}>{saveMutation.isPending ? "Saving..." : "Save Settings"}</Text>
        </Pressable>

        <Pressable
          onPress={signOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  container: { padding: 20, gap: 12, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: "700", color: "#111827" },
  card: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
    gap: 8,
    backgroundColor: "#f9fafb",
  },
  statusBox: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusText: { color: "#374151", fontSize: 12 },
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
  errorRow: { flexDirection: "row", gap: 8 },
  errorPrimaryButton: {
    backgroundColor: "#ef4444",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorPrimaryText: { color: "#fff", fontWeight: "700" },
  errorSecondaryButton: {
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorSecondaryText: { color: "#991b1b", fontWeight: "600" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  subTitle: { marginTop: 4, fontSize: 13, color: "#374151", fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  dayRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  dayChip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dayChipActive: { borderColor: "#ef4444", backgroundColor: "#fee2e2" },
  dayChipText: { fontSize: 12, color: "#374151" },
  dayChipTextActive: { color: "#991b1b", fontWeight: "700" },
  saveButton: {
    borderRadius: 12,
    backgroundColor: "#ef4444",
    paddingVertical: 12,
    alignItems: "center",
  },
  saveButtonText: { color: "#fff", fontWeight: "700" },
  button: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonPressed: { opacity: 0.6 },
  buttonText: { color: "#111827", fontWeight: "600" },
});
