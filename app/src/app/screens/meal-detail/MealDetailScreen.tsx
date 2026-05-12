import { useCallback, useEffect, useState } from "react";
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
import { useFocusEffect } from "@react-navigation/native";
import type { MainStackParamList } from "../../navigation/navigationTypes";
import { useLanguage } from "../../state/LanguageContext";
import { useAuth } from "../../state/AuthContext";
import { fetchFoodPortions, type FoodItem, type PortionDto } from "../../services/food/foodLogsApi";
import { consumePendingMealFood } from "../../state/mealFoodPicker";
import { useCreateSavedMeal, useDeleteSavedMeal, useUpdateSavedMeal, useSavedMeals } from "../../hooks/useSavedMeals";

type Props = NativeStackScreenProps<MainStackParamList, "MealDetail">;

interface MealItemDraft {
  foodId: number;
  foodName: string;
  brandOrPlace?: string;
  grams: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatsPer100g: number;
}

export default function MealDetailScreen({ route, navigation }: Props) {
  const { meal, date, editMealId } = route.params;
  const { t } = useLanguage();
  const { token, signOut } = useAuth();

  const isEdit = editMealId !== undefined;

  const [mealName, setMealName] = useState("");
  const [items, setItems] = useState<MealItemDraft[]>([]);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [editingGrams, setEditingGrams] = useState("");
  const [editingSelectedPortionId, setEditingSelectedPortionId] = useState<number | null>(null);
  const [editingPortionAmount, setEditingPortionAmount] = useState("1");
  const [portionsByFoodId, setPortionsByFoodId] = useState<Record<number, PortionDto[]>>({});
  const [loadingPortionsFoodIds, setLoadingPortionsFoodIds] = useState<Record<number, boolean>>({});

  const savedMealsQuery = useSavedMeals();
  const createMutation = useCreateSavedMeal();
  const updateMutation = useUpdateSavedMeal();
  const deleteMutation = useDeleteSavedMeal();

  // Pre-fill when editing
  useEffect(() => {
    if (isEdit && savedMealsQuery.data) {
      const existing = savedMealsQuery.data.find((m) => m.id === editMealId);
      if (existing) {
        setMealName(existing.name);
        setItems(
          existing.items.map((item) => ({
            foodId: item.foodId,
            foodName: item.foodName,
            brandOrPlace: item.brandOrPlace,
            grams: String(item.grams),
            // back-calculate per100g values
            caloriesPer100g: item.grams > 0 ? (item.calories / item.grams) * 100 : 0,
            proteinPer100g: item.grams > 0 ? (item.protein / item.grams) * 100 : 0,
            carbsPer100g: item.grams > 0 ? (item.carbs / item.grams) * 100 : 0,
            fatsPer100g: item.grams > 0 ? (item.fats / item.grams) * 100 : 0,
          }))
        );
      }
    }
  }, [isEdit, editMealId, savedMealsQuery.data]);

  useEffect(() => {
    if (!token) return;

    const uniqueFoodIds = [...new Set(items.map((item) => item.foodId))];
    uniqueFoodIds.forEach((foodId) => {
      if (portionsByFoodId[foodId] || loadingPortionsFoodIds[foodId]) return;

      setLoadingPortionsFoodIds((prev) => ({ ...prev, [foodId]: true }));
      fetchFoodPortions(token, foodId)
        .then((portions) => {
          setPortionsByFoodId((prev) => ({ ...prev, [foodId]: portions }));
        })
        .catch(() => {
          setPortionsByFoodId((prev) => ({ ...prev, [foodId]: [] }));
        })
        .finally(() => {
          setLoadingPortionsFoodIds((prev) => ({ ...prev, [foodId]: false }));
        });
    });
  }, [items, token, portionsByFoodId, loadingPortionsFoodIds]);

  const handleAddFood = useCallback((food: FoodItem) => {
    setItems((prev) => [
      ...prev,
      {
        foodId: food.id,
        foodName: food.name,
        brandOrPlace: food.brandOrPlace,
        grams: "100",
        caloriesPer100g: food.calories,
        proteinPer100g: food.protein,
        carbsPer100g: food.carbs,
        fatsPer100g: food.fats,
      },
    ]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const selected = consumePendingMealFood();
      if (selected) {
        handleAddFood(selected);
      }
    }, [handleAddFood])
  );

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setEditingItemIndex((prev) => {
      if (prev === null) return prev;
      if (prev === index) return null;
      return prev > index ? prev - 1 : prev;
    });
  };

  const onStartEditItem = (index: number) => {
    setEditingItemIndex(index);
    setEditingGrams(items[index]?.grams || "100");
    setEditingSelectedPortionId(null);
    setEditingPortionAmount("1");
  };

  const onCancelEditItem = () => {
    setEditingItemIndex(null);
    setEditingGrams("");
    setEditingSelectedPortionId(null);
    setEditingPortionAmount("1");
  };

  const onSaveEditedItem = () => {
    if (editingItemIndex === null) return;
    const g = editingResolvedGrams;
    if (!Number.isFinite(g) || g <= 0) {
      Alert.alert("Error", "Please enter valid grams");
      return;
    }

    setItems((prev) => prev.map((item, i) => (i === editingItemIndex ? { ...item, grams: String(g) } : item)));
    setEditingItemIndex(null);
    setEditingGrams("");
    setEditingSelectedPortionId(null);
    setEditingPortionAmount("1");
  };

  const editingItem = editingItemIndex !== null ? items[editingItemIndex] : null;
  const editingPortions = editingItem ? portionsByFoodId[editingItem.foodId] || [] : [];
  const editingSelectedPortion = editingPortions.find((p) => p.id === editingSelectedPortionId) || null;
  const editingResolvedGrams = editingSelectedPortion
    ? Math.round(editingSelectedPortion.grams * (Number(editingPortionAmount) || 0) * 10) / 10
    : Number(editingGrams);
  const editingPreview = editingItem
    ? (() => {
        const g = editingResolvedGrams;
        if (!Number.isFinite(g) || g <= 0) return null;
        const factor = g / 100;
        return {
          grams: g,
          calories: Math.round(editingItem.caloriesPer100g * factor),
          protein: Math.round(editingItem.proteinPer100g * factor * 10) / 10,
          carbs: Math.round(editingItem.carbsPer100g * factor * 10) / 10,
          fats: Math.round(editingItem.fatsPer100g * factor * 10) / 10,
        };
      })()
    : null;

  const mealTotals = items.reduce(
    (acc, item) => {
      const g = parseFloat(item.grams) || 0;
      const factor = g / 100;
      return {
        calories: acc.calories + item.caloriesPer100g * factor,
        protein: acc.protein + item.proteinPer100g * factor,
        carbs: acc.carbs + item.carbsPer100g * factor,
        fats: acc.fats + item.fatsPer100g * factor,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );

  const handleSave = async () => {
    if (!mealName.trim()) {
      Alert.alert("Name required", "Please enter a name for this meal.");
      return;
    }
    if (items.length === 0) {
      Alert.alert("No foods", "Please add at least one food to this meal.");
      return;
    }

    const validItems = items.map((item) => ({
      foodId: item.foodId,
      grams: parseFloat(item.grams) || 100,
    }));

    try {
      if (isEdit && editMealId !== undefined) {
        await updateMutation.mutateAsync({
          mealId: editMealId,
          request: { name: mealName.trim(), items: validItems },
        });
      } else {
        await createMutation.mutateAsync({ name: mealName.trim(), items: validItems });
      }
      navigation.goBack();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      if (msg === "AUTH_EXPIRED") { signOut(); return; }
      Alert.alert("Error", msg);
    }
  };

  const handleDeleteMeal = async () => {
    if (!isEdit || editMealId === undefined) return;

    const performDeleteMeal = async () => {
      try {
        await deleteMutation.mutateAsync(editMealId);
        navigation.goBack();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong";
        if (msg === "AUTH_EXPIRED") {
          signOut();
          return;
        }
        Alert.alert("Error", msg);
      }
    };

    // Alert callbacks can be unreliable on web; execute directly there.
    if (Platform.OS === "web") {
      void performDeleteMeal();
      return;
    }

    Alert.alert(
      t("addFood.confirmDeleteMeal"),
      t("addFood.confirmDeleteMealMsg"),
      [
        { text: "Cancel", style: "cancel" },
        {
          text: t("addFood.deleteMeal"),
          style: "destructive",
          onPress: () => {
            void performDeleteMeal();
          },
        },
      ]
    );
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={s.header}>
          <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [s.backBtn, pressed && s.pressed]}>
            <Ionicons name="chevron-back" size={20} color="#374151" />
          </Pressable>
          <Text style={s.headerText}>
            {isEdit ? t("meals.editTitle") : t("meals.createTitle")}
          </Text>
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.card}>
            <Text style={s.cardTitle}>{t("logFood.cardTitle")}</Text>
            <Text style={s.mealHint}>Current meal totals</Text>
            <View style={s.metricsGrid}>
              <View style={s.metricBoxCompact}>
                <Text style={s.metricLabel}>{t("logFood.calories")}</Text>
                <Text style={s.metricValue}>{Math.round(mealTotals.calories)}</Text>
              </View>
              <View style={s.metricBoxCompact}>
                <Text style={s.metricLabel}>{t("logFood.protein")}</Text>
                <Text style={s.metricValue}>{Math.round(mealTotals.protein * 10) / 10}g</Text>
              </View>
              <View style={s.metricBoxCompact}>
                <Text style={s.metricLabel}>{t("logFood.carbs")}</Text>
                <Text style={s.metricValue}>{Math.round(mealTotals.carbs * 10) / 10}g</Text>
              </View>
              <View style={s.metricBoxCompact}>
                <Text style={s.metricLabel}>{t("logFood.fats")}</Text>
                <Text style={s.metricValue}>{Math.round(mealTotals.fats * 10) / 10}g</Text>
              </View>
            </View>
          </View>

          {/* Meal Name */}
          <View style={s.card}>
            <Text style={s.label}>{t("meals.nameLabel")}</Text>
            <TextInput
              style={s.nameInput}
              placeholder={t("meals.namePlaceholder")}
              placeholderTextColor="#9ca3af"
              value={mealName}
              onChangeText={setMealName}
              returnKeyType="done"
            />
          </View>

          {/* Add Food */}
          <View style={s.card}>
            <Pressable
              onPress={() => navigation.navigate("SearchMealFood", { meal, date, editMealId })}
              style={({ pressed }) => [s.actionBtn, s.searchBtn, pressed && s.pressed]}
            >
              <Text style={s.actionBtnIcon}>🔍</Text>
              <View style={s.actionBtnContent}>
                <Text style={s.actionBtnTitle}>{t("addFood.searchFood")}</Text>
                <Text style={s.actionBtnSubtitle} numberOfLines={1}>
                  {t("meals.searchSubtitle")}
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Meal Items */}
          <View style={s.card}>
            <View style={s.itemsHeader}>
              <Text style={s.label}>{t("meals.itemsLabel")}</Text>
            </View>

            {items.length === 0 ? (
              <Text style={s.empty}>{t("meals.noItems")}</Text>
            ) : (
              <View style={s.results}>
                {items.map((item, index) => {
                  const grams = parseFloat(item.grams) || 0;
                  const cal = Math.round((item.caloriesPer100g * grams) / 100);
                  const isExpanded = editingItemIndex === index;
                  const isLast = index === items.length - 1;
                  return (
                    <View
                      key={`${item.foodId}-${index}`}
                      style={[s.foodEntry, isExpanded && s.foodEntryExpanded, !isLast && !isExpanded && s.foodEntryBorder]}
                    >
                      <Pressable
                        onPress={() => (isExpanded ? onCancelEditItem() : onStartEditItem(index))}
                        style={({ pressed }) => [s.resultRow, isExpanded && { backgroundColor: "transparent" }, !isExpanded && pressed && s.rowPressed]}
                      >
                        <View style={s.resultTextCol}>
                          <Text style={isExpanded ? [s.resultName, s.resultNameExpanded] : s.resultName}>
                            {item.foodName}
                          </Text>
                          <Text style={s.resultSubmeta}>
                            {Math.round(grams)}g{item.brandOrPlace ? ` • ${item.brandOrPlace}` : ""}
                          </Text>
                        </View>
                        <View style={s.resultRightCol}>
                          <Text style={s.resultMeta}>{cal} kcal</Text>
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation();
                              handleRemoveItem(index);
                            }}
                            style={({ pressed }) => [s.favoriteBtn, pressed && s.pressed]}
                          >
                            <Ionicons name="trash-outline" size={16} color="#b91c1c" />
                          </Pressable>
                        </View>
                      </Pressable>

                      {isExpanded ? (
                        <View style={s.expandContent}>
                          <View style={[s.portionRow, loadingPortionsFoodIds[item.foodId] && { minHeight: 40, justifyContent: "center" }]}>
                            {loadingPortionsFoodIds[item.foodId] ? (
                              <ActivityIndicator size="small" color="#16a34a" />
                            ) : (
                              <>
                                <Pressable
                                  onPress={() => setEditingSelectedPortionId(null)}
                                  style={[s.portionChip, editingSelectedPortionId === null && s.portionChipActive]}
                                >
                                  <Text style={[s.portionChipText, editingSelectedPortionId === null && s.portionChipTextActive]}>Grams</Text>
                                </Pressable>
                                {(portionsByFoodId[item.foodId] || []).slice(0, 5).map((portion) => (
                                  <Pressable
                                    key={`${item.foodId}-${portion.id}`}
                                    onPress={() => setEditingSelectedPortionId(portion.id)}
                                    style={[s.portionChip, editingSelectedPortionId === portion.id && s.portionChipActive]}
                                  >
                                    <Text style={[s.portionChipText, editingSelectedPortionId === portion.id && s.portionChipTextActive]}>
                                      {portion.portionName}
                                    </Text>
                                  </Pressable>
                                ))}
                              </>
                            )}
                          </View>

                          <View style={s.controlsRow}>
                            {editingSelectedPortion ? (
                              <TextInput
                                style={s.input}
                                value={editingPortionAmount}
                                onChangeText={setEditingPortionAmount}
                                keyboardType="numeric"
                                returnKeyType="done"
                                placeholder="Amount"
                                placeholderTextColor="#9ca3af"
                              />
                            ) : (
                              <TextInput
                                style={s.input}
                                value={editingGrams}
                                onChangeText={setEditingGrams}
                                keyboardType="numeric"
                                returnKeyType="done"
                                placeholder="Grams"
                                placeholderTextColor="#9ca3af"
                              />
                            )}

                            <Pressable
                              onPress={onSaveEditedItem}
                              style={({ pressed }) => [s.addBtn, pressed && s.pressed]}
                            >
                              <Text style={s.addBtnText}>{t("logFood.save")}</Text>
                            </Pressable>
                          </View>

                          {editingPreview ? (
                            <View style={s.previewBox}>
                              <Text style={s.previewTitle}>Preview ({Math.round(editingPreview.grams * 10) / 10}g)</Text>
                              <View style={s.previewRow}>
                                <Text style={s.previewItem}>🔥 {editingPreview.calories} kcal</Text>
                                <Text style={s.previewItem}>🥩 {editingPreview.protein}g P</Text>
                                <Text style={s.previewItem}>🍚 {editingPreview.carbs}g C</Text>
                                <Text style={s.previewItem}>🥑 {editingPreview.fats}g F</Text>
                              </View>
                            </View>
                          ) : null}

                          {editingSelectedPortion ? (
                            <Text style={s.helper}>
                              1 {editingSelectedPortion.portionName} = {Math.round(editingSelectedPortion.grams * 10) / 10}g
                            </Text>
                          ) : (
                            <Text style={s.helper}>Direct grams mode</Text>
                          )}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>

        <View style={s.footer}>
          {isEdit ? (
            <Pressable
              onPress={handleDeleteMeal}
              disabled={isDeleting || isSaving}
              style={({ pressed }) => [s.deleteBtn, (isDeleting || isSaving) && s.disabled, pressed && s.pressed]}
            >
              {isDeleting ? (
                <ActivityIndicator color="#dc2626" />
              ) : (
                <Text style={s.deleteBtnText}>{t("addFood.deleteMeal")}</Text>
              )}
            </Pressable>
          ) : null}

          <Pressable
            onPress={handleSave}
            disabled={isSaving || isDeleting}
            style={({ pressed }) => [s.saveBtn, (isSaving || isDeleting) && s.disabled, pressed && s.pressed]}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.saveBtnText}>{t("meals.save")}</Text>
            )}
          </Pressable>
        </View>
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
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    gap: 8,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { fontSize: 16, fontWeight: "700", color: "#111827" },
  scroll: { padding: 16, gap: 10, paddingBottom: 120 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardTitle: { fontSize: 11, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.8 },
  mealHint: { fontSize: 12, color: "#6b7280", marginTop: -2 },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricBoxCompact: {
    width: "48%",
    borderWidth: 1,
    borderColor: "#dcfce7",
    backgroundColor: "#f0fdf4",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  metricLabel: { fontSize: 11, color: "#166534", fontWeight: "700", textTransform: "uppercase" },
  metricValue: { fontSize: 12, color: "#111827", fontWeight: "600" },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#f9fafb",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  actionBtnContent: {
    flex: 1,
    minWidth: 0,
  },
  searchBtn: {
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
  },
  actionBtnIcon: {
    fontSize: 22,
  },
  actionBtnTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  actionBtnSubtitle: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  itemsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  empty: { fontSize: 13, color: "#9ca3af", textAlign: "center", paddingVertical: 8 },
  results: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    overflow: "hidden",
  },
  foodEntry: {
    backgroundColor: "#fff",
  },
  foodEntryExpanded: {
    backgroundColor: "#f0fdf4",
  },
  foodEntryBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  resultTextCol: {
    flex: 1,
    marginRight: 8,
  },
  resultName: {
    fontSize: 13,
    color: "#111827",
  },
  resultNameExpanded: {
    color: "#166534",
    fontWeight: "600",
  },
  resultSubmeta: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2,
    fontWeight: "500",
  },
  resultRightCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  resultMeta: {
    fontSize: 12,
    color: "#9ca3af",
  },
  expandContent: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 8,
  },
  previewBox: {
    borderWidth: 1,
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  previewTitle: { fontSize: 12, color: "#166534", fontWeight: "700" },
  previewRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  previewItem: { fontSize: 12, color: "#166534", fontWeight: "600" },
  controlsRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#fff",
  },
  addBtn: {
    borderRadius: 10,
    backgroundColor: "#166534",
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  favoriteBtn: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  portionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  portionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  portionChipActive: {
    borderColor: "#16a34a",
    backgroundColor: "#dcfce7",
  },
  portionChipText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "600",
  },
  portionChipTextActive: {
    color: "#166534",
  },
  helper: {
    fontSize: 11,
    color: "#6b7280",
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: "#f8fdfb",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  saveBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  deleteBtn: {
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  deleteBtnText: {
    color: "#dc2626",
    fontWeight: "700",
    fontSize: 14,
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  disabled: { opacity: 0.6 },
  rowPressed: { backgroundColor: "#f3f4f6" },
  pressed: { opacity: 0.65 },
});
