import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../../navigation/navigationTypes";
import { useAuth } from "../../state/AuthContext";
import { useCallback, useRef, useState } from "react";
import {
  deleteRecipe,
  fetchMyRecipes,
  logRecipe,
  type RecipeDto,
} from "../../services/food/recipesApi";

type Props = NativeStackScreenProps<MainStackParamList, "Recipes">;

export default function RecipesScreen({ route, navigation }: Props) {
  const { meal, date } = route.params;
  const { token, signOut } = useAuth();
  const [recipes, setRecipes] = useState<RecipeDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loggingRecipeId, setLoggingRecipeId] = useState<number | null>(null);
  const [gramsInput, setGramsInput] = useState<Record<number, string>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadRecipes = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const data = await fetchMyRecipes(token);
      setRecipes(data);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadRecipes();
    }, [loadRecipes])
  );

  const showToast = (message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMessage(message);
    toastAnim.setValue(0);
    Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 350, useNativeDriver: true }).start(() =>
        setToastMessage(null)
      );
    }, 2200);
  };

  const handleError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : "Something went wrong";
    if (msg === "AUTH_EXPIRED") {
      signOut();
      return;
    }
    Alert.alert("Error", msg);
  };

  const onLog = async (recipe: RecipeDto) => {
    if (!token) return;
    const gramsStr = gramsInput[recipe.id] ?? String(recipe.finalCookedWeightG ?? "");
    const grams = parseFloat(gramsStr);
    if (!gramsStr || isNaN(grams) || grams <= 0) {
      Alert.alert("Enter grams", "Please enter how many grams you ate.");
      return;
    }

    setLoggingRecipeId(recipe.id);
    try {
      await logRecipe(token, { recipeId: recipe.id, grams, mealType: meal, logDate: date });
      showToast(`Logged ${recipe.name} (${grams}g)`);
      setGramsInput((prev) => ({ ...prev, [recipe.id]: "" }));
    } catch (err) {
      handleError(err);
    } finally {
      setLoggingRecipeId(null);
    }
  };

  const onDelete = (recipe: RecipeDto) => {
    Alert.alert("Delete Recipe", `Delete "${recipe.name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (!token) return;
          try {
            await deleteRecipe(token, recipe.id);
            setRecipes((prev) => prev.filter((r) => r.id !== recipe.id));
            showToast("Recipe deleted");
          } catch (err) {
            handleError(err);
          }
        },
      },
    ]);
  };

  const myRecipes = recipes.filter((r) => r.originRecipeId == null);
  const copiedRecipes = recipes.filter((r) => r.originRecipeId != null);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [s.backBtn, pressed && s.pressed]}>
            <Ionicons name="chevron-back" size={20} color="#374151" />
          </Pressable>
          <Text style={s.headerText}>🍳 Recipes</Text>
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {isLoading ? (
            <ActivityIndicator size="large" color="#16a34a" style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* Create Recipe button */}
              <Pressable
                onPress={() => navigation.navigate("CreateRecipe", { meal, date })}
                style={({ pressed }) => [s.createBtn, pressed && s.pressed]}
              >
                <Ionicons name="add-circle-outline" size={20} color="#16a34a" />
                <Text style={s.createBtnText}>Create New Recipe</Text>
              </Pressable>

              {/* My Recipes */}
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>My Recipes</Text>
                <Text style={s.sectionCount}>{myRecipes.length}</Text>
              </View>
              {myRecipes.length === 0 ? (
                <View style={s.emptyCard}>
                  <Text style={s.emptyText}>No recipes yet.</Text>
                  <Text style={s.emptySubtext}>Create your first recipe above.</Text>
                </View>
              ) : (
                myRecipes.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    grams={gramsInput[recipe.id] ?? ""}
                    onGramsChange={(val) =>
                      setGramsInput((prev) => ({ ...prev, [recipe.id]: val }))
                    }
                    onLog={() => onLog(recipe)}
                    onDelete={() => onDelete(recipe)}
                    isLogging={loggingRecipeId === recipe.id}
                    showDelete
                  />
                ))
              )}

              {/* Copied Recipes */}
              {copiedRecipes.length > 0 && (
                <>
                  <View style={[s.sectionHeader, { marginTop: 8 }]}>
                    <Text style={s.sectionTitle}>Copied from others</Text>
                    <Text style={s.sectionCount}>{copiedRecipes.length}</Text>
                  </View>
                  {copiedRecipes.map((recipe) => (
                    <RecipeCard
                      key={recipe.id}
                      recipe={recipe}
                      grams={gramsInput[recipe.id] ?? ""}
                      onGramsChange={(val) =>
                        setGramsInput((prev) => ({ ...prev, [recipe.id]: val }))
                      }
                      onLog={() => onLog(recipe)}
                      onDelete={() => onDelete(recipe)}
                      isLogging={loggingRecipeId === recipe.id}
                      showDelete
                    />
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>

        {toastMessage ? (
          <Animated.View
            style={[
              s.toast,
              {
                opacity: toastAnim,
                transform: [
                  {
                    translateY: toastAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}
            pointerEvents="none"
          >
            <Text style={s.toastText}>✓ {toastMessage}</Text>
          </Animated.View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// RecipeCard
// ──────────────────────────────────────────────────────────────────────────────

interface RecipeCardProps {
  recipe: RecipeDto;
  grams: string;
  onGramsChange: (val: string) => void;
  onLog: () => void;
  onDelete: () => void;
  isLogging: boolean;
  showDelete: boolean;
}

function RecipeCard({ recipe, grams, onGramsChange, onLog, onDelete, isLogging, showDelete }: RecipeCardProps) {
  const totalCal = recipe.finalCookedWeightG
    ? Math.round((recipe.caloriesPer100g * recipe.finalCookedWeightG) / 100)
    : null;

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.recipeName}>{recipe.name}</Text>
          {recipe.description ? (
            <Text style={s.recipeDesc} numberOfLines={2}>
              {recipe.description}
            </Text>
          ) : null}
        </View>
        {showDelete && (
          <Pressable onPress={onDelete} style={({ pressed }) => [s.deleteBtn, pressed && s.pressed]}>
            <Ionicons name="trash-outline" size={18} color="#9ca3af" />
          </Pressable>
        )}
      </View>

      {/* Nutrition row */}
      <View style={s.nutritionRow}>
        <NutrBadge label="kcal/100g" value={Math.round(recipe.caloriesPer100g)} color="#f97316" />
        <NutrBadge label="P" value={`${recipe.proteinPer100g.toFixed(1)}g`} color="#3b82f6" />
        <NutrBadge label="C" value={`${recipe.carbsPer100g.toFixed(1)}g`} color="#f59e0b" />
        <NutrBadge label="F" value={`${recipe.fatsPer100g.toFixed(1)}g`} color="#ef4444" />
        {recipe.finalCookedWeightG && totalCal ? (
          <NutrBadge label={`${recipe.finalCookedWeightG}g total`} value={`${totalCal} kcal`} color="#8b5cf6" />
        ) : null}
      </View>

      {/* Log row */}
      <View style={s.logRow}>
        <TextInput
          style={s.gramsInput}
          placeholder={recipe.finalCookedWeightG ? `${recipe.finalCookedWeightG}` : "grams"}
          placeholderTextColor="#9ca3af"
          keyboardType="decimal-pad"
          value={grams}
          onChangeText={onGramsChange}
        />
        <Text style={s.gramsLabel}>g</Text>
        <Pressable
          onPress={onLog}
          disabled={isLogging}
          style={({ pressed }) => [s.logBtn, pressed && s.pressed, isLogging && s.logBtnDisabled]}
        >
          {isLogging ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={s.logBtnText}>Log</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function NutrBadge({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <View style={[s.nutrBadge, { borderColor: color + "40", backgroundColor: color + "10" }]}>
      <Text style={[s.nutrValue, { color }]}>{value}</Text>
      <Text style={s.nutrLabel}>{label}</Text>
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
  scroll: { padding: 16, gap: 10, paddingBottom: 100 },

  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#f0fdf4",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#86efac",
    borderStyle: "dashed",
    paddingVertical: 14,
  },
  createBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#16a34a",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#374151" },
  sectionCount: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
    backgroundColor: "#16a34a",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
    overflow: "hidden",
  },

  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 20,
    alignItems: "center",
    gap: 4,
  },
  emptyText: { fontSize: 14, fontWeight: "600", color: "#4b5563" },
  emptySubtext: { fontSize: 12, color: "#9ca3af" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    gap: 10,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  recipeName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  recipeDesc: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  deleteBtn: { padding: 4 },

  nutritionRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  nutrBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: "center",
    minWidth: 52,
  },
  nutrValue: { fontSize: 12, fontWeight: "700" },
  nutrLabel: { fontSize: 9, color: "#6b7280", fontWeight: "500" },

  logRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  gramsInput: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#f9fafb",
  },
  gramsLabel: { fontSize: 14, color: "#6b7280", fontWeight: "600" },
  logBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 10,
    paddingHorizontal: 20,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  logBtnDisabled: { opacity: 0.6 },
  logBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  toast: {
    position: "absolute",
    bottom: 32,
    alignSelf: "center",
    backgroundColor: "#166534",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  toastText: { color: "#fff", fontWeight: "600", fontSize: 14 },

  pressed: { opacity: 0.7 },
});
