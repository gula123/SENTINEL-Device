import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../../navigation/navigationTypes";
import { useAddFoodLog } from "../../hooks/useFoodDiary";
import {
  createFoodPortion,
  createCustomFood,
  estimateFoodPer100gWithAi,
  fetchFoodPortions,
  fetchPortionTypes,
  type PortionDto,
  type PortionTypeDto,
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

type Props = NativeStackScreenProps<MainStackParamList, "SearchFood">;

export default function SearchFoodScreen({ route, navigation }: Props) {
  const { meal, date } = route.params;

  const [query, setQuery] = useState("");
  const [grams, setGrams] = useState("100");
  const [portionAmount, setPortionAmount] = useState("1");
  const [selectedPortionId, setSelectedPortionId] = useState<number | null>(null);
  const [results, setResults] = useState<FoodItem[]>([]);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [portions, setPortions] = useState<PortionDto[]>([]);
  const [portionTypes, setPortionTypes] = useState<PortionTypeDto[]>([]);
  const [showAddPortionForm, setShowAddPortionForm] = useState(false);
  const [newPortionTypeCode, setNewPortionTypeCode] = useState("");
  const [newPortionGrams, setNewPortionGrams] = useState("100");
  const [searching, setSearching] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customBrandOrPlace, setCustomBrandOrPlace] = useState("");
  const [customCalories, setCustomCalories] = useState("0");
  const [customProtein, setCustomProtein] = useState("0");
  const [customCarbs, setCustomCarbs] = useState("0");
  const [customFats, setCustomFats] = useState("0");
  const [customGrams, setCustomGrams] = useState("100");
  const [aiNote, setAiNote] = useState("");

  const { token, signOut } = useAuth();
  const queryClient = useQueryClient();
  const addMutation = useAddFoodLog(date);

  const selectedPortion = useMemo(
    () => portions.find((portion) => portion.id === selectedPortionId) || null,
    [portions, selectedPortionId]
  );

  const resolvedGrams = useMemo(() => {
    if (selectedPortion) {
      const parsedAmount = Number(portionAmount);
      const amount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;
      return Math.round(selectedPortion.grams * amount * 10) / 10;
    }

    const parsedGrams = Number(grams);
    return Number.isFinite(parsedGrams) && parsedGrams > 0 ? parsedGrams : 0;
  }, [selectedPortion, portionAmount, grams]);

  const selectedFoodPreview = useMemo(() => {
    if (!selectedFood) return null;
    const factor = resolvedGrams / 100;
    return {
      grams: resolvedGrams,
      calories: Math.round(selectedFood.calories * factor),
      protein: Math.round(selectedFood.protein * factor * 10) / 10,
      carbs: Math.round(selectedFood.carbs * factor * 10) / 10,
      fats: Math.round(selectedFood.fats * factor * 10) / 10,
    };
  }, [selectedFood, resolvedGrams]);

  const customFoodPreview = useMemo(() => {
    const parsedGrams = Number(customGrams);
    const g = Number.isFinite(parsedGrams) && parsedGrams > 0 ? parsedGrams : 0;
    const factor = g / 100;
    const calories = Number(customCalories) || 0;
    const protein = Number(customProtein) || 0;
    const carbs = Number(customCarbs) || 0;
    const fats = Number(customFats) || 0;

    return {
      grams: g,
      calories: Math.round(calories * factor),
      protein: Math.round(protein * factor * 10) / 10,
      carbs: Math.round(carbs * factor * 10) / 10,
      fats: Math.round(fats * factor * 10) / 10,
    };
  }, [customCalories, customProtein, customCarbs, customFats, customGrams]);

  const aiMutation = useMutation({
    mutationFn: async (name: string): Promise<AiFoodEstimate> => {
      if (!token) throw new Error("AUTH_REQUIRED");
      return estimateFoodPer100gWithAi(token, name, customBrandOrPlace.trim() || undefined);
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
        brandOrPlace: customBrandOrPlace.trim() || undefined,
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
      setCustomName("");
      setCustomCalories("0");
      setCustomProtein("0");
      setCustomCarbs("0");
      setCustomFats("0");
      setCustomGrams("100");
      setCustomBrandOrPlace("");
      setAiNote("");
      setShowCustom(false);
      invalidate();
      Alert.alert("Done", `Custom food logged to ${MEAL_LABEL[meal]}.`);
    },
    onError: handleError,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["foodLogs", date] });
    queryClient.invalidateQueries({ queryKey: ["nutritionSummary", date] });
    queryClient.invalidateQueries({ queryKey: ["diaryDay", date] });
  }

  function handleError(err: unknown) {
    const msg = err instanceof Error ? err.message : "Something went wrong";
    if (msg === "AUTH_EXPIRED") {
      signOut();
      return;
    }
    Alert.alert("Error", msg);
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const loadPortionTypes = async () => {
      try {
        const types = await fetchPortionTypes(token);
        if (!cancelled) {
          setPortionTypes(types);
        }
      } catch (err) {
        if (!cancelled) {
          handleError(err);
        }
      }
    };

    loadPortionTypes();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!token || debouncedQuery.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    if (selectedFood && debouncedQuery.trim().toLowerCase() === selectedFood.name.trim().toLowerCase()) {
      setSearching(false);
      return;
    }

    let cancelled = false;

    const runSearch = async () => {
      try {
        setSearching(true);
        const foods = await searchFoods(token, debouncedQuery);
        if (!cancelled) {
          setResults(foods.slice(0, 8));
        }
      } catch (err) {
        if (!cancelled) {
          Alert.alert("Search failed", err instanceof Error ? err.message : "Try again");
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    };

    runSearch();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, token, selectedFood]);

  const onSearch = (text: string) => {
    setQuery(text);
    setSelectedFood(null);
    setSelectedPortionId(null);
    setPortionAmount("1");
    setPortions([]);
    setShowAddPortionForm(false);
    setNewPortionTypeCode("");
    setNewPortionGrams("100");
    if (text.trim().length < 2) {
      setResults([]);
      setSearching(false);
    }
  };

  const onAdd = async () => {
    const g = resolvedGrams;
    if (!selectedFood) {
      Alert.alert("Select a food", "Search and tap a result first.");
      return;
    }
    if (!Number.isFinite(g) || g <= 0) {
      Alert.alert("Invalid grams", "Enter a positive number.");
      return;
    }
    try {
      await addMutation.mutateAsync({
        foodName: selectedFood.name,
        foodId: selectedFood.id,
        grams: g,
        mealType: meal,
      });
      invalidate();
      setQuery("");
      setResults([]);
      setSelectedFood(null);
      setSelectedPortionId(null);
      setPortionAmount("1");
      setGrams("100");
      Alert.alert("Added", `Food added to ${MEAL_LABEL[meal]}.`);
    } catch (err) {
      handleError(err);
    }
  };

  const onChangeGrams = (value: string) => {
    setGrams(value);
  };

  const onChangePortionAmount = (value: string) => {
    setPortionAmount(value);
  };

  const onSelectPortion = (portion: PortionDto) => {
    setSelectedPortionId(portion.id);
    setPortionAmount("1");
    setGrams(String(Math.round(portion.grams * 10) / 10));
  };

  const onSelectGramMode = () => {
    if (selectedPortion) {
      setGrams(String(resolvedGrams));
    }
    setSelectedPortionId(null);
    setPortionAmount("1");
  };

  const onAiEstimate = async () => {
    if (!customName.trim()) {
      Alert.alert("Enter a food name first.");
      return;
    }
    try {
      await aiMutation.mutateAsync(customName.trim());
    } catch (err) {
      handleError(err);
    }
  };

  const availablePortionTypes = useMemo(() => {
    return portionTypes.filter((type) =>
      !portions.some((portion) => (portion.portionTypeCode || "").toLowerCase() === type.code.toLowerCase())
    );
  }, [portionTypes, portions]);

  const loadPortionsForFood = async (foodId: number) => {
    if (!token) return;
    const data = await fetchFoodPortions(token, foodId);
    setPortions(data);
  };

  const onCreatePortionForFood = async () => {
    if (!token || !selectedFood) {
      Alert.alert("Select a food first");
      return;
    }

    if (!newPortionTypeCode) {
      Alert.alert("Choose portion type", "Please select a portion type.");
      return;
    }

    const gramsValue = Number(newPortionGrams);
    if (!Number.isFinite(gramsValue) || gramsValue <= 0) {
      Alert.alert("Invalid grams", "Enter a positive number.");
      return;
    }

    try {
      const created = await createFoodPortion(token, {
        foodId: selectedFood.id,
        portionTypeCode: newPortionTypeCode,
        grams: gramsValue,
      });

      await loadPortionsForFood(selectedFood.id);
      setSelectedPortionId(created.id);
      setPortionAmount("1");
      setGrams(String(Math.round(created.grams * 10) / 10));
      setShowAddPortionForm(false);
      setNewPortionTypeCode("");
      setNewPortionGrams("100");
    } catch (err) {
      handleError(err);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={s.header}>
          <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [s.backBtn, pressed && s.pressed]}>
            <Text style={s.backIcon}>←</Text>
          </Pressable>
          <View style={s.headerTitle}>
            <Text style={s.headerIcon}>{MEAL_ICON[meal]}</Text>
            <Text style={s.headerText}>Search Food</Text>
          </View>
          <Text style={s.headerDate}>{MEAL_LABEL[meal]}</Text>
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.contextCard}>
            <Text style={s.contextTitle}>Adding To</Text>
            <Text style={s.contextText}>{MEAL_LABEL[meal]}</Text>
            <Text style={s.contextDate}>{date}</Text>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Search Food</Text>
            {selectedFood ? (
              <View style={s.selectedChip}>
                <View style={{ flex: 1 }}>
                  <Text style={s.selectedChipText} numberOfLines={1}>✓ {selectedFood.name}</Text>
                  {selectedFood.brandOrPlace ? (
                    <Text style={s.selectedChipSubText} numberOfLines={1}>{selectedFood.brandOrPlace}</Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => {
                    setSelectedFood(null);
                    setQuery("");
                    setResults([]);
                    setSelectedPortionId(null);
                    setPortionAmount("1");
                    setPortions([]);
                    setShowAddPortionForm(false);
                    setNewPortionTypeCode("");
                    setNewPortionGrams("100");
                  }}
                  style={({ pressed }) => [s.clearBtn, pressed && s.pressed]}
                  accessibilityLabel="Clear selected food"
                >
                  <Text style={s.clearBtnText}>✕</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <TextInput
                  value={query}
                  onChangeText={onSearch}
                  placeholder="Type at least 2 characters..."
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
                        onPress={async () => {
                          setSelectedFood(item);
                          setQuery(item.name);
                          setResults([]);
                          setSelectedPortionId(null);
                          setPortionAmount("1");
                          setShowAddPortionForm(false);
                          setNewPortionTypeCode("");
                          setNewPortionGrams("100");
                          try {
                            await loadPortionsForFood(item.id);
                          } catch (err) {
                            handleError(err);
                          }
                        }}
                        style={({ pressed }) => [s.resultRow, pressed && s.pressed]}
                      >
                        <View style={s.resultTextCol}>
                          <Text style={s.resultName}>{item.name}</Text>
                          {item.brandOrPlace ? <Text style={s.resultSubmeta}>{item.brandOrPlace}</Text> : null}
                        </View>
                        <Text style={s.resultMeta}>{Math.round(item.calories)} kcal/100g</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </>
            )}

            {selectedFoodPreview ? (
              <View style={s.previewBox}>
                <Text style={s.previewTitle}>
                  {selectedPortion
                    ? `Will add (${portionAmount || "0"} x ${selectedPortion.portionName} = ${selectedFoodPreview.grams}g)`
                    : `Will add (${selectedFoodPreview.grams}g)`}
                </Text>
                <View style={s.previewRow}>
                  <Text style={s.previewItem}>🔥 {selectedFoodPreview.calories} kcal</Text>
                  <Text style={s.previewItem}>🥩 {selectedFoodPreview.protein}g P</Text>
                  <Text style={s.previewItem}>🍚 {selectedFoodPreview.carbs}g C</Text>
                  <Text style={s.previewItem}>🥑 {selectedFoodPreview.fats}g F</Text>
                </View>
              </View>
            ) : null}

            <View style={s.row}>
              <TextInput
                value={selectedPortion ? portionAmount : grams}
                onChangeText={selectedPortion ? onChangePortionAmount : onChangeGrams}
                keyboardType="numeric"
                placeholder={selectedPortion ? "Amount" : "Grams"}
                placeholderTextColor="#9ca3af"
                style={[s.input, s.gramsInput]}
                returnKeyType="done"
              />
              <Pressable
                onPress={onAdd}
                disabled={addMutation.isPending || !selectedFood}
                style={({ pressed }) => [s.addBtn, (!selectedFood || addMutation.isPending) && s.addBtnDisabled, pressed && s.pressed]}
              >
                <Text style={s.addBtnText}>{addMutation.isPending ? "Adding..." : "Add"}</Text>
              </Pressable>
            </View>

            {selectedPortion ? (
              <Text style={s.portionAmountHint}>
                Qty x {selectedPortion.portionName} = {Math.round(selectedFoodPreview?.grams ?? 0)}g
              </Text>
            ) : null}

            {selectedFood && portions.length > 0 ? (
              <View style={s.portionWrap}>
                <Text style={s.portionLabel}>Portions for this food</Text>
                <View style={s.portionRow}>
                  <Pressable
                    onPress={onSelectGramMode}
                    style={({ pressed }) => [
                      s.portionChip,
                      selectedPortionId === null && s.portionChipActive,
                      pressed && s.pressed,
                    ]}
                  >
                    <Text style={[
                      s.portionChipText,
                      selectedPortionId === null && s.portionChipTextActive,
                    ]}>Grams</Text>
                  </Pressable>
                  {portions.map((portion) => (
                    <Pressable
                      key={portion.id}
                      onPress={() => onSelectPortion(portion)}
                      style={({ pressed }) => [
                        s.portionChip,
                        selectedPortionId === portion.id && s.portionChipActive,
                        pressed && s.pressed,
                      ]}
                    >
                      <Text style={[
                        s.portionChipText,
                        selectedPortionId === portion.id && s.portionChipTextActive,
                      ]}>{portion.portionName} ({Math.round(portion.grams)}g)</Text>
                    </Pressable>
                  ))}
                  <Pressable
                    onPress={() => setShowAddPortionForm((v) => !v)}
                    style={({ pressed }) => [s.portionChipAdd, pressed && s.pressed]}
                  >
                    <Text style={s.portionChipAddText}>+ Add another portion</Text>
                  </Pressable>
                </View>
              </View>
            ) : selectedFood ? (
              <View style={s.portionWrap}>
                <Text style={s.portionLabel}>No saved portions yet</Text>
                <Pressable
                  onPress={() => setShowAddPortionForm((v) => !v)}
                  style={({ pressed }) => [s.portionChipAdd, pressed && s.pressed]}
                >
                  <Text style={s.portionChipAddText}>+ Add first portion</Text>
                </Pressable>
              </View>
            ) : null}

            {selectedFood && showAddPortionForm ? (
              <View style={s.addPortionBox}>
                <Text style={s.addPortionTitle}>Add portion for {selectedFood.name}</Text>
                <View style={s.portionRow}>
                  {availablePortionTypes.map((type) => (
                    <Pressable
                      key={type.id}
                      onPress={() => setNewPortionTypeCode(type.code)}
                      style={({ pressed }) => [
                        s.typeChip,
                        newPortionTypeCode === type.code && s.typeChipActive,
                        pressed && s.pressed,
                      ]}
                    >
                      <Text style={[s.typeChipText, newPortionTypeCode === type.code && s.typeChipTextActive]}>{type.label}</Text>
                    </Pressable>
                  ))}
                </View>

                <View style={s.row}>
                  <TextInput
                    value={newPortionGrams}
                    onChangeText={setNewPortionGrams}
                    keyboardType="numeric"
                    placeholder="Grams"
                    placeholderTextColor="#9ca3af"
                    style={[s.input, s.gramsInput]}
                  />
                  <Pressable onPress={onCreatePortionForFood} style={({ pressed }) => [s.addBtn, pressed && s.pressed]}>
                    <Text style={s.addBtnText}>Save portion</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>

          <Pressable
            onPress={() => setShowCustom((v) => !v)}
            style={({ pressed }) => [s.customToggle, pressed && s.pressed]}
          >
            <Text style={s.customToggleText}>{showCustom ? "▲ Hide Create New Food" : "▼ Create New Food"}</Text>
          </Pressable>

          {showCustom ? (
            <View style={s.card}>
              <Text style={s.cardTitle}>Create New Food (per 100g)</Text>
              <Text style={s.helperText}>Enter nutrition values per 100g for the new food, then set log grams for what you ate now.</Text>

              <TextInput value={customName} onChangeText={setCustomName} placeholder="Food name" placeholderTextColor="#9ca3af" style={s.input} />
              <TextInput value={customBrandOrPlace} onChangeText={setCustomBrandOrPlace} placeholder="Brand or place" placeholderTextColor="#9ca3af" style={s.input} />

              <Pressable onPress={onAiEstimate} style={({ pressed }) => [s.aiBtn, pressed && s.pressed]}>
                <Text style={s.aiBtnText}>{aiMutation.isPending ? "Estimating..." : "AI Estimate"}</Text>
              </Pressable>
              {aiNote ? <Text style={s.aiNote}>{aiNote}</Text> : null}

              <TextInput value={customCalories} onChangeText={setCustomCalories} keyboardType="numeric" placeholder="Calories / 100g" placeholderTextColor="#9ca3af" style={s.input} />
              <TextInput value={customProtein} onChangeText={setCustomProtein} keyboardType="numeric" placeholder="Protein g / 100g" placeholderTextColor="#9ca3af" style={s.input} />
              <TextInput value={customCarbs} onChangeText={setCustomCarbs} keyboardType="numeric" placeholder="Carbs g / 100g" placeholderTextColor="#9ca3af" style={s.input} />
              <TextInput value={customFats} onChangeText={setCustomFats} keyboardType="numeric" placeholder="Fats g / 100g" placeholderTextColor="#9ca3af" style={s.input} />
              <TextInput value={customGrams} onChangeText={setCustomGrams} keyboardType="numeric" placeholder="Log grams" placeholderTextColor="#9ca3af" style={s.input} />

              {customFoodPreview ? (
                <View style={s.previewBox}>
                  <Text style={s.previewTitle}>Will be logged ({customFoodPreview.grams}g)</Text>
                  <View style={s.previewRow}>
                    <Text style={s.previewItem}>🔥 {customFoodPreview.calories} kcal</Text>
                    <Text style={s.previewItem}>🥩 {customFoodPreview.protein}g P</Text>
                    <Text style={s.previewItem}>🍚 {customFoodPreview.carbs}g C</Text>
                    <Text style={s.previewItem}>🥑 {customFoodPreview.fats}g F</Text>
                  </View>
                </View>
              ) : null}

              <Pressable
                onPress={() => createCustomMutation.mutate()}
                disabled={createCustomMutation.isPending}
                style={({ pressed }) => [s.addBtn, pressed && s.pressed]}
              >
                <Text style={s.addBtnText}>{createCustomMutation.isPending ? "Saving..." : "Create & Log"}</Text>
              </Pressable>
            </View>
          ) : null}

          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back to meal statistics"
            style={({ pressed }) => [s.doneBtn, pressed && s.pressed]}
          >
            <Text style={s.doneBtnText}>Back to Meal Statistics</Text>
          </Pressable>
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: { fontSize: 18, color: "#374151", lineHeight: 22 },
  headerTitle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  headerIcon: { fontSize: 20 },
  headerText: { fontSize: 18, fontWeight: "700", color: "#111827" },
  headerDate: { fontSize: 12, color: "#16a34a", fontWeight: "700" },

  scroll: { padding: 16, gap: 12, paddingBottom: 40 },

  contextCard: {
    backgroundColor: "#ecfdf5",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    gap: 2,
  },
  contextTitle: { fontSize: 11, color: "#047857", textTransform: "uppercase", fontWeight: "700" },
  contextText: { fontSize: 16, color: "#064e3b", fontWeight: "700" },
  contextDate: { fontSize: 12, color: "#065f46" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
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
  helperText: { fontSize: 12, color: "#6b7280", lineHeight: 17 },

  results: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    overflow: "hidden",
  },
  previewBox: {
    borderWidth: 1,
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  previewTitle: { fontSize: 12, color: "#166534", fontWeight: "700" },
  previewRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  previewItem: { fontSize: 12, color: "#374151", fontWeight: "600" },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    backgroundColor: "#fff",
  },
  resultTextCol: { flex: 1, marginRight: 8 },
  resultName: { fontSize: 13, color: "#111827" },
  resultSubmeta: { fontSize: 11, color: "#6b7280", marginTop: 2, fontWeight: "500" },
  resultMeta: { fontSize: 12, color: "#9ca3af" },

  selectedChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dcfce7",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    gap: 8,
  },
  selectedChipText: { flex: 1, fontSize: 13, color: "#166534", fontWeight: "600" },
  selectedChipSubText: { fontSize: 11, color: "#6b7280", fontWeight: "500", marginTop: 2 },
  clearBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#bbf7d0",
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtnText: { fontSize: 13, color: "#166534", fontWeight: "700", lineHeight: 16 },

  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  gramsInput: { flex: 1 },
  portionAmountHint: { fontSize: 11, color: "#6b7280", marginTop: -2 },
  portionWrap: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 10,
    gap: 8,
    backgroundColor: "#f9fafb",
  },
  portionLabel: { fontSize: 12, color: "#6b7280", fontWeight: "600" },
  portionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  portionChip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  portionChipActive: {
    borderColor: "#16a34a",
    backgroundColor: "#dcfce7",
  },
  portionChipText: { fontSize: 11, color: "#374151", fontWeight: "600" },
  portionChipTextActive: { fontSize: 11, color: "#166534", fontWeight: "600" },
  portionChipAdd: {
    borderWidth: 1,
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  portionChipAddText: { fontSize: 11, color: "#166534", fontWeight: "700" },
  addPortionBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 10,
    padding: 10,
    gap: 8,
    backgroundColor: "#f0fdf4",
  },
  addPortionTitle: { fontSize: 12, color: "#166534", fontWeight: "700" },
  typeChip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  typeChipActive: { borderColor: "#16a34a", backgroundColor: "#dcfce7" },
  typeChipText: { fontSize: 11, color: "#374151", fontWeight: "600" },
  typeChipTextActive: { color: "#166534" },

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

  doneBtn: {
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  doneBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  pressed: { opacity: 0.65 },
});
