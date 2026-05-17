import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import type { MainStackParamList } from "../../navigation/navigationTypes";
import { useAddFoodLog } from "../../hooks/useFoodDiary";
import {
  createCustomFood,
  estimateFoodPer100gWithAi,
  type AiFoodEstimate,
  type MealType,
} from "../../services/food/foodLogsApi";
import { useAuth } from "../../state/AuthContext";
import { useLanguage } from "../../state/LanguageContext";

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

type Props = NativeStackScreenProps<MainStackParamList, "CreateFood">;

export default function CreateFoodScreen({ route, navigation }: Props) {
  const { meal, date } = route.params;

  const [customName, setCustomName] = useState("");
  const [customBrandOrPlace, setCustomBrandOrPlace] = useState("");
  const [customCalories, setCustomCalories] = useState("0");
  const [customProtein, setCustomProtein] = useState("0");
  const [customCarbs, setCustomCarbs] = useState("0");
  const [customFats, setCustomFats] = useState("0");
  const [customGrams, setCustomGrams] = useState("100");
  const [aiNote, setAiNote] = useState("");

  const { token, signOut } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const addMutation = useAddFoodLog(date);

  const toastAnim = useRef(new Animated.Value(0)).current;
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const _n = (v: string) => Number(v.replace(',', '.'));
  const customFoodPreview = {
    grams: _n(customGrams),
    calories: Math.round(_n(customCalories) * (_n(customGrams) / 100)),
    protein: Math.round((_n(customProtein) * (_n(customGrams) / 100)) * 10) / 10,
    carbs: Math.round((_n(customCarbs) * (_n(customGrams) / 100)) * 10) / 10,
    fats: Math.round((_n(customFats) * (_n(customGrams) / 100)) * 10) / 10,
  };

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
      const g = Number(customGrams.replace(',', '.'));
      if (!Number.isFinite(g) || g <= 0) throw new Error("Enter valid grams");

      const created = await createCustomFood(token, {
        name: customName.trim(),
        brandOrPlace: customBrandOrPlace.trim() || undefined,
        caloriesPer100g: Number(customCalories.replace(',', '.')) || 0,
        proteinPer100g: Number(customProtein.replace(',', '.')) || 0,
        carbsPer100g: Number(customCarbs.replace(',', '.')) || 0,
        fatsPer100g: Number(customFats.replace(',', '.')) || 0,
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
      queryClient.invalidateQueries({ queryKey: ["foodLogs", date] });
      queryClient.invalidateQueries({ queryKey: ["nutritionSummary", date] });
      queryClient.invalidateQueries({ queryKey: ["diaryDay", date] });
      navigation.goBack();
    },
    onError: (err) => {
      handleError(err);
    },
  });

  const handleError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : "Something went wrong";
    if (msg === "AUTH_EXPIRED") {
      signOut();
      return;
    }
    Alert.alert("Error", msg);
  };

  const onAiEstimate = async () => {
    if (!customName.trim()) {
      Alert.alert(t("createFood.enterFoodNameFirst"));
      return;
    }
    try {
      await aiMutation.mutateAsync(customName.trim());
    } catch (err) {
      handleError(err);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={s.header}>
          <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [s.backBtn, pressed && s.pressed]}>
            <Ionicons name="chevron-back" size={20} color="#374151" />
          </Pressable>
          <View style={s.headerTitle}>
            <Text style={s.headerIcon}>{MEAL_ICON[meal]}</Text>
            <Text style={s.headerText}>{t("createFood.title")}</Text>
          </View>
          <Text style={s.headerDate}>{t(`home.${meal.toLowerCase()}`)}</Text>
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.card}>
            <Text style={s.cardTitle}>{t("createFood.cardTitle")}</Text>
            <Text style={s.helperText}>{t("createFood.helpText")}</Text>

            <Text style={s.inputLabel}>{t("createFood.foodName")}</Text>
            <TextInput
              value={customName}
              onChangeText={setCustomName}
              placeholder={t("createFood.foodName")}
              placeholderTextColor="#9ca3af"
              style={s.input}
            />
            <Text style={s.inputLabel}>{t("createFood.brandOrPlace")}</Text>
            <TextInput
              value={customBrandOrPlace}
              onChangeText={setCustomBrandOrPlace}
              placeholder={t("createFood.brandOrPlace")}
              placeholderTextColor="#9ca3af"
              style={s.input}
            />

            <Pressable onPress={onAiEstimate} style={({ pressed }) => [s.aiBtn, pressed && s.pressed]}>
              <Text style={s.aiBtnText}>{aiMutation.isPending ? t("createFood.estimating") : t("createFood.aiEstimate")}</Text>
            </Pressable>
            {aiNote ? <Text style={s.aiNote}>{aiNote}</Text> : null}

            <Text style={s.inputLabel}>{t("createFood.caloriesLabel")}</Text>
            <TextInput
              value={customCalories}
              onChangeText={setCustomCalories}
              keyboardType="numeric"
              placeholder={t("createFood.caloriesPlaceholder")}
              placeholderTextColor="#9ca3af"
              style={s.input}
            />
            <Text style={s.inputLabel}>{t("createFood.proteinLabel")}</Text>
            <TextInput
              value={customProtein}
              onChangeText={setCustomProtein}
              keyboardType="numeric"
              placeholder={t("createFood.proteinPlaceholder")}
              placeholderTextColor="#9ca3af"
              style={s.input}
            />
            <Text style={s.inputLabel}>{t("createFood.carbsLabel")}</Text>
            <TextInput
              value={customCarbs}
              onChangeText={setCustomCarbs}
              keyboardType="numeric"
              placeholder={t("createFood.carbsPlaceholder")}
              placeholderTextColor="#9ca3af"
              style={s.input}
            />
            <Text style={s.inputLabel}>{t("createFood.fatsLabel")}</Text>
            <TextInput
              value={customFats}
              onChangeText={setCustomFats}
              keyboardType="numeric"
              placeholder={t("createFood.fatsPlaceholder")}
              placeholderTextColor="#9ca3af"
              style={s.input}
            />
            <Text style={s.inputLabel}>{t("createFood.eatenGrams")}</Text>
            <TextInput
              value={customGrams}
              onChangeText={setCustomGrams}
              keyboardType="numeric"
              placeholder={t("createFood.logGramsPlaceholder")}
              placeholderTextColor="#9ca3af"
              style={s.input}
            />

            {customFoodPreview ? (
              <View style={s.previewBox}>
                <Text style={s.previewTitle}>{t("createFood.willBeLogged").replace("{grams}", String(customFoodPreview.grams))}</Text>
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
              <Text style={s.addBtnText}>{createCustomMutation.isPending ? t("createFood.saving") : t("createFood.createAndLog")}</Text>
            </Pressable>
          </View>
        </ScrollView>

        <View style={s.footer}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t("createFood.backToAddFood")}
            style={({ pressed }) => [s.doneBtn, pressed && s.pressed]}
          >
            <Text style={s.doneBtnText}>{t("createFood.backToAddFood")}</Text>
          </Pressable>
        </View>

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
  headerTitle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  headerIcon: { fontSize: 20 },
  headerText: { fontSize: 18, fontWeight: "700", color: "#111827" },
  headerDate: { fontSize: 12, color: "#16a34a", fontWeight: "700" },

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
  helperText: { fontSize: 12, color: "#6b7280", lineHeight: 17 },
  inputLabel: { fontSize: 12, fontWeight: "700", color: "#374151", marginTop: 2 },

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

  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: "#f8fdfb",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  doneBtn: {
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  doneBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  pressed: { opacity: 0.65 },

  toast: {
    position: "absolute",
    bottom: 86,
    left: 24,
    right: 24,
    backgroundColor: "#166534",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
