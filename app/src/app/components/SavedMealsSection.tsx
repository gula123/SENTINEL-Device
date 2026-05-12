import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { SavedMealDto } from "../services/food/savedMealsApi";
import { useLanguage } from "../state/LanguageContext";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";

interface SavedMealsSectionProps {
  meals: SavedMealDto[] | undefined;
  isLoading: boolean;
  onLogMeal: (mealId: number) => Promise<void>;
  onEditMeal: (meal: SavedMealDto) => void;
  onCreateMeal: () => void;
  onReorderMeals: (mealIds: number[]) => Promise<void>;
}

export function SavedMealsSection({
  meals,
  isLoading,
  onLogMeal,
  onEditMeal,
  onCreateMeal,
  onReorderMeals,
}: SavedMealsSectionProps) {
  const { t } = useLanguage();
  const [loggingMealId, setLoggingMealId] = useState<number | null>(null);
  const [expandedMealId, setExpandedMealId] = useState<number | null>(null);
  const [localMeals, setLocalMeals] = useState<SavedMealDto[]>([]);

  useEffect(() => {
    setLocalMeals(meals || []);
  }, [meals]);

  const handleLog = async (mealId: number) => {
    setLoggingMealId(mealId);
    try {
      await onLogMeal(mealId);
    } finally {
      setLoggingMealId(null);
    }
  };

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color="#16a34a" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Pressable
        onPress={onCreateMeal}
        style={({ pressed }) => [s.createBtn, pressed && s.pressed]}
      >
        <Ionicons name="add-circle-outline" size={16} color="#16a34a" />
        <Text style={s.createBtnText}>{t("addFood.createMeal")}</Text>
      </Pressable>

      {!localMeals || localMeals.length === 0 ? (
        <Text style={s.empty}>{t("addFood.noMeals")}</Text>
      ) : (
        <DraggableFlatList
          data={localMeals}
          keyExtractor={(item) => String(item.id)}
          scrollEnabled={false}
          activationDistance={14}
          contentContainerStyle={s.list}
          onDragEnd={async ({ data }) => {
            const previous = localMeals;
            setLocalMeals(data);
            try {
              await onReorderMeals(data.map((m) => m.id));
            } catch {
              setLocalMeals(previous);
            }
          }}
          renderItem={({ item: meal, drag, isActive }: RenderItemParams<SavedMealDto>) => {
            const expanded = expandedMealId === meal.id;
            const isLogging = loggingMealId === meal.id;

            return (
              <View style={[s.mealCard, isActive && s.mealCardActive]}>
                <View style={s.mealHeader}>
                  <Pressable
                    onLongPress={drag}
                    delayLongPress={120}
                    style={({ pressed }) => [s.dragHandleBtn, pressed && s.pressed]}
                    hitSlop={8}
                  >
                    <Ionicons name="reorder-three-outline" size={16} color="#6b7280" />
                  </Pressable>

                  <Pressable
                    onPress={() => onEditMeal(meal)}
                    style={({ pressed }) => [s.mealHeaderLeft, pressed && s.pressed]}
                  >
                    <View style={s.mealTopRow}>
                      <Text style={s.mealName} numberOfLines={1}>{meal.name}</Text>
                    </View>
                    <Text style={s.mealMeta} numberOfLines={1}>
                      {Math.round(meal.totalCalories)} kcal · {Math.round(meal.totalProtein)}g P · {Math.round(meal.totalCarbs)}g C · {Math.round(meal.totalFats)}g F
                    </Text>
                  </Pressable>

                  <View style={s.headerActions}>
                    <Pressable
                      onPress={() => handleLog(meal.id)}
                      disabled={isLogging}
                      style={({ pressed }) => [s.logTextBtn, isLogging && s.disabled, pressed && s.pressed]}
                      hitSlop={8}
                    >
                      {isLogging ? (
                        <ActivityIndicator size="small" color="#16a34a" />
                      ) : (
                        <Text style={s.logTextBtnLabel}>Log</Text>
                      )}
                    </Pressable>

                    <Pressable
                      onPress={() => setExpandedMealId(expanded ? null : meal.id)}
                      style={({ pressed }) => [s.expandBtn, pressed && s.pressed]}
                      hitSlop={8}
                    >
                      <Ionicons
                        name={expanded ? "chevron-up" : "chevron-down"}
                        size={16}
                        color="#9ca3af"
                      />
                    </Pressable>
                  </View>
                </View>

                {expanded && (
                  <View style={s.expandedContent}>
                    {meal.items.map((item) => (
                      <View key={item.id} style={s.itemRow}>
                        <Text style={s.itemName} numberOfLines={1}>
                          {item.foodName}
                        </Text>
                        <Text style={s.itemMeta}>{Math.round(item.grams)}g</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    gap: 10,
  },
  center: {
    paddingVertical: 24,
    alignItems: "center",
  },
  empty: {
    fontSize: 13,
    color: "#9ca3af",
    textAlign: "center",
    paddingVertical: 16,
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
  list: {
    gap: 8,
  },
  mealCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  mealCardActive: {
    opacity: 0.9,
    borderColor: "#86efac",
  },
  mealHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  mealHeaderLeft: {
    flex: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dragHandleBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
  },
  mealTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
  },
  mealName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  mealMeta: {
    fontSize: 10,
    color: "#6b7280",
    marginTop: 1,
  },
  expandBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f9fafb",
  },
  logTextBtn: {
    minWidth: 44,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  logTextBtnLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#166534",
    letterSpacing: 0.2,
  },
  expandedContent: {
    paddingHorizontal: 10,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    gap: 2,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
  },
  itemName: {
    flex: 1,
    fontSize: 11,
    color: "#374151",
    marginRight: 8,
  },
  itemMeta: {
    fontSize: 10,
    color: "#9ca3af",
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.65,
  },
});
