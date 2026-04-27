import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
import { useLanguage } from "../../state/LanguageContext";
import { type Language } from "../../utils/i18n";

function MacroInput({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={{ fontSize: 10, fontWeight: "600", color: "#6b7280", textAlign: "center" }}>{label}</Text>
      <TextInput
        value={String(Math.round(value))}
        onChangeText={onChange}
        keyboardType="numeric"
        style={{
          borderWidth: 1,
          borderColor: "#d1fae5",
          borderRadius: 10,
          backgroundColor: "#f8fdfb",
          paddingHorizontal: 6,
          paddingVertical: 8,
          fontSize: 13,
          color: "#111827",
          textAlign: "center",
        }}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const { token, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const queryClient = useQueryClient();
  const settingsQuery = useUserSettings();

  const [selectedDay, setSelectedDay] = useState<(typeof DAYS_OF_WEEK)[number]>("Monday");
  const [name, setName] = useState("User");
  const [email, setEmail] = useState("user@example.com");
  const [targetWeight, setTargetWeight] = useState("");
  const [perDay, setPerDay] = useState<PerDayLimitsResolved | null>(null);

  useEffect(() => {
    if (!settingsQuery.data) {
      return;
    }

    setName(settingsQuery.data.name || "User");
    setEmail(settingsQuery.data.email || "user@example.com");
    setTargetWeight(settingsQuery.data.targetWeight != null ? String(settingsQuery.data.targetWeight) : "");
    setPerDay(resolvePerDayLimitsForEdit(settingsQuery.data));
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!token || !perDay) {
        throw new Error("AUTH_REQUIRED");
      }

      const mondayOverall = perDay.Monday?.overall;
      const payload = {
        name,
        email,
        targetWeight: targetWeight.trim() ? Number(targetWeight) : null,
        dailyCalorieLimit: mondayOverall?.calories ?? 2000,
        dailyProteinLimit: mondayOverall?.protein ?? 150,
        dailyCarbsLimit: mondayOverall?.carbs ?? 250,
        dailyFatsLimit: mondayOverall?.fats ?? 65,
        perDayCalorieLimits: perDay,
        language,
      };

      return saveUserSettings(token, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["userSettings"] });
      Alert.alert(t("settings.title"), t("settings.saved"));
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

  const updateMealMacro = (meal: "breakfast" | "lunch" | "dinner" | "snacks", field: keyof MacroLimits, value: string) => {
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
            [field]: parsed,
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
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>{t("settings.title")}</Text>

        {settingsQuery.isLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#16a34a" />
            <Text style={styles.loadingText}>{t("settings.loadingSettings")}</Text>
          </View>
        ) : null}

        {settingsQuery.isError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>{t("settings.failedToLoadSettings")}</Text>
            <Text style={styles.errorText}>{isAuthExpired ? t("settings.sessionExpired") : (settingsQuery.error as Error).message}</Text>
            <View style={styles.row}>
              {isAuthExpired ? (
                <Pressable onPress={signOut} style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}>
                  <Text style={styles.secondaryBtnText}>{t("settings.signInAgain")}</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => settingsQuery.refetch()} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
                <Text style={styles.primaryBtnText}>{t("settings.retry")}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("settings.profile")}</Text>
          <Text style={styles.fieldLabel}>{t("settings.name")}</Text>
          <TextInput value={name} onChangeText={setName} placeholder={t("settings.name")} style={styles.input} />

          <Text style={styles.fieldLabel}>{t("settings.email")}</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder={t("settings.email")} autoCapitalize="none" style={styles.input} />

          <Text style={styles.fieldLabel}>{t("settings.targetWeight")}</Text>
          <TextInput value={targetWeight} onChangeText={setTargetWeight} placeholder={t("settings.targetWeight")} keyboardType="numeric" style={styles.input} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("settings.language")}</Text>
          <Text style={styles.fieldLabel}>{t("language.selectLanguage")}</Text>
          <View style={styles.langRow}>
            {(["en", "hu"] as Language[]).map((lang) => (
              <Pressable
                key={lang}
                onPress={() => setLanguage(lang)}
                style={[styles.langChip, language === lang && styles.langChipActive]}
              >
                <Text style={[styles.langChipText, language === lang && styles.langChipTextActive]}>
                  {lang === "en" ? t("language.english") : t("language.hungarian")}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("settings.perDayLimits")}</Text>
          <Text style={styles.hint}>{t("settings.hint")}</Text>
          <View style={styles.dayRow}>
            {DAYS_OF_WEEK.map((day) => (
              <Pressable key={day} onPress={() => setSelectedDay(day)} style={[styles.dayChip, selectedDay === day && styles.dayChipActive]}>
                <Text style={[styles.dayChipText, selectedDay === day && styles.dayChipTextActive]}>{day.slice(0, 3)}</Text>
              </Pressable>
            ))}
          </View>

          {dayData ? (
            <>
              <Text style={styles.subLabel}>📊 {t("settings.dailyTotals")} — {selectedDay}</Text>
              <Text style={styles.hint}>{t("settings.hint")}</Text>
              <View style={styles.macroRow}>
                <MacroInput label={t("settings.calories")} value={dayData.overall.calories} onChange={(v) => updateDayOverall("calories", v)} />
                <MacroInput label={t("settings.protein")} value={dayData.overall.protein} onChange={(v) => updateDayOverall("protein", v)} />
                <MacroInput label={t("settings.carbs")} value={dayData.overall.carbs} onChange={(v) => updateDayOverall("carbs", v)} />
                <MacroInput label={t("settings.fats")} value={dayData.overall.fats} onChange={(v) => updateDayOverall("fats", v)} />
              </View>

              <Text style={styles.subLabel}>🍽 {t("settings.perMealTargets")}</Text>
              <Text style={styles.hint}>{t("settings.hint")}</Text>
              {((["breakfast", "lunch", "dinner", "snacks"] as const).map((meal) => {
                const mealNameMap: Record<string, string> = {
                  breakfast: t("meal.breakfast"),
                  lunch: t("meal.lunch"),
                  dinner: t("meal.dinner"),
                  snacks: t("meal.snacks"),
                };
                return (
                  <View key={meal} style={styles.mealSection}>
                    <Text style={styles.mealLabel}>{mealNameMap[meal]}</Text>
                    <View style={styles.macroRow}>
                      <MacroInput label={t("settings.calories")} value={dayData.meals[meal].calories} onChange={(v) => updateMealMacro(meal, "calories", v)} />
                      <MacroInput label={t("settings.protein")} value={dayData.meals[meal].protein} onChange={(v) => updateMealMacro(meal, "protein", v)} />
                      <MacroInput label={t("settings.carbs")} value={dayData.meals[meal].carbs} onChange={(v) => updateMealMacro(meal, "carbs", v)} />
                      <MacroInput label={t("settings.fats")} value={dayData.meals[meal].fats} onChange={(v) => updateMealMacro(meal, "fats", v)} />
                    </View>
                  </View>
                );
              }))}
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
            (pressed || saveMutation.isPending || settingsQuery.isLoading || settingsQuery.isError) && styles.pressed,
          ]}
        >
          {saveMutation.isPending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.saveButtonText}>{t("settings.save")}</Text>}
        </Pressable>

        <Pressable
          onPress={signOut}
          accessibilityRole="button"
          accessibilityLabel={t("common.signOut")}
          style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}
        >
          <Text style={styles.signOutButtonText}>{t("common.signOut")}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fdfb" },
  scroll: { padding: 20, gap: 16, paddingBottom: Platform.OS === "web" ? 80 : 40 },

  pageTitle: { fontSize: 24, fontWeight: "800", color: "#111827" },

  // Loading / error
  centerBox: { backgroundColor: "#f0fdf4", borderRadius: 16, padding: 24, alignItems: "center", gap: 10 },
  loadingText: { fontSize: 14, color: "#4b5563" },
  errorBox: { backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", borderRadius: 16, padding: 14, gap: 8 },
  errorTitle: { color: "#991b1b", fontWeight: "700" },
  errorText: { color: "#b91c1c", fontSize: 12 },
  row: { flexDirection: "row", gap: 8 },
  primaryBtn: { backgroundColor: "#16a34a", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  primaryBtnText: { color: "#fff", fontWeight: "600" },
  secondaryBtn: { borderWidth: 1, borderColor: "#fecaca", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  secondaryBtnText: { color: "#991b1b", fontWeight: "600" },
  pressed: { opacity: 0.7 },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    shadowColor: "#16a34a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: "#9ca3af", letterSpacing: 0.8, textTransform: "uppercase" },
  subLabel: { fontSize: 12, fontWeight: "700", color: "#6b7280", marginTop: 4 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#374151", marginTop: 2 },
  hint: { fontSize: 11, color: "#9ca3af", lineHeight: 16 },
  macroRow: { flexDirection: "row" as const, gap: 6 },
  mealSection: { gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f0fdf4" },
  mealLabel: { fontSize: 12, fontWeight: "700" as const, color: "#374151" },

  // Input
  input: {
    borderWidth: 1,
    borderColor: "#d1fae5",
    borderRadius: 12,
    backgroundColor: "#f8fdfb",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
  },

  // Day chips
  dayRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  dayChip: {
    borderWidth: 1, borderColor: "#d1d5db",
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: "#f9fafb",
  },
  dayChipActive: { borderColor: "#16a34a", backgroundColor: "#dcfce7" },
  dayChipText: { fontSize: 12, color: "#374151", fontWeight: "500" },
  dayChipTextActive: { color: "#166534", fontWeight: "700" },

  // Language chips
  langRow: { flexDirection: "row", gap: 8 },
  langChip: {
    flex: 1, borderWidth: 1, borderColor: "#d1d5db",
    borderRadius: 12, paddingVertical: 10,
    alignItems: "center", backgroundColor: "#f9fafb",
  },
  langChipActive: { borderColor: "#16a34a", backgroundColor: "#dcfce7" },
  langChipText: { fontSize: 14, color: "#374151", fontWeight: "600" },
  langChipTextActive: { color: "#166534", fontWeight: "700" },

  // Buttons
  saveButton: {
    borderRadius: 14,
    backgroundColor: "#16a34a",
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: "#16a34a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  saveButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  signOutButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  signOutButtonText: { color: "#6b7280", fontWeight: "600", fontSize: 15 },
});
