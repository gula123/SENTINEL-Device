import dayjs from "dayjs";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../../navigation/navigationTypes";
import { useAddFoodLog } from "../../hooks/useFoodDiary";
import {
  createCustomFood,
  estimateFoodPer100gWithAi,
  searchFoods,
  type AiFoodEstimate,
  type FoodItem,
  type MealType,
} from "../../services/food/foodLogsApi";
import { useAuth } from "../../state/AuthContext";

const MEAL_LABEL: Record<MealType, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACKS: "Snacks",
};
const MEAL_ICON: Record<MealType, string> = {
  BREAKFAST: "☀️",
  LUNCH: "🌤️",
  DINNER: "🌙",
  SNACKS: "🍎",
};

type Props = NativeStackScreenProps<MainStackParamList, "LogFood">;

export default function LogFoodScreen({ route, navigation }: Props) {
  const { meal, date } = route.params;

  const [query, setQuery] = useState("");
  const [grams, setGrams] = useState("100");
  const [results, setResults] = useState<FoodItem[]>([]);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [searching, setSearching] = useState(false);

  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customCalories, setCustomCalories] = useState("0");
  const [customProtein, setCustomProtein] = useState("0");
  const [customCarbs, setCustomCarbs] = useState("0");
  const [customFats, setCustomFats] = useState("0");
  const [customGrams, setCustomGrams] = useState("100");
  const [aiNote, setAiNote] = useState("");

  const { token, signOut } = useAuth();
  const queryClient = useQueryClient();
  const addMutation = useAddFoodLog(date);

  const aiMutation = useMutation({
    mutationFn: async (name: string): Promise<AiFoodEstimate> => {
      if (!token) throw new Error("AUTH_REQUIRED");
      return estimateFoodPer100gWithAi(token, name);
    },
    onSuccess: (e) => {
      setCustomCalories(String(Math.round(e.caloriesPer100g)));
      setCustomProtein(String(Math.round(e.proteinPer100g * 10) / 10));
      setCustomCarbs(String(Math.round(e.carbsPer100g * 10) / 10));
      setCustomFats(String(Math.round(e.fatsPer100g * 10) / 10));
      setAiNote(e.assumption || "AI estimated typical nutrition for this food.");
    },
  });

  const createCustomMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("AUTH_REQUIRED");
      if (!customName.trim()) throw new Error("Enter a food name");
      const g = Number(customGrams);
      if (!Number.isFinite(g) || g <= 0) throw new Error("Enter valid grams");

      const created = await createCustomFood(token, {
        name: customName.trim(),
        caloriesPer100g: Number(customCalories) || 0,
        proteinPer100g: Number(customProtein) || 0,
        carbsPer100g: Number(customCarbs) || 0,
        fatsPer100g: Number(customFats) || 0,
      });

      await addMutation.mutateAsync({
        foodName: created.name,
        foodId: created.id,
        grams: g,
        mealType: meal,
      });
    },
    onSuccess: () => {
      setCustomName(""); setCustomCalories("0"); setCustomProtein("0");
      setCustomCarbs("0"); setCustomFats("0"); setCustomGrams("100");
      setAiNote(""); setShowCustom(false);
      invalidate();
      Alert.alert("Done", "Custom food logged.");
    },
    onError: handleError,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["foodLogs", date] });
    queryClient.invalidateQueries({ queryKey: ["nutritionSummary", date] });
  }

  function handleError(err: unknown) {
    const msg = err instanceof Error ? err.message : "Something went wrong";
    if (msg === "AUTH_EXPIRED") { signOut(); return; }
    Alert.alert("Error", msg);
  }

  const onSearch = async (text: string) => {
    setQuery(text);
    setSelectedFood(null);
    if (!token || text.trim().length < 2) { setResults([]); return; }
    try {
      setSearching(true);
      const foods = await searchFoods(token, text);
      setResults(foods.slice(0, 8));
    } catch (err) {
      Alert.alert("Search failed", err instanceof Error ? err.message : "Try again");
    } finally {
      setSearching(false);
    }
  };

  const onAdd = async () => {
    const g = Number(grams);
    if (!selectedFood) { Alert.alert("Select a food", "Search and tap a result first."); return; }
    if (!Number.isFinite(g) || g <= 0) { Alert.alert("Invalid grams", "Enter a positive number."); return; }
    try {
      await addMutation.mutateAsync({ foodName: selectedFood.name, foodId: selectedFood.id, grams: g, mealType: meal });
      invalidate();
      setQuery(""); setResults([]); setSelectedFood(null); setGrams("100");
    } catch (err) {
      handleError(err);
    }
  };

  const onAiEstimate = async () => {
    if (!customName.trim()) { Alert.alert("Enter a food name first."); return; }
    try { await aiMutation.mutateAsync(customName.trim()); }
    catch (err) { handleError(err); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [s.backBtn, pressed && s.pressed]}>
            <Text style={s.backIcon}>←</Text>
          </Pressable>
          <View style={s.headerTitle}>
            <Text style={s.headerIcon}>{MEAL_ICON[meal]}</Text>
            <Text style={s.headerText}>{MEAL_LABEL[meal]}</Text>
          </View>
          <Text style={s.headerDate}>{dayjs(date).format("MMM D")}</Text>
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Search card */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Search Food</Text>
            <TextInput
              value={query}
              onChangeText={onSearch}
              placeholder="Type at least 2 characters…"
              placeholderTextColor="#9ca3af"
              style={s.input}
              autoFocus
              returnKeyType="search"
            />

            {searching ? <ActivityIndicator size="small" color="#16a34a" style={{ marginTop: 6 }} /> : null}

            {results.length > 0 ? (
              <View style={s.results}>
                {results.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => { setSelectedFood(item); setQuery(item.name); setResults([]); }}
                    style={({ pressed }) => [s.resultRow, pressed && s.pressed]}
                  >
                    <Text style={s.resultName}>{item.name}</Text>
                    <Text style={s.resultMeta}>{Math.round(item.calories)} kcal/100g</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {selectedFood ? (
              <View style={s.selectedBadge}>
                <Text style={s.selectedText}>✓ {selectedFood.name}</Text>
              </View>
            ) : null}

            <View style={s.row}>
              <TextInput
                value={grams}
                onChangeText={setGrams}
                keyboardType="numeric"
                placeholder="Grams"
                placeholderTextColor="#9ca3af"
                style={[s.input, s.gramsInput]}
                returnKeyType="done"
              />
              <Pressable
                onPress={onAdd}
                disabled={addMutation.isPending || !selectedFood}
                style={({ pressed }) => [s.addBtn, (!selectedFood || addMutation.isPending) && s.addBtnDisabled, pressed && s.pressed]}
              >
                <Text style={s.addBtnText}>{addMutation.isPending ? "Adding…" : "Add"}</Text>
              </Pressable>
            </View>
          </View>

          {/* Custom food */}
          <Pressable
            onPress={() => setShowCustom((v) => !v)}
            style={({ pressed }) => [s.customToggle, pressed && s.pressed]}
          >
            <Text style={s.customToggleText}>{showCustom ? "▲ Hide Custom Food" : "▼ Custom Food + AI"}</Text>
          </Pressable>

          {showCustom ? (
            <View style={s.card}>
              <Text style={s.cardTitle}>Custom Food (per 100g)</Text>

              <TextInput value={customName} onChangeText={setCustomName} placeholder="Food name" placeholderTextColor="#9ca3af" style={s.input} />

              <Pressable onPress={onAiEstimate} style={({ pressed }) => [s.aiBtn, pressed && s.pressed]}>
                <Text style={s.aiBtnText}>{aiMutation.isPending ? "Estimating…" : "✨ AI Estimate"}</Text>
              </Pressable>
              {aiNote ? <Text style={s.aiNote}>{aiNote}</Text> : null}

              <TextInput value={customCalories} onChangeText={setCustomCalories} keyboardType="numeric" placeholder="Calories / 100g" placeholderTextColor="#9ca3af" style={s.input} />
              <TextInput value={customProtein} onChangeText={setCustomProtein} keyboardType="numeric" placeholder="Protein g / 100g" placeholderTextColor="#9ca3af" style={s.input} />
              <TextInput value={customCarbs} onChangeText={setCustomCarbs} keyboardType="numeric" placeholder="Carbs g / 100g" placeholderTextColor="#9ca3af" style={s.input} />
              <TextInput value={customFats} onChangeText={setCustomFats} keyboardType="numeric" placeholder="Fats g / 100g" placeholderTextColor="#9ca3af" style={s.input} />
              <TextInput value={customGrams} onChangeText={setCustomGrams} keyboardType="numeric" placeholder="Log grams" placeholderTextColor="#9ca3af" style={s.input} />

              <Pressable
                onPress={() => createCustomMutation.mutate()}
                disabled={createCustomMutation.isPending}
                style={({ pressed }) => [s.addBtn, pressed && s.pressed]}
              >
                <Text style={s.addBtnText}>{createCustomMutation.isPending ? "Saving…" : "Create & Log"}</Text>
              </Pressable>
            </View>
          ) : null}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fdfb" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    gap: 10,
  },
  backBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: { fontSize: 18, color: "#374151", lineHeight: 22 },
  headerTitle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  headerIcon: { fontSize: 20 },
  headerText: { fontSize: 18, fontWeight: "700", color: "#111827" },
  headerDate: { fontSize: 12, color: "#9ca3af", fontWeight: "600" },

  scroll: { padding: 16, gap: 12, paddingBottom: 40 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTitle: { fontSize: 11, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.8 },

  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#f9fafb",
  },

  results: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    overflow: "hidden",
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    backgroundColor: "#fff",
  },
  resultName: { flex: 1, fontSize: 13, color: "#111827", marginRight: 8 },
  resultMeta: { fontSize: 12, color: "#9ca3af" },

  selectedBadge: {
    backgroundColor: "#dcfce7",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  selectedText: { fontSize: 13, color: "#166534", fontWeight: "600" },

  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  gramsInput: { flex: 1 },

  addBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 80,
  },
  addBtnDisabled: { backgroundColor: "#d1d5db" },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  customToggle: {
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  customToggleText: { fontSize: 13, color: "#6b7280", fontWeight: "600" },

  aiBtn: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  aiBtnText: { fontSize: 13, fontWeight: "700", color: "#166534" },
  aiNote: { fontSize: 11, color: "#6b7280", fontStyle: "italic" },

  pressed: { opacity: 0.65 },
});
