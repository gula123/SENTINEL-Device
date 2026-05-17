import { useEffect, useMemo, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../../navigation/navigationTypes";
import {
  fetchFoodPortions,
  fetchPortionTypes,
  searchFoods,
  type FoodItem,
  type PortionDto,
  type PortionTypeDto,
} from "../../services/food/foodLogsApi";
import { useAuth } from "../../state/AuthContext";
import { useLanguage } from "../../state/LanguageContext";
import { setPendingRecipeFood } from "../../state/recipeFoodPicker";

type Props = NativeStackScreenProps<MainStackParamList, "SearchRecipeFood">;

export default function SearchRecipeFoodScreen({ navigation, route }: Props) {
  const { token, signOut } = useAuth();
  const { t } = useLanguage();

  const [query, setQuery] = useState("");
  const [grams, setGrams] = useState("100");
  const [portionAmount, setPortionAmount] = useState("1");
  const [selectedPortionId, setSelectedPortionId] = useState<number | null>(null);
  const [results, setResults] = useState<FoodItem[]>([]);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [portions, setPortions] = useState<PortionDto[]>([]);
  const [portionTypes, setPortionTypes] = useState<PortionTypeDto[]>([]);
  const [searching, setSearching] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!token) return;
    fetchPortionTypes(token).then(setPortionTypes).catch(() => {});
  }, [token]);

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
        if (!cancelled) setResults(foods.slice(0, 12));
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Search failed";
        if (msg === "AUTH_EXPIRED") { signOut(); return; }
        Alert.alert("Error", msg);
      } finally {
        if (!cancelled) setSearching(false);
      }
    };
    runSearch();
    return () => { cancelled = true; };
  }, [debouncedQuery, token, signOut, selectedFood]);

  const selectedPortion = useMemo(
    () => portions.find((p) => p.id === selectedPortionId) || null,
    [portions, selectedPortionId]
  );

  const resolvedGrams = useMemo(() => {
    if (selectedPortion) {
      const a = Number(portionAmount);
      return Number.isFinite(a) && a > 0 ? Math.round(selectedPortion.grams * a * 10) / 10 : 0;
    }
    const g = Number(grams);
    return Number.isFinite(g) && g > 0 ? g : 0;
  }, [selectedPortion, portionAmount, grams]);

  const preview = useMemo(() => {
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

  function handleError(err: unknown) {
    const msg = err instanceof Error ? err.message : "Something went wrong";
    if (msg === "AUTH_EXPIRED") { signOut(); return; }
    Alert.alert("Error", msg);
  }

  const loadPortions = async (foodId: number) => {
    if (!token) return;
    try {
      const data = await fetchFoodPortions(token, foodId);
      setPortions(data);
    } catch (err) {
      handleError(err);
    }
  };

  const onSelectFood = async (food: FoodItem) => {
    setSelectedFood(food);
    setQuery(food.name);
    setResults([]);
    setSelectedPortionId(null);
    setPortionAmount("1");
    setGrams("100");
    await loadPortions(food.id);
  };

  const onAdd = () => {
    if (!selectedFood) return;
    if (!Number.isFinite(resolvedGrams) || resolvedGrams <= 0) {
      Alert.alert(t("searchFood.invalidGrams"), t("searchFood.positiveNumber"));
      return;
    }
    setPendingRecipeFood(selectedFood, resolvedGrams);
    navigation.goBack();
  };

  const onClear = () => {
    setSelectedFood(null);
    setQuery("");
    setResults([]);
    setPortions([]);
    setSelectedPortionId(null);
    setPortionAmount("1");
    setGrams("100");
  };

  const onSearch = (text: string) => {
    setQuery(text);
    setSelectedFood(null);
    setSelectedPortionId(null);
    setPortionAmount("1");
    setPortions([]);
    if (text.trim().length < 2) {
      setResults([]);
      setSearching(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={s.header}>
          <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [s.backBtn, pressed && s.pressed]}>
            <Ionicons name="chevron-back" size={20} color="#374151" />
          </Pressable>
          <Text style={s.headerText}>{t("recipes.searchIngredients")}</Text>
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.card}>
            <Text style={s.cardTitle}>{t("searchFood.cardTitle")}</Text>

            {selectedFood ? (
              <View style={s.selectedChip}>
                <View style={{ flex: 1 }}>
                  <Text style={s.selectedChipText} numberOfLines={1}>✓ {selectedFood.name}</Text>
                  {selectedFood.brandOrPlace ? (
                    <Text style={s.selectedChipSubText} numberOfLines={1}>{selectedFood.brandOrPlace}</Text>
                  ) : null}
                </View>
                <Pressable onPress={onClear} style={({ pressed }) => [s.clearBtn, pressed && s.pressed]}>
                  <Text style={s.clearBtnText}>✕</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <TextInput
                  value={query}
                  onChangeText={onSearch}
                  placeholder={t("searchFood.placeholder")}
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
                        onPress={() => onSelectFood(item)}
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
                {query.trim().length > 0 && !searching ? (
                  <View style={s.createFoodSection}>
                    <Text style={s.createFoodLabel}>Can't find what you're looking for?</Text>
                    <Pressable
                      onPress={() => navigation.navigate("CreateFood", { meal: route.params.meal, date: route.params.date, returnTo: "recipe" })}
                      style={({ pressed }) => [s.createFoodBtn, pressed && s.pressed]}
                    >
                      <Ionicons name="add-circle-outline" size={14} color="#16a34a" />
                      <Text style={s.createFoodBtnText}>Create new food</Text>
                    </Pressable>
                  </View>
                ) : null}
              </>
            )}

            {selectedFood && portions.length > 0 ? (
              <View style={s.portionWrap}>
                <Text style={s.portionLabel}>{t("searchFood.portions")}</Text>
                <View style={s.portionRow}>
                  <Pressable
                    onPress={() => { setSelectedPortionId(null); setPortionAmount("1"); }}
                    style={({ pressed }) => [s.portionChip, selectedPortionId === null && s.portionChipActive, pressed && s.pressed]}
                  >
                    <Text style={[s.portionChipText, selectedPortionId === null && s.portionChipTextActive]}>{t("searchFood.gramChip")}</Text>
                  </Pressable>
                  {portions.map((portion) => (
                    <Pressable
                      key={portion.id}
                      onPress={() => { setSelectedPortionId(portion.id); setPortionAmount("1"); setGrams(String(Math.round(portion.grams * 10) / 10)); }}
                      style={({ pressed }) => [s.portionChip, selectedPortionId === portion.id && s.portionChipActive, pressed && s.pressed]}
                    >
                      <Text style={[s.portionChipText, selectedPortionId === portion.id && s.portionChipTextActive]}>
                        {portion.portionName} ({Math.round(portion.grams)}g)
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {preview ? (
              <View style={s.previewBox}>
                <Text style={s.previewTitle}>
                  {selectedPortion
                    ? `Will add (${portionAmount || "0"} x ${selectedPortion.portionName} = ${preview.grams}g)`
                    : `Will add (${preview.grams}g)`}
                </Text>
                <View style={s.previewRow}>
                  <Text style={s.previewItem}>🔥 {preview.calories} kcal</Text>
                  <Text style={s.previewItem}>🥩 {preview.protein}g P</Text>
                  <Text style={s.previewItem}>🍚 {preview.carbs}g C</Text>
                  <Text style={s.previewItem}>🥑 {preview.fats}g F</Text>
                </View>
              </View>
            ) : null}

            {selectedFood ? (
              <View style={s.row}>
                {selectedPortion ? (
                  <TextInput
                    value={portionAmount}
                    onChangeText={setPortionAmount}
                    keyboardType="numeric"
                    placeholder="Amount"
                    placeholderTextColor="#9ca3af"
                    style={[s.input, s.gramsInput]}
                    returnKeyType="done"
                  />
                ) : (
                  <TextInput
                    value={grams}
                    onChangeText={setGrams}
                    keyboardType="numeric"
                    placeholder={t("searchFood.grams")}
                    placeholderTextColor="#9ca3af"
                    style={[s.input, s.gramsInput]}
                    returnKeyType="done"
                  />
                )}
                <Pressable onPress={onAdd} style={({ pressed }) => [s.addBtn, pressed && s.pressed]}>
                  <Text style={s.addBtnText}>{t("searchFood.add")}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
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
  headerText: { fontSize: 18, fontWeight: "700", color: "#111827" },
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
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
  portionWrap: {
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
  portionChipActive: { borderColor: "#16a34a", backgroundColor: "#dcfce7" },
  portionChipText: { fontSize: 11, color: "#374151", fontWeight: "600" },
  portionChipTextActive: { fontSize: 11, color: "#166534", fontWeight: "600" },
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
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  createFoodSection: { borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 12, marginTop: 4, gap: 8 },
  createFoodLabel: { fontSize: 13, color: "#374151", fontWeight: "600" },
  createFoodBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, alignSelf: "flex-start" },
  createFoodBtnText: { fontSize: 13, color: "#16a34a", fontWeight: "600" },
  pressed: { opacity: 0.65 },
});
