import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, LayoutAnimation, Platform, Pressable, StyleSheet, Text, TextInput, UIManager, View } from "react-native";

if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}
import type { FoodItem, PortionDto } from "../services/food/foodLogsApi";

interface FrequentFoodsSectionProps {
  foods: FoodItem[] | undefined;
  isLoading: boolean;
  onLoadPortions: (foodId: number) => Promise<PortionDto[]>;
  onAddFood: (food: FoodItem, grams: number) => Promise<void>;
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
  addBtnDisabled: {
    opacity: 0.5,
  },
  addBtnText: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "700",
  },
  helper: {
    fontSize: 11,
    color: "#6b7280",
  },
  emptyText: {
    fontSize: 12,
    color: "#9ca3af",
    fontStyle: "italic",
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
  },
});

export function FrequentFoodsSection({
  foods,
  isLoading,
  onLoadPortions,
  onAddFood,
}: FrequentFoodsSectionProps) {
  const displayFoods = useMemo(() => {
    return foods ? foods.slice(0, 12) : [];
  }, [foods]);

  const [expandedFoodId, setExpandedFoodId] = useState<number | null>(null);
  const [portionsByFoodId, setPortionsByFoodId] = useState<Record<number, PortionDto[]>>({});
  const [selectedPortionIdByFoodId, setSelectedPortionIdByFoodId] = useState<Record<number, number | null>>({});
  const [gramsByFoodId, setGramsByFoodId] = useState<Record<number, string>>({});
  const [portionAmountByFoodId, setPortionAmountByFoodId] = useState<Record<number, string>>({});
  const [loadingPortionsByFoodId, setLoadingPortionsByFoodId] = useState<Record<number, boolean>>({});
  const [addingFoodId, setAddingFoodId] = useState<number | null>(null);

  useEffect(() => {
    displayFoods.forEach((food) => {
      if (gramsByFoodId[food.id] === undefined) {
        setGramsByFoodId((prev) => ({ ...prev, [food.id]: "100" }));
      }
      if (portionAmountByFoodId[food.id] === undefined) {
        setPortionAmountByFoodId((prev) => ({ ...prev, [food.id]: "1" }));
      }
      if (selectedPortionIdByFoodId[food.id] === undefined) {
        setSelectedPortionIdByFoodId((prev) => ({ ...prev, [food.id]: null }));
      }
    });
  }, [displayFoods]);

  const onToggleFood = async (foodId: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (expandedFoodId === foodId) {
      setExpandedFoodId(null);
      return;
    }
    setExpandedFoodId(foodId);
    if (!portionsByFoodId[foodId] && !loadingPortionsByFoodId[foodId]) {
      await loadPortions(foodId);
    }
  };

  const loadPortions = async (foodId: number) => {
    if (portionsByFoodId[foodId]) {
      return;
    }
    setLoadingPortionsByFoodId((prev) => ({ ...prev, [foodId]: true }));
    try {
      const portions = await onLoadPortions(foodId);
      setPortionsByFoodId((prev) => ({ ...prev, [foodId]: portions }));
    } finally {
      setLoadingPortionsByFoodId((prev) => ({ ...prev, [foodId]: false }));
    }
  };

  const resolveGrams = (foodId: number): number => {
    const portions = portionsByFoodId[foodId] || [];
    const selectedPortionId = selectedPortionIdByFoodId[foodId] ?? null;
    const selectedPortion = portions.find((p) => p.id === selectedPortionId) || null;
    if (selectedPortion) {
      const amountRaw = Number(portionAmountByFoodId[foodId] || "1");
      const amount = Number.isFinite(amountRaw) && amountRaw > 0 ? amountRaw : 0;
      return Math.round(selectedPortion.grams * amount * 10) / 10;
    }
    const gramsRaw = Number(gramsByFoodId[foodId] || "100");
    return Number.isFinite(gramsRaw) && gramsRaw > 0 ? gramsRaw : 0;
  };

  const onAdd = async (food: FoodItem) => {
    const grams = resolveGrams(food.id);
    if (!Number.isFinite(grams) || grams <= 0) {
      return;
    }
    setAddingFoodId(food.id);
    try {
      await onAddFood(food, grams);
    } finally {
      setAddingFoodId(null);
    }
  };

  if (isLoading) {
    return (
      <View style={s.container}>
        <Text style={s.title}>Frequently Logged</Text>
        <View style={s.loadingContainer}>
          <ActivityIndicator size="small" color="#16a34a" />
        </View>
      </View>
    );
  }

  if (!displayFoods || displayFoods.length === 0) {
    return (
      <View style={s.container}>
        <Text style={s.title}>Frequently Logged</Text>
        <Text style={s.emptyText}>No frequently logged foods yet.</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>Frequently Logged</Text>
      <View style={s.results}>
        {displayFoods.map((food, index) => {
          const portions = portionsByFoodId[food.id] || [];
          const isExpanded = expandedFoodId === food.id;
          const selectedPortionId = selectedPortionIdByFoodId[food.id] ?? null;
          const selectedPortion = portions.find((p) => p.id === selectedPortionId) || null;
          const grams = resolveGrams(food.id);
          const factor = grams / 100;
          const calories = Math.round(food.calories * factor);
          const protein = Math.round(food.protein * factor * 10) / 10;
          const carbs = Math.round(food.carbs * factor * 10) / 10;
          const fats = Math.round(food.fats * factor * 10) / 10;
          const isAdding = addingFoodId === food.id;
          const isLast = index === displayFoods.length - 1;

          return (
            <View key={food.id} style={[s.foodEntry, isExpanded && s.foodEntryExpanded, !isLast && !isExpanded && s.foodEntryBorder]}>
              <Pressable
                onPress={() => onToggleFood(food.id)}
                style={({ pressed }) => [s.resultRow, !isExpanded && pressed && s.pressed]}
              >
                <View style={s.resultTextCol}>
                  <Text style={[s.resultName, isExpanded && s.resultNameExpanded]} numberOfLines={1}>{food.name}</Text>
                  {food.brandOrPlace ? <Text style={s.resultSubmeta} numberOfLines={1}>{food.brandOrPlace}</Text> : null}
                </View>
                <Text style={s.resultMeta}>{Math.round(food.calories)} kcal</Text>
              </Pressable>

              {isExpanded ? (
                <View style={s.expandContent}>
                  <View style={[s.portionRow, loadingPortionsByFoodId[food.id] && { minHeight: 40, justifyContent: "center" }]}>
                    {loadingPortionsByFoodId[food.id] ? (
                      <ActivityIndicator size="small" color="#16a34a" />
                    ) : (
                      <>
                        <Pressable
                          onPress={() => setSelectedPortionIdByFoodId((prev) => ({ ...prev, [food.id]: null }))}
                          style={[s.portionChip, selectedPortionId === null && s.portionChipActive]}
                        >
                          <Text style={[s.portionChipText, selectedPortionId === null && s.portionChipTextActive]}>Grams</Text>
                        </Pressable>
                        {portions.map((portion) => (
                          <Pressable
                            key={portion.id}
                            onPress={() => setSelectedPortionIdByFoodId((prev) => ({ ...prev, [food.id]: portion.id }))}
                            style={[s.portionChip, selectedPortionId === portion.id && s.portionChipActive]}
                          >
                            <Text style={[s.portionChipText, selectedPortionId === portion.id && s.portionChipTextActive]}>
                              {portion.portionName} ({Math.round(portion.grams)}g)
                            </Text>
                          </Pressable>
                        ))}
                      </>
                    )}
                  </View>

                  <View style={s.previewBox}>
                    <Text style={s.previewTitle}>
                      {selectedPortion
                        ? `Will add (${portionAmountByFoodId[food.id] || "1"} x ${selectedPortion.portionName} = ${grams}g)`
                        : `Will add (${grams}g)`}
                    </Text>
                    <View style={s.previewRow}>
                      <Text style={s.previewItem}>🔥 {calories} kcal</Text>
                      <Text style={s.previewItem}>🥩 {protein}g P</Text>
                      <Text style={s.previewItem}>🍚 {carbs}g C</Text>
                      <Text style={s.previewItem}>🥑 {fats}g F</Text>
                    </View>
                  </View>

                  <View style={s.controlsRow}>
                    <TextInput
                      value={selectedPortion ? (portionAmountByFoodId[food.id] ?? "1") : (gramsByFoodId[food.id] ?? "100")}
                      onChangeText={(value) => {
                        if (selectedPortion) {
                          setPortionAmountByFoodId((prev) => ({ ...prev, [food.id]: value }));
                          return;
                        }
                        setGramsByFoodId((prev) => ({ ...prev, [food.id]: value }));
                      }}
                      keyboardType="numeric"
                      placeholder={selectedPortion ? "Amount" : "Grams"}
                      placeholderTextColor="#9ca3af"
                      style={s.input}
                    />
                    <Pressable
                      onPress={() => onAdd(food)}
                      style={[s.addBtn, (isAdding || grams <= 0) && s.addBtnDisabled]}
                      disabled={isAdding || grams <= 0}
                    >
                      <Text style={s.addBtnText}>{isAdding ? "Adding..." : "Add"}</Text>
                    </Pressable>
                  </View>

                  {selectedPortion ? (
                    <Text style={s.helper}>Qty x {selectedPortion.portionName} = {grams}g</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}
