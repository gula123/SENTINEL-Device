import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import type { MainStackParamList } from "../../navigation/navigationTypes";
import { useFrequentFoods } from "../../hooks/useFrequentFoods";
import { FrequentFoodsSection } from "../../components/FrequentFoodsSection";
import { useAddFoodLog } from "../../hooks/useFoodDiary";
import { useAuth } from "../../state/AuthContext";
import { useCallback, useRef, useState } from "react";
import { Animated, Alert } from "react-native";
import { fetchFoodPortions, type FoodItem } from "../../services/food/foodLogsApi";

const MEAL_LABEL: Record<string, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACKS: "Snacks",
};
const MEAL_ICON: Record<string, string> = {
  BREAKFAST: "☀️",
  LUNCH: "🌤️",
  DINNER: "🌙",
  SNACKS: "🍎",
};

type Props = NativeStackScreenProps<MainStackParamList, "AddFood">;

export default function AddFoodScreen({ route, navigation }: Props) {
  const { meal, date } = route.params;
  const frequentFoodsQuery = useFrequentFoods(10, { enabled: false });
  const { token, signOut } = useAuth();
  const addMutation = useAddFoodLog(date);

  useFocusEffect(
    useCallback(() => {
      if (!token) {
        return;
      }
      frequentFoodsQuery.refetch();
    }, [token])
  );

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

  const handleError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : "Something went wrong";
    if (msg === "AUTH_EXPIRED") {
      signOut();
      return;
    }
    Alert.alert("Error", msg);
  };

  const onLoadFrequentFoodPortions = async (foodId: number) => {
    if (!token) {
      throw new Error("AUTH_REQUIRED");
    }
    return fetchFoodPortions(token, foodId);
  };

  const onAddFrequentFood = async (food: FoodItem, grams: number) => {
    try {
      await addMutation.mutateAsync({
        foodName: food.name,
        foodId: food.id,
        grams,
        mealType: meal,
      });
      await frequentFoodsQuery.refetch();
      showToast(`Added ${food.name} (${Math.round(grams * 10) / 10}g)`);
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
            <Text style={s.headerText}>Add Food - {MEAL_LABEL[meal]}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.actionsCard}>
            <Pressable
              onPress={() => navigation.navigate("SearchFood", { meal, date })}
              style={({ pressed }) => [s.actionBtn, s.searchBtn, pressed && s.pressed]}
            >
              <Text style={s.actionBtnIcon}>🔍</Text>
              <View style={s.actionBtnContent}>
                <Text style={s.actionBtnTitle}>Search Food</Text>
                <Text style={s.actionBtnSubtitle} numberOfLines={1}>
                  Find and log any food
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate("CreateFood", { meal, date })}
              style={({ pressed }) => [s.actionBtn, s.createBtn, pressed && s.pressed]}
            >
              <Text style={s.actionBtnIcon}>➕</Text>
              <View style={s.actionBtnContent}>
                <Text style={s.actionBtnTitle}>Create New Food</Text>
                <Text style={s.actionBtnSubtitle} numberOfLines={1}>
                  Add a custom food entry
                </Text>
              </View>
            </Pressable>
          </View>

          <View style={s.card}>
            <FrequentFoodsSection
              foods={frequentFoodsQuery.data}
              isLoading={frequentFoodsQuery.isLoading}
              onLoadPortions={onLoadFrequentFoodPortions}
              onAddFood={onAddFrequentFood}
            />
          </View>
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

      <View style={s.footer}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back to meal statistics"
          style={({ pressed }) => [s.doneBtn, pressed && s.pressed]}
        >
          <Text style={s.doneBtnText}>Back to Meal Statistics</Text>
        </Pressable>
      </View>
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

  scroll: { padding: 16, gap: 16, paddingBottom: 120 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  actionsCard: {
    flexDirection: "row",
    gap: 12,
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
    flex: 1,
  },
  actionBtnContent: {
    flex: 1,
    minWidth: 0,
  },
  searchBtn: {
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
  },
  createBtn: {
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
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
  },
  doneBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  pressed: { opacity: 0.65 },

  toast: {
    position: "absolute",
    bottom: 24,
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
