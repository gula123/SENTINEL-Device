import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useDeleteFoodLog, useFoodLogs, useUpdateFoodLog, useAddFoodLog } from "../../hooks/useFoodDiary";
import {
  createCustomFood,
  estimateFoodPer100gWithAi,
  searchFoods,
  type AiFoodEstimate,
  type FoodItem,
  type FoodLogDto,
  type MealType,
} from "../../services/food/foodLogsApi";
import { useUserSettings } from "../../hooks/useUserSettings";
import { useVacationDay } from "../../hooks/useVacationDay";
import { applyQuickFillDay } from "../../services/quickfill/quickFillService";
import { resolveDayLimits } from "../../services/settings/userSettingsApi";
import { useAuth } from "../../state/AuthContext";

const MEAL_ORDER: MealType[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACKS"];
const QUICK_FILL_LEVELS = [1.25, 1.5, 2, 3];

const mealLabel = (meal: MealType): string => {
  if (meal === "BREAKFAST") return "Breakfast";
  if (meal === "LUNCH") return "Lunch";
  if (meal === "DINNER") return "Dinner";
  return "Snacks";
};

export default function DiaryScreen() {
  const [selectedDate, setSelectedDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [selectedMeal, setSelectedMeal] = useState<MealType>("BREAKFAST");
  const [query, setQuery] = useState("");
  const [grams, setGrams] = useState("100");
  const [results, setResults] = useState<FoodItem[]>([]);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [searching, setSearching] = useState(false);
  const [editLogId, setEditLogId] = useState<number | null>(null);
  const [editGrams, setEditGrams] = useState("");
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customFoodName, setCustomFoodName] = useState("");
  const [customCalories, setCustomCalories] = useState("0");
  const [customProtein, setCustomProtein] = useState("0");
  const [customCarbs, setCustomCarbs] = useState("0");
  const [customFats, setCustomFats] = useState("0");
  const [customGrams, setCustomGrams] = useState("100");
  const [aiAssumption, setAiAssumption] = useState("");

  const { token, signOut } = useAuth();
  const queryClient = useQueryClient();
  const { data: logs, isLoading, isError, error, refetch } = useFoodLogs(selectedDate);
  const settingsQuery = useUserSettings();
  const vacation = useVacationDay(selectedDate);
  const addMutation = useAddFoodLog(selectedDate);
  const updateMutation = useUpdateFoodLog(selectedDate);
  const deleteMutation = useDeleteFoodLog(selectedDate);

  const aiEstimateMutation = useMutation({
    mutationFn: async (foodName: string): Promise<AiFoodEstimate> => {
      if (!token) throw new Error("AUTH_REQUIRED");
      return estimateFoodPer100gWithAi(token, foodName);
    },
    onSuccess: (estimate) => {
      setCustomCalories(String(Math.round(estimate.caloriesPer100g)));
      setCustomProtein(String(Math.round(estimate.proteinPer100g * 10) / 10));
      setCustomCarbs(String(Math.round(estimate.carbsPer100g * 10) / 10));
      setCustomFats(String(Math.round(estimate.fatsPer100g * 10) / 10));
      setAiAssumption(estimate.assumption || "AI estimated typical nutrition for this food.");
    },
  });

  const createCustomMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("AUTH_REQUIRED");

      const cals = Number(customCalories);
      const protein = Number(customProtein);
      const carbs = Number(customCarbs);
      const fats = Number(customFats);
      const gramsValue = Number(customGrams);

      if (!customFoodName.trim()) throw new Error("Enter custom food name");
      if (!Number.isFinite(gramsValue) || gramsValue <= 0) throw new Error("Enter valid grams");

      const created = await createCustomFood(token, {
        name: customFoodName.trim(),
        caloriesPer100g: Number.isFinite(cals) ? cals : 0,
        proteinPer100g: Number.isFinite(protein) ? protein : 0,
        carbsPer100g: Number.isFinite(carbs) ? carbs : 0,
        fatsPer100g: Number.isFinite(fats) ? fats : 0,
      });

      await addMutation.mutateAsync({
        foodName: created.name,
        foodId: created.id,
        grams: gramsValue,
        mealType: selectedMeal,
      });

      return created;
    },
  });

  const quickFillMutation = useMutation({
    mutationFn: async (multiplier: number) => {
      if (!token) {
        throw new Error("AUTH_REQUIRED");
      }
      if (vacation.isVacationDay) {
        throw new Error("Quick Fill is disabled on vacation days");
      }

      const limits = resolveDayLimits(settingsQuery.data, selectedDate);
      return applyQuickFillDay({
        token,
        date: selectedDate,
        multiplier,
        totals,
        limits,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["foodLogs", selectedDate] }),
        queryClient.invalidateQueries({ queryKey: ["nutritionSummary", selectedDate] }),
      ]);
    },
  });

  const grouped = useMemo(() => {
    const byMeal: Record<MealType, FoodLogDto[]> = {
      BREAKFAST: [],
      LUNCH: [],
      DINNER: [],
      SNACKS: [],
    };

    (logs || []).forEach((item) => {
      const meal = (item.mealType || "SNACKS") as MealType;
      byMeal[meal].push(item);
    });

    return byMeal;
  }, [logs]);

  const totals = useMemo(() => {
    const items = logs || [];
    return {
      calories: items.reduce((sum, item) => sum + (item.calories || 0), 0),
      protein: items.reduce((sum, item) => sum + (item.protein || 0), 0),
      carbs: items.reduce((sum, item) => sum + (item.carbs || 0), 0),
      fats: items.reduce((sum, item) => sum + (item.fats || 0), 0),
    };
  }, [logs]);

  const onSearch = async (text: string) => {
    setQuery(text);
    setSelectedFood(null);

    if (!token || text.trim().length < 2) {
      setResults([]);
      return;
    }

    try {
      setSearching(true);
      const foods = await searchFoods(token, text);
      setResults(foods.slice(0, 8));
    } catch (searchError) {
      const message = searchError instanceof Error ? searchError.message : "Food search failed";
      Alert.alert("Search failed", message);
    } finally {
      setSearching(false);
    }
  };

  const onAdd = async () => {
    if (vacation.isVacationDay) {
      Alert.alert("Vacation day", "Food logging is disabled for vacation days.");
      return;
    }

    const numericGrams = Number(grams);
    if (!selectedFood) {
      Alert.alert("Select a food", "Search and select one food first.");
      return;
    }
    if (!Number.isFinite(numericGrams) || numericGrams <= 0) {
      Alert.alert("Invalid grams", "Please enter a positive grams value.");
      return;
    }

    try {
      await addMutation.mutateAsync({
        foodName: selectedFood.name,
        foodId: selectedFood.id,
        grams: numericGrams,
        mealType: selectedMeal,
      });

      setQuery("");
      setResults([]);
      setSelectedFood(null);
      setGrams("100");
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : "Failed to add food log";
      if (message === "AUTH_EXPIRED") {
        await signOut();
        return;
      }
      Alert.alert("Add failed", message);
    }
  };

  const onDelete = (logId: number) => {
    Alert.alert("Delete food", "Delete this log entry?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync(logId);
          } catch (mutationError) {
            const message = mutationError instanceof Error ? mutationError.message : "Failed to delete food log";
            if (message === "AUTH_EXPIRED") {
              await signOut();
              return;
            }
            Alert.alert("Delete failed", message);
          }
        },
      },
    ]);
  };

  const onSaveEdit = async () => {
    if (!editLogId) {
      return;
    }
    const numericGrams = Number(editGrams);
    if (!Number.isFinite(numericGrams) || numericGrams <= 0) {
      Alert.alert("Invalid grams", "Please enter a positive grams value.");
      return;
    }

    try {
      await updateMutation.mutateAsync({ logId: editLogId, grams: numericGrams });
      setEditLogId(null);
      setEditGrams("");
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : "Failed to update food log";
      if (message === "AUTH_EXPIRED") {
        await signOut();
        return;
      }
      Alert.alert("Update failed", message);
    }
  };

  const isAuthExpired = error instanceof Error && error.message === "AUTH_EXPIRED";

  const handleToggleVacation = async () => {
    try {
      const next = await vacation.toggle();
      Alert.alert("Vacation", next ? "Day marked as vacation" : "Vacation removed for this day");
    } catch (toggleError) {
      const message = toggleError instanceof Error ? toggleError.message : "Failed to toggle vacation day";
      if (message === "AUTH_EXPIRED") {
        await signOut();
        return;
      }
      Alert.alert("Vacation error", message);
    }
  };

  const handleQuickFill = async (multiplier: number) => {
    try {
      const result = await quickFillMutation.mutateAsync(multiplier);
      if (result.skipped) {
        Alert.alert("Quick Fill", `Already at or above ${Math.round(multiplier * 100)}% target.`);
        return;
      }
      Alert.alert("Quick Fill", `Added ${result.createdEntries} nutrient entries.`);
    } catch (quickFillError) {
      const message = quickFillError instanceof Error ? quickFillError.message : "Quick Fill failed";
      if (message === "AUTH_EXPIRED") {
        await signOut();
        return;
      }
      Alert.alert("Quick Fill failed", message);
    }
  };

  const handleAiEstimate = async () => {
    if (!customFoodName.trim()) {
      Alert.alert("Custom food", "Enter a food name first.");
      return;
    }

    try {
      await aiEstimateMutation.mutateAsync(customFoodName.trim());
    } catch (aiError) {
      const message = aiError instanceof Error ? aiError.message : "AI estimate failed";
      if (message === "AUTH_EXPIRED") {
        await signOut();
        return;
      }
      Alert.alert("AI estimate failed", message);
    }
  };

  const handleCreateCustomAndLog = async () => {
    if (vacation.isVacationDay) {
      Alert.alert("Vacation day", "Food logging is disabled for vacation days.");
      return;
    }

    try {
      await createCustomMutation.mutateAsync();
      setCustomFoodName("");
      setCustomCalories("0");
      setCustomProtein("0");
      setCustomCarbs("0");
      setCustomFats("0");
      setCustomGrams("100");
      setAiAssumption("");
      setShowCustomForm(false);
      Alert.alert("Custom food", "Created and logged successfully.");
    } catch (customError) {
      const message = customError instanceof Error ? customError.message : "Failed to create custom food";
      if (message === "AUTH_EXPIRED") {
        await signOut();
        return;
      }
      Alert.alert("Custom food error", message);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Diary</Text>

        <View style={styles.dateRow}>
          <Pressable onPress={() => setSelectedDate(dayjs(selectedDate).subtract(1, "day").format("YYYY-MM-DD"))} style={styles.dateButton}>
            <Text style={styles.dateButtonText}>◀</Text>
          </Pressable>
          <Text style={styles.dateText}>{dayjs(selectedDate).format("ddd, MMM D")}</Text>
          <Pressable onPress={() => setSelectedDate(dayjs(selectedDate).add(1, "day").format("YYYY-MM-DD"))} style={styles.dateButton}>
            <Text style={styles.dateButtonText}>▶</Text>
          </Pressable>
        </View>

        <View style={styles.actionsCard}>
          <View style={styles.actionsTopRow}>
            <Pressable
              onPress={handleToggleVacation}
              disabled={vacation.isLoading || vacation.isToggling}
              style={({ pressed }) => [
                styles.vacationButton,
                vacation.isVacationDay && styles.vacationButtonActive,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={[styles.vacationButtonText, vacation.isVacationDay && styles.vacationButtonTextActive]}>
                {vacation.isVacationDay ? "🏖️ Unmark Vacation" : "🏖️ Mark Vacation"}
              </Text>
            </Pressable>
            <Text style={styles.actionsHint}>For off-plan days, use Quick Fill</Text>
          </View>

          <View style={styles.quickFillRow}>
            {QUICK_FILL_LEVELS.map((level) => (
              <Pressable
                key={level}
                onPress={() => handleQuickFill(level)}
                disabled={vacation.isVacationDay || quickFillMutation.isPending || settingsQuery.isLoading}
                style={({ pressed }) => [
                  styles.quickFillButton,
                  (vacation.isVacationDay || quickFillMutation.isPending || settingsQuery.isLoading) && styles.disabledButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.quickFillText}>{Math.round(level * 100)}%</Text>
              </Pressable>
            ))}
          </View>
          {vacation.isVacationDay ? <Text style={styles.vacationNote}>Vacation day is excluded from metrics.</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add Food</Text>

          <View style={styles.mealRow}>
            {MEAL_ORDER.map((meal) => (
              <Pressable
                key={meal}
                onPress={() => setSelectedMeal(meal)}
                style={[styles.mealChip, selectedMeal === meal && styles.mealChipActive]}
              >
                <Text style={[styles.mealChipText, selectedMeal === meal && styles.mealChipTextActive]}>{mealLabel(meal)}</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            value={query}
            onChangeText={onSearch}
            placeholder="Search food (min 2 chars)"
            style={styles.input}
          />

          {searching ? <ActivityIndicator size="small" color="#ef4444" /> : null}

          {results.length > 0 ? (
            <View style={styles.resultsWrap}>
              {results.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setSelectedFood(item);
                    setQuery(item.name);
                    setResults([]);
                  }}
                  style={styles.resultItem}
                >
                  <Text style={styles.resultName}>{item.name}</Text>
                  <Text style={styles.resultMeta}>{Math.round(item.calories)} kcal / 100g</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <TextInput
            value={grams}
            onChangeText={setGrams}
            keyboardType="numeric"
            placeholder="Grams"
            style={styles.input}
          />

          <Pressable onPress={onAdd} style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}>
            <Text style={styles.primaryButtonText}>
              {vacation.isVacationDay ? "Vacation Day" : addMutation.isPending ? "Adding..." : "Add to Diary"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setShowCustomForm((prev) => !prev)}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.secondaryButtonText}>{showCustomForm ? "Hide Custom Food" : "Custom Food + AI"}</Text>
          </Pressable>

          {showCustomForm ? (
            <View style={styles.customCard}>
              <Text style={styles.cardTitle}>Custom Food (per 100g)</Text>
              <TextInput
                value={customFoodName}
                onChangeText={setCustomFoodName}
                placeholder="Food name"
                style={styles.input}
              />

              <Pressable onPress={handleAiEstimate} style={({ pressed }) => [styles.aiButton, pressed && styles.buttonPressed]}>
                <Text style={styles.aiButtonText}>{aiEstimateMutation.isPending ? "Estimating..." : "✨ AI Estimate"}</Text>
              </Pressable>

              {aiAssumption ? <Text style={styles.aiAssumption}>{aiAssumption}</Text> : null}

              <TextInput value={customCalories} onChangeText={setCustomCalories} keyboardType="numeric" placeholder="Calories / 100g" style={styles.input} />
              <TextInput value={customProtein} onChangeText={setCustomProtein} keyboardType="numeric" placeholder="Protein / 100g" style={styles.input} />
              <TextInput value={customCarbs} onChangeText={setCustomCarbs} keyboardType="numeric" placeholder="Carbs / 100g" style={styles.input} />
              <TextInput value={customFats} onChangeText={setCustomFats} keyboardType="numeric" placeholder="Fats / 100g" style={styles.input} />
              <TextInput value={customGrams} onChangeText={setCustomGrams} keyboardType="numeric" placeholder="Log grams" style={styles.input} />

              <Pressable onPress={handleCreateCustomAndLog} style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}>
                <Text style={styles.primaryButtonText}>{createCustomMutation.isPending ? "Saving..." : "Create & Log"}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#ef4444" />
          </View>
        ) : null}

        {isError ? (
          <View style={styles.errorWrap}>
            <Text style={styles.errorTitle}>Could not load diary</Text>
            <Text style={styles.errorText}>{isAuthExpired ? "Session expired." : (error as Error).message}</Text>
            <View style={styles.errorActions}>
              {isAuthExpired ? (
                <Pressable onPress={signOut} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Sign in again</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => refetch()} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Retry</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.totalCard}>
          <Text style={styles.cardTitle}>Daily Totals</Text>
          <Text style={styles.totalText}>
            {Math.round(totals.calories)} kcal • P {Math.round(totals.protein)}g • C {Math.round(totals.carbs)}g • F {Math.round(totals.fats)}g
          </Text>
        </View>

        {MEAL_ORDER.map((meal) => {
          const items = grouped[meal];
          return (
            <View key={meal} style={styles.mealCard}>
              <Text style={styles.cardTitle}>{mealLabel(meal)}</Text>
              {items.length === 0 ? (
                <Text style={styles.emptyText}>No entries</Text>
              ) : (
                items.map((item) => (
                  <View key={item.id} style={styles.logRow}>
                    <View style={styles.logInfo}>
                      <Text style={styles.logName}>{item.foodName}</Text>
                      <Text style={styles.logMeta}>
                        {Math.round(item.calories)} kcal • {Math.round(item.grams)}g
                      </Text>
                    </View>
                    <View style={styles.logActions}>
                      <Pressable
                        onPress={() => {
                          setEditLogId(item.id);
                          setEditGrams(String(Math.round(item.grams)));
                        }}
                        style={styles.smallButton}
                      >
                        <Text style={styles.smallButtonText}>Edit</Text>
                      </Pressable>
                      <Pressable onPress={() => onDelete(item.id)} style={[styles.smallButton, styles.deleteButton]}>
                        <Text style={[styles.smallButtonText, styles.deleteText]}>Del</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>
          );
        })}

        {editLogId ? (
          <View style={styles.editCard}>
            <Text style={styles.cardTitle}>Edit grams</Text>
            <TextInput
              value={editGrams}
              onChangeText={setEditGrams}
              keyboardType="numeric"
              style={styles.input}
              placeholder="Grams"
            />
            <View style={styles.editActions}>
              <Pressable onPress={() => { setEditLogId(null); setEditGrams(""); }} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={onSaveEdit} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>{updateMutation.isPending ? "Saving..." : "Save"}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  container: { padding: 16, gap: 12, paddingBottom: 40 },
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
  card: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 8,
  },
  cardTitle: { fontSize: 14, color: "#111827", fontWeight: "700" },
  actionsCard: {
    backgroundColor: "#fff7ed",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#fed7aa",
    gap: 10,
  },
  actionsTopRow: { gap: 6 },
  actionsHint: { fontSize: 12, color: "#9a3412" },
  vacationButton: {
    borderWidth: 1,
    borderColor: "#fdba74",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  vacationButtonActive: {
    backgroundColor: "#f59e0b",
    borderColor: "#f59e0b",
  },
  vacationButtonText: { color: "#9a3412", fontWeight: "700", fontSize: 12 },
  vacationButtonTextActive: { color: "#fff" },
  quickFillRow: { flexDirection: "row", gap: 6 },
  quickFillButton: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#ef4444",
    paddingVertical: 8,
    alignItems: "center",
  },
  quickFillText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  disabledButton: { opacity: 0.4 },
  vacationNote: { fontSize: 12, color: "#92400e" },
  mealRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  mealChip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  mealChipActive: { borderColor: "#ef4444", backgroundColor: "#fee2e2" },
  mealChipText: { fontSize: 12, color: "#374151" },
  mealChipTextActive: { color: "#991b1b", fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  resultsWrap: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  resultItem: { paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  resultName: { color: "#111827", fontSize: 13, fontWeight: "600" },
  resultMeta: { color: "#6b7280", fontSize: 12 },
  primaryButton: {
    backgroundColor: "#ef4444",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontWeight: "700" },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#111827", fontWeight: "600" },
  customCard: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#ddd6fe",
    borderRadius: 10,
    backgroundColor: "#f5f3ff",
    padding: 10,
    gap: 8,
  },
  aiButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#c4b5fd",
    backgroundColor: "#ede9fe",
    paddingVertical: 8,
    alignItems: "center",
  },
  aiButtonText: { color: "#5b21b6", fontWeight: "700", fontSize: 12 },
  aiAssumption: { fontSize: 12, color: "#6d28d9" },
  buttonPressed: { opacity: 0.7 },
  loadingWrap: { paddingVertical: 16, alignItems: "center" },
  errorWrap: {
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
  totalCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  totalText: { color: "#374151", fontSize: 13, fontWeight: "600" },
  mealCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  emptyText: { color: "#9ca3af", fontSize: 12 },
  logRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingTop: 8,
  },
  logInfo: { flex: 1 },
  logName: { color: "#111827", fontWeight: "600", fontSize: 13 },
  logMeta: { color: "#6b7280", fontSize: 12 },
  logActions: { flexDirection: "row", gap: 6 },
  smallButton: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  smallButtonText: { color: "#374151", fontSize: 12, fontWeight: "600" },
  deleteButton: { borderColor: "#fecaca" },
  deleteText: { color: "#b91c1c" },
  editCard: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fcd34d",
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  editActions: { flexDirection: "row", gap: 8 },
});
