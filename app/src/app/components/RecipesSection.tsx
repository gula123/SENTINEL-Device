import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { RecipeDto } from "../services/food/recipesApi";

if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

interface RecipesSectionProps {
  recipes: RecipeDto[] | undefined;
  isLoading: boolean;
  onLogRecipe: (recipeId: number, grams: number) => Promise<void>;
  onEditRecipe: (recipe: RecipeDto) => void;
  onCreateRecipe: () => void;
}

export function RecipesSection({
  recipes,
  isLoading,
  onLogRecipe,
  onEditRecipe,
  onCreateRecipe,
}: RecipesSectionProps) {
  const [expandedRecipeId, setExpandedRecipeId] = useState<number | null>(null);
  const [gramsInput, setGramsInput] = useState<Record<number, string>>({});
  const [usePortionByRecipeId, setUsePortionByRecipeId] = useState<Record<number, boolean>>({});
  const [portionAmountByRecipeId, setPortionAmountByRecipeId] = useState<Record<number, string>>({});
  const [loggingRecipeId, setLoggingRecipeId] = useState<number | null>(null);

  const data = recipes ?? [];

  const handleToggleExpand = (recipeId: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedRecipeId(expandedRecipeId === recipeId ? null : recipeId);
  };

  const handleLog = async (recipe: RecipeDto, grams: number, mode: "grams" | "portion") => {
    if (isNaN(grams) || grams <= 0) {
      Alert.alert(
        mode === "portion" ? "Enter portions" : "Enter grams",
        mode === "portion"
          ? "Please enter how many portions you ate."
          : "Please enter how many grams you ate."
      );
      return;
    }

    setLoggingRecipeId(recipe.id);
    try {
      await onLogRecipe(recipe.id, grams);
      setGramsInput((prev) => ({ ...prev, [recipe.id]: "" }));
      setPortionAmountByRecipeId((prev) => ({ ...prev, [recipe.id]: "" }));
    } finally {
      setLoggingRecipeId(null);
    }
  };

  if (isLoading) {
    return (
      <View style={s.container}>
        <Text style={s.title}>Recipes</Text>
        <Pressable
          onPress={onCreateRecipe}
          style={({ pressed }) => [s.createBtn, pressed && s.createBtnPressed]}
        >
          <Ionicons name="add-circle-outline" size={16} color="#16a34a" />
          <Text style={s.createBtnText}>Create Recipe</Text>
        </Pressable>
        <View style={s.loadingContainer}>
          <ActivityIndicator size="small" color="#16a34a" />
        </View>
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View style={s.container}>
        <Text style={s.title}>Recipes</Text>
        <Pressable
          onPress={onCreateRecipe}
          style={({ pressed }) => [s.createBtn, pressed && s.createBtnPressed]}
        >
          <Ionicons name="add-circle-outline" size={16} color="#16a34a" />
          <Text style={s.createBtnText}>Create Recipe</Text>
        </Pressable>
        <Text style={s.emptyText}>No recipes yet.</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Pressable
        onPress={onCreateRecipe}
        style={({ pressed }) => [s.createBtn, pressed && s.createBtnPressed]}
      >
        <Ionicons name="add-circle-outline" size={16} color="#16a34a" />
        <Text style={s.createBtnText}>Create Recipe</Text>
      </Pressable>
      <View style={s.results}>
        <FlatList
          data={data}
          keyExtractor={(item) => String(item.id)}
          style={s.list}
          nestedScrollEnabled
          renderItem={({ item: recipe }) => {
            const expanded = expandedRecipeId === recipe.id;
            const isLogging = loggingRecipeId === recipe.id;
            const hasPortion = Boolean(recipe.portionSizeGrams && recipe.portionSizeGrams > 0);
            const usePortion = hasPortion && Boolean(usePortionByRecipeId[recipe.id]);
            const gramsFromInput = parseFloat(gramsInput[recipe.id] ?? "100") || 100;
            const portionAmount = parseFloat(portionAmountByRecipeId[recipe.id] ?? "1") || 1;
            const grams = usePortion
              ? portionAmount * (recipe.portionSizeGrams ?? 0)
              : gramsFromInput;
            const subtitle = recipe.portionSizeGrams
              ? `1 portion = ${Math.round(recipe.portionSizeGrams)}g`
              : "Grams mode";
            const factor = grams / 100;
            const calories = Math.round(recipe.caloriesPer100g * factor);
            const protein = Math.round(recipe.proteinPer100g * factor * 10) / 10;
            const carbs = Math.round(recipe.carbsPer100g * factor * 10) / 10;
            const fats = Math.round(recipe.fatsPer100g * factor * 10) / 10;

            return (
              <View style={[s.foodEntry, expanded && s.foodEntryExpanded, !expanded && s.foodEntryBorder]}>
                <Pressable
                  onPress={() => handleToggleExpand(recipe.id)}
                  style={({ pressed }) => [s.resultRow, !expanded && pressed && s.pressed]}
                >
                  <View style={s.resultTextCol}>
                    <Text style={[s.resultName, expanded && s.resultNameExpanded]} numberOfLines={1}>
                      {recipe.name}
                    </Text>
                    <Text style={s.resultSubmeta} numberOfLines={1}>
                      {subtitle}
                    </Text>
                  </View>

                  <View style={s.resultRightCol}>
                    <Text style={s.resultMeta}>{Math.round(recipe.caloriesPer100g)} kcal</Text>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        onEditRecipe(recipe);
                      }}
                      style={s.favoriteBtn}
                    >
                      <Ionicons name="pencil-outline" size={16} color="#6b7280" />
                    </Pressable>
                  </View>
                </Pressable>

                {expanded ? (
                  <View style={s.expandContent}>
                    <View style={s.portionRow}>
                      <Pressable
                        onPress={() =>
                          setUsePortionByRecipeId((prev) => ({ ...prev, [recipe.id]: false }))
                        }
                        style={[s.portionChip, !usePortion && s.portionChipActive]}
                      >
                        <Text style={[s.portionChipText, !usePortion && s.portionChipTextActive]}>
                          Grams
                        </Text>
                      </Pressable>
                      {hasPortion ? (
                        <Pressable
                          onPress={() =>
                            setUsePortionByRecipeId((prev) => ({ ...prev, [recipe.id]: true }))
                          }
                          style={[s.portionChip, usePortion && s.portionChipActive]}
                        >
                          <Text style={[s.portionChipText, usePortion && s.portionChipTextActive]}>
                            Portion
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>

                    <View style={s.controlsRow}>
                      <TextInput
                        value={usePortion ? (portionAmountByRecipeId[recipe.id] ?? "1") : (gramsInput[recipe.id] ?? "100")}
                        onChangeText={(v) => {
                          if (usePortion) {
                            setPortionAmountByRecipeId((prev) => ({ ...prev, [recipe.id]: v }));
                          } else {
                            setGramsInput((prev) => ({ ...prev, [recipe.id]: v }));
                          }
                        }}
                        keyboardType="numeric"
                        placeholder={usePortion ? "Amount" : "Grams"}
                        placeholderTextColor="#9ca3af"
                        style={s.input}
                      />

                      <Pressable
                        onPress={() => handleLog(recipe, grams, usePortion ? "portion" : "grams")}
                        disabled={isLogging}
                        style={[s.addBtn, isLogging && s.addBtnDisabled]}
                      >
                        <Text style={s.addBtnText}>{isLogging ? "Adding..." : "Add"}</Text>
                      </Pressable>
                    </View>

                    <View style={s.previewBox}>
                      <Text style={s.previewTitle}>Preview ({Math.round(grams * 10) / 10}g)</Text>
                      <View style={s.previewRow}>
                        <Text style={s.previewItem}>🔥 {calories} kcal</Text>
                        <Text style={s.previewItem}>🥩 {protein}g P</Text>
                        <Text style={s.previewItem}>🍚 {carbs}g C</Text>
                        <Text style={s.previewItem}>🥑 {fats}g F</Text>
                      </View>
                    </View>

                    <Text style={s.helper}>
                      {usePortion && hasPortion
                        ? `1 portion = ${Math.round(recipe.portionSizeGrams ?? 0)}g`
                        : "Direct grams mode"}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    gap: 8,
  },
  title: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  loadingContainer: {
    paddingVertical: 18,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
    paddingVertical: 12,
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#86efac",
    borderRadius: 9,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: "#f0fdf4",
    alignSelf: "center",
  },
  createBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#16a34a",
  },
  createBtnPressed: {
    opacity: 0.65,
  },
  results: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    overflow: "hidden",
  },
  list: {
    maxHeight: 460,
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
  pressed: {
    backgroundColor: "#f3f4f6",
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
  resultMeta: {
    fontSize: 12,
    color: "#9ca3af",
  },
  resultRightCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  favoriteBtn: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  expandContent: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 8,
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
    borderColor: "#22c55e",
    backgroundColor: "#dcfce7",
  },
  portionChipText: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "600",
  },
  portionChipTextActive: {
    color: "#166534",
  },
  controlsRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: "#111827",
  },
  addBtn: {
    minWidth: 72,
    borderRadius: 10,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  addBtnDisabled: {
    opacity: 0.6,
  },
  addBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
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
  previewTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#166534",
  },
  previewRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  previewItem: {
    fontSize: 12,
    color: "#166534",
    fontWeight: "600",
  },
  helper: {
    fontSize: 11,
    color: "#6b7280",
  },
});
