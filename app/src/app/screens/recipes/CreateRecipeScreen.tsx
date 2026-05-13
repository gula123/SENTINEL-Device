import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import type { MainStackParamList } from "../../navigation/navigationTypes";
import { useAuth } from "../../state/AuthContext";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createRecipe, updateRecipe } from "../../services/food/recipesApi";
import { fetchFoodPortions, type FoodItem, type PortionDto } from "../../services/food/foodLogsApi";
import { consumePendingRecipeFood } from "../../state/recipeFoodPicker";

type Props = NativeStackScreenProps<MainStackParamList, "CreateRecipe" | "RecipeDetail">;

let _uidCounter = 0;
const newUid = () => String(++_uidCounter);

interface DraftIngredient {
  uid: string;
  foodId: number;
  foodName: string;
  rawGrams: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatsPer100g: number;
}

export default function CreateRecipeScreen({ route, navigation }: Props) {
  const { meal, date, recipe: editRecipe } = route.params as MainStackParamList["CreateRecipe"] & {
    recipe?: MainStackParamList["RecipeDetail"]["recipe"];
  };
  const isEditMode = Boolean(editRecipe?.id);
  const { token, signOut } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [finalCookedWeightG, setFinalCookedWeightG] = useState("");
  const [portionSizeGrams, setPortionSizeGrams] = useState("");

  const [ingredients, setIngredients] = useState<DraftIngredient[]>([]);
  const [editingIngredientUid, setEditingIngredientUid] = useState<string | null>(null);
  const [editingGrams, setEditingGrams] = useState("");
  const [editingSelectedPortionId, setEditingSelectedPortionId] = useState<number | null>(null);
  const [editingPortionAmount, setEditingPortionAmount] = useState("1");
  const [portionsByFoodId, setPortionsByFoodId] = useState<Record<number, PortionDto[]>>({});
  const [loadingPortionsFoodIds, setLoadingPortionsFoodIds] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!editRecipe) return;

    setName(editRecipe.name || "");
    setDescription(editRecipe.description || "");
    setIsPublic(Boolean(editRecipe.isPublic));
    setFinalCookedWeightG(editRecipe.finalCookedWeightG ? String(editRecipe.finalCookedWeightG) : "");
    setPortionSizeGrams(editRecipe.portionSizeGrams ? String(editRecipe.portionSizeGrams) : "");
    setIngredients(
      (editRecipe.ingredients || []).map((ingredient) => ({
        uid: newUid(),
        foodId: ingredient.foodId,
        foodName: ingredient.foodName || `Food #${ingredient.foodId}`,
        rawGrams: String(ingredient.rawGrams),
        caloriesPer100g: 0,
        proteinPer100g: 0,
        carbsPer100g: 0,
        fatsPer100g: 0,
      }))
    );
  }, [editRecipe]);

  const handleError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : "Something went wrong";
    if (msg === "AUTH_EXPIRED") {
      signOut();
      return;
    }
    Alert.alert("Error", msg);
  };

  const nutritionPreview = useMemo(() => {
    const computedCalories = ingredients.reduce((sum, ingredient) => {
      const grams = Number(ingredient.rawGrams);
      return sum + (Number.isFinite(grams) ? ingredient.caloriesPer100g * (grams / 100) : 0);
    }, 0);
    const computedProtein = ingredients.reduce((sum, ingredient) => {
      const grams = Number(ingredient.rawGrams);
      return sum + (Number.isFinite(grams) ? ingredient.proteinPer100g * (grams / 100) : 0);
    }, 0);
    const computedCarbs = ingredients.reduce((sum, ingredient) => {
      const grams = Number(ingredient.rawGrams);
      return sum + (Number.isFinite(grams) ? ingredient.carbsPer100g * (grams / 100) : 0);
    }, 0);
    const computedFats = ingredients.reduce((sum, ingredient) => {
      const grams = Number(ingredient.rawGrams);
      return sum + (Number.isFinite(grams) ? ingredient.fatsPer100g * (grams / 100) : 0);
    }, 0);

    const hasKnownIngredientNutrition = ingredients.some(
      (ingredient) =>
        ingredient.caloriesPer100g > 0 ||
        ingredient.proteinPer100g > 0 ||
        ingredient.carbsPer100g > 0 ||
        ingredient.fatsPer100g > 0
    );

    const fallbackFactor = (editRecipe?.finalCookedWeightG || 0) / 100;
    const totalCalories = hasKnownIngredientNutrition
      ? computedCalories
      : (editRecipe?.caloriesPer100g || 0) * fallbackFactor;
    const totalProtein = hasKnownIngredientNutrition
      ? computedProtein
      : (editRecipe?.proteinPer100g || 0) * fallbackFactor;
    const totalCarbs = hasKnownIngredientNutrition
      ? computedCarbs
      : (editRecipe?.carbsPer100g || 0) * fallbackFactor;
    const totalFats = hasKnownIngredientNutrition
      ? computedFats
      : (editRecipe?.fatsPer100g || 0) * fallbackFactor;

    const cookedWeight = Number(finalCookedWeightG);
    const hasValidCookedWeight = Number.isFinite(cookedWeight) && cookedWeight > 0;

    return {
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFats,
      per100: hasValidCookedWeight
        ? {
            calories: (totalCalories / cookedWeight) * 100,
            protein: (totalProtein / cookedWeight) * 100,
            carbs: (totalCarbs / cookedWeight) * 100,
            fats: (totalFats / cookedWeight) * 100,
          }
        : null,
    };
  }, [ingredients, finalCookedWeightG, editRecipe]);

  const onAddFood = (food: FoodItem) => {
    setIngredients((prev) => {
      const existing = prev.find((item) => item.foodId === food.id);
      if (existing) {
        return prev.map((item) =>
          item.foodId === food.id
            ? { ...item, rawGrams: String((Number(item.rawGrams) || 0) + 100) }
            : item
        );
      }

      return [
        ...prev,
        {
          uid: newUid(),
          foodId: food.id,
          foodName: food.name,
          rawGrams: "100",
          caloriesPer100g: food.calories,
          proteinPer100g: food.protein,
          carbsPer100g: food.carbs,
          fatsPer100g: food.fats,
        },
      ];
    });
  };

  useFocusEffect(
    useCallback(() => {
      const selected = consumePendingRecipeFood();
      if (selected) {
        onAddFood(selected);
      }
    }, [])
  );

  useEffect(() => {
    if (!token) return;

    const uniqueFoodIds = [...new Set(ingredients.map((item) => item.foodId))];
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
  }, [ingredients, token, portionsByFoodId, loadingPortionsFoodIds]);

  const onStartEditIngredient = (uid: string, rawGrams: string) => {
    setEditingIngredientUid(uid);
    setEditingGrams(rawGrams || "100");
    setEditingSelectedPortionId(null);
    setEditingPortionAmount("1");
  };

  const onCancelEditIngredient = () => {
    setEditingIngredientUid(null);
    setEditingGrams("");
    setEditingSelectedPortionId(null);
    setEditingPortionAmount("1");
  };

  const onSaveEditedIngredient = () => {
    if (editingIngredientUid === null) return;
    const grams = editingResolvedGrams;
    if (!Number.isFinite(grams) || grams <= 0) {
      Alert.alert("Invalid grams", "Please enter valid grams.");
      return;
    }
    setIngredients((prev) =>
      prev.map((item) => (item.uid === editingIngredientUid ? { ...item, rawGrams: String(grams) } : item))
    );
    setEditingIngredientUid(null);
    setEditingGrams("");
    setEditingSelectedPortionId(null);
    setEditingPortionAmount("1");
  };

  const onSelectEditPortion = (portionId: number) => {
    setEditingSelectedPortionId(portionId);
    setEditingPortionAmount("1");
  };

  const onSelectEditGramMode = () => {
    if (editingSelectedPortion) {
      setEditingGrams(String(editingResolvedGrams));
    }
    setEditingSelectedPortionId(null);
    setEditingPortionAmount("1");
  };

  const onRemoveIngredient = (uid: string) => {
    setIngredients((prev) => prev.filter((item) => item.uid !== uid));
    setEditingIngredientUid((prev) => (prev === uid ? null : prev));
  };

  const editingIngredient = editingIngredientUid !== null ? ingredients.find((i) => i.uid === editingIngredientUid) ?? null : null;
  const editingPortions = editingIngredient ? portionsByFoodId[editingIngredient.foodId] || [] : [];
  const editingSelectedPortion = editingPortions.find((p) => p.id === editingSelectedPortionId) || null;
  const editingResolvedGrams = editingSelectedPortion
    ? Math.round(editingSelectedPortion.grams * (Number(editingPortionAmount) || 0) * 10) / 10
    : Number(editingGrams);
  const editingPreview = editingIngredient
    ? (() => {
        const g = editingResolvedGrams;
        if (!Number.isFinite(g) || g <= 0) return null;
        const factor = g / 100;
        return {
          grams: g,
          calories: Math.round(editingIngredient.caloriesPer100g * factor),
          protein: Math.round(editingIngredient.proteinPer100g * factor * 10) / 10,
          carbs: Math.round(editingIngredient.carbsPer100g * factor * 10) / 10,
          fats: Math.round(editingIngredient.fatsPer100g * factor * 10) / 10,
        };
      })()
    : null;

  const onSave = async () => {
    if (isSaving) return;

    if (!token) {
      Alert.alert("Session expired", "Please sign in again.");
      signOut();
      return;
    }

    if (!name.trim()) {
      Alert.alert("Required", "Please enter a recipe name.");
      return;
    }

    if (ingredients.length === 0) {
      Alert.alert("Required", "Add at least one ingredient from search.");
      return;
    }

    const cookedWeight = Number(finalCookedWeightG);
    if (!Number.isFinite(cookedWeight) || cookedWeight <= 0) {
      Alert.alert("Required", "Please enter total cooked weight in grams (used for nutrition calculation).");
      return;
    }

    const portionSize = portionSizeGrams.trim() ? Number(portionSizeGrams) : null;
    if (portionSize !== null && (!Number.isFinite(portionSize) || portionSize <= 0)) {
      Alert.alert("Invalid", "Portion size must be a positive number or left empty.");
      return;
    }

    const normalizedIngredients = ingredients.map((ingredient) => ({
      foodId: ingredient.foodId,
      rawGrams: Number(ingredient.rawGrams),
    }));

    if (normalizedIngredients.some((ingredient) => !Number.isFinite(ingredient.rawGrams) || ingredient.rawGrams <= 0)) {
      Alert.alert("Invalid grams", "Every ingredient must have positive grams.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        isPublic,
        finalCookedWeightG: cookedWeight,
        portionSizeGrams: portionSize || undefined,
        ingredients: normalizedIngredients,
      };

      if (isEditMode && editRecipe?.id) {
        await updateRecipe(token, editRecipe.id, payload);
      } else {
        await createRecipe(token, payload);
      }
      navigation.goBack();
    } catch (err) {
      handleError(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={s.header}>
          <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [s.backBtn, pressed && s.pressed]}>
            <Ionicons name="chevron-back" size={20} color="#374151" />
          </Pressable>
          <Text style={s.headerText}>{isEditMode ? "Edit Recipe" : "New Recipe"}</Text>
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {/* Basic Info */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Recipe Info</Text>
            <LabeledInput
              label="Name *"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Chicken stir fry"
            />
            <LabeledInput
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Optional notes about this recipe"
              multiline
            />
            <LabeledInput
              label="Total weight after cooking (g) *"
              value={finalCookedWeightG}
              onChangeText={setFinalCookedWeightG}
              placeholder="e.g. 600 (final weight after cooking)"
              keyboardType="decimal-pad"
            />
            <LabeledInput
              label="Define 1 portion as (grams of cooked meal)"
              value={portionSizeGrams}
              onChangeText={setPortionSizeGrams}
              placeholder="Optional - e.g. 200"
              keyboardType="decimal-pad"
            />
            <View style={s.toggleRow}>
              <Text style={s.label}>Share publicly</Text>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ false: "#d1d5db", true: "#86efac" }}
                thumbColor={isPublic ? "#16a34a" : "#9ca3af"}
              />
            </View>
          </View>

          {/* Search Ingredients Button */}
          <Pressable
            onPress={() => navigation.navigate("SearchRecipeFood", { meal, date })}
            style={({ pressed }) => [s.actionBtn, s.searchBtn, pressed && s.pressed]}
          >
            <Text style={s.actionBtnIcon}>🔍</Text>
            <View style={s.actionBtnContent}>
              <Text style={[s.actionBtnTitle, s.searchBtnTitle]}>Search Ingredients</Text>
              <Text style={s.actionBtnSubtitle} numberOfLines={1}>
                Open food search and add ingredients
              </Text>
            </View>
          </Pressable>

          {/* Ingredients */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Ingredients *</Text>

            {ingredients.length > 0 ? (
              <View style={s.results}>
                {ingredients.map((ingredient) => {
                    const grams = Number(ingredient.rawGrams) || 0;
                    const calories = Math.round((ingredient.caloriesPer100g * grams) / 100);
                    const isExpanded = editingIngredientUid === ingredient.uid;
                    const isLast = ingredients[ingredients.length - 1]?.uid === ingredient.uid;

                    return (
                      <View key={ingredient.uid} style={[s.foodEntry, isExpanded && s.foodEntryExpanded, !isLast && !isExpanded && s.foodEntryBorder]}>
                        <View style={s.resultRow}>
                          <Pressable
                            onPress={() => (isExpanded ? onCancelEditIngredient() : onStartEditIngredient(ingredient.uid, ingredient.rawGrams))}
                            style={({ pressed }) => [s.resultTextCol, !isExpanded && pressed && s.rowPressed]}
                          >
                            <Text style={isExpanded ? [s.resultName, s.resultNameExpanded] : s.resultName}>
                              {ingredient.foodName}
                            </Text>
                            <Text style={s.resultSubmeta}>{Math.round(grams)}g</Text>
                          </Pressable>

                          <View style={s.resultRightCol}>
                            <Text style={s.resultMeta}>{calories} kcal</Text>
                            <Pressable
                              onPress={() => onRemoveIngredient(ingredient.uid)}
                              style={({ pressed }) => [s.favoriteBtn, pressed && s.pressed]}
                            >
                              <Ionicons name="trash-outline" size={16} color="#b91c1c" />
                            </Pressable>
                          </View>
                        </View>

                        {isExpanded ? (
                          <View style={s.expandContent}>
                            <View style={[s.portionRow, loadingPortionsFoodIds[ingredient.foodId] && { minHeight: 40, justifyContent: "center" }]}>
                              {loadingPortionsFoodIds[ingredient.foodId] ? (
                                <ActivityIndicator size="small" color="#16a34a" />
                              ) : (
                                <>
                                  <Pressable
                                    onPress={onSelectEditGramMode}
                                    style={[s.portionChip, editingSelectedPortionId === null && s.portionChipActive]}
                                  >
                                    <Text style={[s.portionChipText, editingSelectedPortionId === null && s.portionChipTextActive]}>Grams</Text>
                                  </Pressable>
                                  {(portionsByFoodId[ingredient.foodId] || []).slice(0, 5).map((portion) => (
                                    <Pressable
                                      key={`${ingredient.foodId}-${portion.id}`}
                                      onPress={() => onSelectEditPortion(portion.id)}
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
                                  style={s.inputCompact}
                                  value={editingPortionAmount}
                                  onChangeText={setEditingPortionAmount}
                                  keyboardType="decimal-pad"
                                  placeholder="Amount"
                                  placeholderTextColor="#9ca3af"
                                />
                              ) : (
                                <TextInput
                                  style={s.inputCompact}
                                  value={editingGrams}
                                  onChangeText={setEditingGrams}
                                  keyboardType="decimal-pad"
                                  placeholder="Grams"
                                  placeholderTextColor="#9ca3af"
                                />
                              )}

                              <Pressable onPress={onSaveEditedIngredient} style={({ pressed }) => [s.actionMini, pressed && s.pressed]}>
                                <Text style={s.addBtnText}>Save</Text>
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
                              <Text style={s.helper}>1 {editingSelectedPortion.portionName} = {Math.round(editingSelectedPortion.grams * 10) / 10}g</Text>
                            ) : (
                              <Text style={s.helper}>Direct grams mode</Text>
                            )}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
              </View>
            ) : (
              <Text style={s.emptyHint}>No ingredients added yet.</Text>
            )}
          </View>

          {/* Nutrition Preview */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Nutrition Preview</Text>
            <Text style={s.previewLine}>Total: {Math.round(nutritionPreview.totalCalories)} kcal</Text>
            <Text style={s.previewLine}>
              Protein {nutritionPreview.totalProtein.toFixed(1)}g · Carbs {nutritionPreview.totalCarbs.toFixed(1)}g · Fats {nutritionPreview.totalFats.toFixed(1)}g
            </Text>
            {nutritionPreview.per100 ? (
              <Text style={s.previewLineStrong}>
                Per 100g: {Math.round(nutritionPreview.per100.calories)} kcal · P {nutritionPreview.per100.protein.toFixed(1)}g · C {nutritionPreview.per100.carbs.toFixed(1)}g · F {nutritionPreview.per100.fats.toFixed(1)}g
              </Text>
            ) : (
              <Text style={s.cardSubtitle}>Enter total cooked weight to see per-100g values.</Text>
            )}
          </View>
        </ScrollView>

        <View style={s.footer}>
          <Pressable
            onPress={onSave}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel={isEditMode ? "Update recipe" : "Save recipe"}
            style={({ pressed }) => [s.footerSaveBtn, isSaving && s.disabled, pressed && s.pressed]}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.footerSaveBtnText}>{isEditMode ? "Update Recipe" : "Save Recipe"}</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface LabeledInputProps {
  label: string;
  value: string;
  onChangeText: (val: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "decimal-pad";
  multiline?: boolean;
}

function LabeledInput({ label, value, onChangeText, placeholder, keyboardType = "default", multiline }: LabeledInputProps) {
  return (
    <View style={s.inputGroup}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={[s.input, multiline && s.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
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
  headerText: { flex: 1, fontSize: 18, fontWeight: "700", color: "#111827" },

  scroll: { padding: 16, gap: 16, paddingBottom: 120 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
    gap: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  cardSubtitle: { fontSize: 12, color: "#6b7280", marginTop: -4 },

  inputGroup: { gap: 4 },
  label: { fontSize: 12, fontWeight: "600", color: "#374151" },
  input: {
    height: 42,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#f9fafb",
  },
  inputMultiline: { height: 80, paddingTop: 10, textAlignVertical: "top" },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
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
  actionBtnIcon: {
    fontSize: 22,
    width: 28,
    textAlign: "center",
  },
  actionBtnContent: {
    flex: 1,
    minWidth: 0,
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

  searchBtn: {
    borderColor: "#16a34a",
    backgroundColor: "#fff",
    borderWidth: 1.5,
  },
  searchBtnTitle: {
    color: "#16a34a",
  },

  itemsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  results: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  foodEntry: {
    backgroundColor: "#fff",
  },
  foodEntryActive: {
    opacity: 0.9,
    borderColor: "#86efac",
    borderWidth: 1,
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  rowPressed: {
    opacity: 0.7,
  },
  dragHandleBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
    marginRight: 6,
  },
  resultTextCol: {
    flex: 1,
    marginRight: 8,
  },
  resultName: {
    fontSize: 13,
    fontWeight: "700",
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
  controlsRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  inputCompact: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    backgroundColor: "#fff",
    color: "#111827",
  },
  actionMini: {
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
  helper: {
    fontSize: 11,
    color: "#6b7280",
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
  emptyHint: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
    paddingVertical: 6,
  },

  previewLine: {
    fontSize: 13,
    color: "#374151",
  },
  previewLineStrong: {
    fontSize: 13,
    color: "#166534",
    fontWeight: "700",
  },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: "#f8fdfb",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  footerSaveBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  footerSaveBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  disabled: {
    opacity: 0.6,
  },

  pressed: { opacity: 0.7 },
});
