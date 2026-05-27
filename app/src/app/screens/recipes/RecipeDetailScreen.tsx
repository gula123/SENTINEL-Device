import {
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
import type { RecipeDto } from "../../services/food/recipesApi";
import { useEffect } from "react";

type Props = NativeStackScreenProps<MainStackParamList, "RecipeDetail">;

export default function RecipeDetailScreen({ route, navigation }: Props) {
  const recipe = route.params.recipe as RecipeDto;

  useEffect(() => {
    navigation.setOptions({
      title: recipe?.name ? `Recipe: ${recipe.name}` : "Recipe Details",
    });
  }, [navigation, recipe?.name]);

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.card}>
            <Text style={s.label}>Recipe Name</Text>
            <TextInput
              style={s.input}
              value={recipe.name}
              editable={false}
              placeholder="Recipe name"
            />

            <Text style={s.label}>Calories per 100g</Text>
            <Text style={s.valueText}>{Math.round(recipe.caloriesPer100g)} kcal</Text>

            <Text style={s.label}>Protein per 100g</Text>
            <Text style={s.valueText}>{recipe.proteinPer100g.toFixed(1)}g</Text>

            <Text style={s.label}>Carbs per 100g</Text>
            <Text style={s.valueText}>{recipe.carbsPer100g.toFixed(1)}g</Text>

            <Text style={s.label}>Fats per 100g</Text>
            <Text style={s.valueText}>{recipe.fatsPer100g.toFixed(1)}g</Text>

            {recipe.finalCookedWeightG && (
              <>
                <Text style={s.label}>Final Cooked Weight</Text>
                <Text style={s.valueText}>{recipe.finalCookedWeightG}g</Text>
              </>
            )}

            {recipe.description && (
              <>
                <Text style={s.label}>Description</Text>
                <Text style={s.valueText}>{recipe.description}</Text>
              </>
            )}

            <View style={s.spacer} />
          </View>
        </ScrollView>

        <View style={s.footer}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [s.backBtn, pressed && s.pressed]}
          >
            <Text style={s.backBtnText}>Close</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fdfb" },
  scroll: { padding: 16, gap: 16, paddingBottom: 120 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  label: { fontSize: 12, fontWeight: "700", color: "#6b7280", textTransform: "uppercase" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#f9fafb",
  },
  valueText: { fontSize: 14, color: "#111827", fontWeight: "500" },
  errorText: { fontSize: 16, color: "#dc2626", fontWeight: "600" },
  spacer: { height: 16 },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  backBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
  },
  backBtnText: { fontSize: 16, fontWeight: "700", color: "#374151" },
  pressed: { opacity: 0.65 },
});
