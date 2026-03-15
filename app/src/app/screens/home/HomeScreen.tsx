import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../../navigation/navigationTypes";
import type { MainTabParamList } from "../../navigation/MainTabs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNutritionSummary } from "../../hooks/useNutritionSummary";
import { useFoodLogs } from "../../hooks/useFoodDiary";
import { useVacationDay } from "../../hooks/useVacationDay";
import { useUserSettings } from "../../hooks/useUserSettings";
import { type FoodLogDto, type MealType } from "../../services/food/foodLogsApi";
import { applyQuickFillDay } from "../../services/quickfill/quickFillService";
import { resolveDayLimits } from "../../services/settings/userSettingsApi";
import { useAuth } from "../../state/AuthContext";

const MEAL_ORDER: MealType[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACKS"];
const MEAL_LABEL: Record<MealType, string> = { BREAKFAST: "Breakfast", LUNCH: "Lunch", DINNER: "Dinner", SNACKS: "Snacks" };
const MEAL_ICON: Record<MealType, string> = { BREAKFAST: "☀️", LUNCH: "🌤️", DINNER: "🌙", SNACKS: "🍎" };
const LIMIT_OK_COLOR = "#16a34a";
const LIMIT_BAD_COLOR = "#dc2626";

function resolveLimitColor(value: number, limit: number, invert = false): string {
  if (limit <= 0) {
    return LIMIT_OK_COLOR;
  }

  if (invert) {
    return value >= limit ? LIMIT_OK_COLOR : LIMIT_BAD_COLOR;
  }

  return value > limit ? LIMIT_BAD_COLOR : LIMIT_OK_COLOR;
}

function MacroCard({ label, value, limit, invertColorByLimit = false }: { label: string; value: number; limit: number; invertColorByLimit?: boolean }) {
  const color = resolveLimitColor(value, limit, invertColorByLimit);
  const pct = limit > 0 ? Math.min(1, value / limit) : 0;
  return (
    <View style={styles.macroCard}>
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={[styles.macroValue, { color }]}>{value}g</Text>
      <Text style={styles.macroLimit}>/{limit}g</Text>
      <View style={styles.macroTrack}>
        <View style={[styles.macroFill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function MealSummaryCard({ meal, items, limits, calLimit, onLogPress }: {
  meal: MealType;
  items: FoodLogDto[];
  limits: { proteinLimit: number; carbsLimit: number; fatsLimit: number } | null;
  calLimit?: number;
  onLogPress?: () => void;
}) {
  const totalCal = items.reduce((s, i) => s + (i.calories || 0), 0);
  const totalProtein = Math.round(items.reduce((s, i) => s + (i.protein || 0), 0));
  const totalCarbs   = Math.round(items.reduce((s, i) => s + (i.carbs   || 0), 0));
  const totalFats    = Math.round(items.reduce((s, i) => s + (i.fats    || 0), 0));

  const pP = limits && limits.proteinLimit > 0 ? Math.min(1, totalProtein / limits.proteinLimit) : 0;
  const pC = limits && limits.carbsLimit   > 0 ? Math.min(1, totalCarbs   / limits.carbsLimit)   : 0;
  const pF = limits && limits.fatsLimit    > 0 ? Math.min(1, totalFats    / limits.fatsLimit)    : 0;

  const calPct  = calLimit && calLimit > 0 ? totalCal / calLimit : 0;
  const calColor = resolveLimitColor(totalCal, calLimit ?? 0);
  const proteinColor = resolveLimitColor(totalProtein, limits?.proteinLimit ?? 0, true);
  const carbsColor = resolveLimitColor(totalCarbs, limits?.carbsLimit ?? 0);
  const fatsColor = resolveLimitColor(totalFats, limits?.fatsLimit ?? 0);

  return (
    <Pressable
      onPress={onLogPress}
      style={({ pressed }) => [styles.mealCard, pressed && styles.mealCardPressed]}
      accessibilityLabel={`Log food for ${MEAL_LABEL[meal]}`}
    >
      <View style={styles.mealHeader}>
        <Text style={styles.mealIcon}>{MEAL_ICON[meal]}</Text>
        <Text style={styles.mealName}>{MEAL_LABEL[meal]}</Text>
        <View style={styles.mealCalBlock}>
          <Text style={[styles.mealCal, { color: calColor }]}>
            {Math.round(totalCal)}{calLimit ? ` / ${calLimit}` : ""} kcal
          </Text>
          {calLimit ? (
            <View style={styles.mealCalTrack}>
              <View style={[styles.mealCalFill, { width: `${Math.min(100, Math.round(calPct * 100))}%` as any, backgroundColor: calColor }]} />
            </View>
          ) : null}
        </View>
      </View>

      {items.length === 0 ? (
        <Text style={styles.mealEmpty}>Nothing logged</Text>
      ) : (
        <>
          {items.map((item) => (
            <View key={item.id} style={styles.mealItem}>
              <Text style={styles.mealItemName} numberOfLines={1}>{item.foodName}</Text>
              <Text style={styles.mealItemMeta}>{Math.round(item.grams)}g · {Math.round(item.calories)} kcal</Text>
            </View>
          ))}
        </>
      )}

      <View style={styles.mealMacroRow}>
        <View style={styles.mealMacro}>
          <View style={styles.mealMacroLabelRow}>
            <Text style={[styles.mealMacroDot, { backgroundColor: proteinColor }]} />
            <Text style={styles.mealMacroText}>P {totalProtein}g</Text>
            {limits ? <Text style={styles.mealMacroLimit}>/{limits.proteinLimit}g</Text> : null}
          </View>
          <View style={styles.mealMacroTrack}>
            <View style={[styles.mealMacroFill, { width: `${Math.round(pP * 100)}%` as any, backgroundColor: proteinColor }]} />
          </View>
        </View>
        <View style={styles.mealMacro}>
          <View style={styles.mealMacroLabelRow}>
            <Text style={[styles.mealMacroDot, { backgroundColor: carbsColor }]} />
            <Text style={styles.mealMacroText}>C {totalCarbs}g</Text>
            {limits ? <Text style={styles.mealMacroLimit}>/{limits.carbsLimit}g</Text> : null}
          </View>
          <View style={styles.mealMacroTrack}>
            <View style={[styles.mealMacroFill, { width: `${Math.round(pC * 100)}%` as any, backgroundColor: carbsColor }]} />
          </View>
        </View>
        <View style={styles.mealMacro}>
          <View style={styles.mealMacroLabelRow}>
            <Text style={[styles.mealMacroDot, { backgroundColor: fatsColor }]} />
            <Text style={styles.mealMacroText}>F {totalFats}g</Text>
            {limits ? <Text style={styles.mealMacroLimit}>/{limits.fatsLimit}g</Text> : null}
          </View>
          <View style={styles.mealMacroTrack}>
            <View style={[styles.mealMacroFill, { width: `${Math.round(pF * 100)}%` as any, backgroundColor: fatsColor }]} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const QUICK_FILL_LEVELS = [1.25, 1.5, 2, 3];

// ─── Per-day content (extracted so each page in the pager is independent) ───
function DayView({
  date,
  width,
  height,
  shouldFetch,
  navigation,
  token,
  signOut,
}: {
  date: string;
  width: number;
  height: number;
  shouldFetch: boolean;
  navigation: NativeStackNavigationProp<MainStackParamList>;
  token: string | null;
  signOut: () => void;
}) {
  const queryClient = useQueryClient();
  const [showFillOptions, setShowFillOptions] = useState(false);
  const { data, isLoading, isError, error, refetch } = useNutritionSummary(date, { enabled: shouldFetch });
  const logsQuery = useFoodLogs(date, { enabled: shouldFetch });
  const vacation = useVacationDay(date, { enabled: shouldFetch });
  const settingsQuery = useUserSettings();

  const totals = useMemo(() => {
    const items = logsQuery.data || [];
    return {
      calories: items.reduce((s, i) => s + (i.calories || 0), 0),
      protein:  items.reduce((s, i) => s + (i.protein  || 0), 0),
      carbs:    items.reduce((s, i) => s + (i.carbs    || 0), 0),
      fats:     items.reduce((s, i) => s + (i.fats     || 0), 0),
    };
  }, [logsQuery.data]);

  const quickFillMutation = useMutation({
    mutationFn: async (multiplier: number) => {
      if (!token) throw new Error("AUTH_REQUIRED");
      if (vacation.isVacationDay) throw new Error("Quick Fill is disabled on vacation days");
      const limits = resolveDayLimits(settingsQuery.data, date);
      return applyQuickFillDay({ token, date, multiplier, totals, limits });
    },
    onSuccess: async (result, multiplier) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["foodLogs", date] }),
        queryClient.invalidateQueries({ queryKey: ["nutritionSummary", date] }),
      ]);
      if (result.skipped) {
        Alert.alert("Quick Fill", `Already at or above ${Math.round(multiplier * 100)}% target.`);
      } else {
        Alert.alert("Quick Fill", `Added ${result.createdEntries} entries.`);
      }
    },
    onError: (err: any) => {
      if (err.message === "AUTH_EXPIRED") { signOut(); return; }
      Alert.alert("Quick Fill failed", err.message ?? "Unknown error");
    },
  });

  const handleToggleVacation = async () => {
    try {
      const next = await vacation.toggle();
      Alert.alert("Vacation", next ? "Day marked as vacation" : "Vacation removed");
    } catch (err: any) {
      if (err.message === "AUTH_EXPIRED") { signOut(); return; }
      Alert.alert("Error", err.message ?? "Could not toggle vacation");
    }
  };

  const grouped = useMemo(() => {
    const byMeal: Record<MealType, FoodLogDto[]> = { BREAKFAST: [], LUNCH: [], DINNER: [], SNACKS: [] };
    (logsQuery.data || []).forEach((item) => {
      const meal = (item.mealType || "SNACKS") as MealType;
      byMeal[meal].push(item);
    });
    return byMeal;
  }, [logsQuery.data]);

  const dayLimits = useMemo(() => resolveDayLimits(settingsQuery.data, date), [settingsQuery.data, date]);

  const isAuthExpired = error instanceof Error && error.message === "AUTH_EXPIRED";
  const calorieGoal = data ? data.caloriesConsumed + data.caloriesRemaining : 0;
  const calorieProgress = calorieGoal > 0 ? data!.caloriesConsumed / calorieGoal : 0;
  const calorieProgressBar = Math.min(1, calorieProgress);
  const calorieColor = data ? resolveLimitColor(data.caloriesConsumed, calorieGoal) : LIMIT_OK_COLOR;

  return (
    <ScrollView
      style={{ width, height: height > 0 ? height : undefined }}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      {/* Compact actions strip */}
      <View style={styles.actionsStrip}>
        <Pressable
          onPress={handleToggleVacation}
          disabled={vacation.isLoading || vacation.isToggling}
          style={({ pressed }) => [
            styles.vacationChip,
            vacation.isVacationDay && styles.vacationChipActive,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={[styles.vacationChipText, vacation.isVacationDay && styles.vacationChipTextActive]}>
            {vacation.isVacationDay ? "🏖️ Vacation" : "🏖️ Off day"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setShowFillOptions((v) => !v)}
          disabled={vacation.isVacationDay || quickFillMutation.isPending}
          style={({ pressed }) => [
            styles.quickFillTrigger,
            showFillOptions && styles.quickFillTriggerActive,
            (vacation.isVacationDay || quickFillMutation.isPending) && styles.disabledChip,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={[styles.quickFillTriggerText, showFillOptions && styles.quickFillTriggerTextActive]}>
            {quickFillMutation.isPending ? "⏳" : "⚡"} Quick Fill
          </Text>
        </Pressable>
      </View>

      {showFillOptions ? (
        <View style={styles.fillOptionsRow}>
          <Text style={styles.fillOptionsLabel}>Fill to</Text>
          {QUICK_FILL_LEVELS.map((level) => (
            <Pressable
              key={level}
              onPress={() => { quickFillMutation.mutate(level); setShowFillOptions(false); }}
              disabled={quickFillMutation.isPending || settingsQuery.isLoading}
              style={({ pressed }) => [styles.quickFillChip, pressed && styles.buttonPressed]}
            >
              <Text style={styles.quickFillChipText}>{Math.round(level * 100)}%</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.loadingText}>Loading your summary…</Text>
        </View>
      ) : null}

      {isError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Could not load daily summary</Text>
          <Text style={styles.errorText}>
            {isAuthExpired ? "Session expired. Please sign in again." : (error as Error).message}
          </Text>
          <View style={styles.row}>
            {isAuthExpired ? (
              <Pressable onPress={signOut} accessibilityRole="button"
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
              >
                <Text style={styles.secondaryButtonText}>Sign in again</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => refetch()} accessibilityRole="button"
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.primaryButtonText}>Retry</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {data ? (
        <>
          <View style={styles.calorieCard}>
            <Text style={styles.calorieLabel}>Daily Calories</Text>
            <View style={styles.calorieRow}>
              <Text style={[styles.calorieConsumed, { color: calorieColor }]}>{data.caloriesConsumed}</Text>
              <Text style={styles.calorieSlash}> / </Text>
              <Text style={styles.calorieGoalText}>{calorieGoal}</Text>
              <Text style={styles.calorieUnit}> kcal</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(calorieProgressBar * 100)}%` as any, backgroundColor: calorieColor }]} />
            </View>
            <View style={styles.calorieFooter}>
              <Text style={styles.remainingText}>{data.caloriesRemaining} kcal remaining</Text>
              <Text style={[styles.progressPct, { color: calorieColor }]}>{Math.round(calorieProgress * 100)}%</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Macronutrients</Text>
          <View style={styles.macroRow}>
            <MacroCard label="Protein" value={data.protein} limit={data.proteinLimit} invertColorByLimit />
            <MacroCard label="Carbs"   value={data.carbs}   limit={data.carbsLimit} />
            <MacroCard label="Fats"    value={data.fats}    limit={data.fatsLimit} />
          </View>
        </>
      ) : null}

      <Text style={styles.sectionTitle}>Meals</Text>
      {logsQuery.isLoading ? (
        <ActivityIndicator size="small" color="#16a34a" />
      ) : (
        MEAL_ORDER.map((meal) => (
          <MealSummaryCard
            key={meal}
            meal={meal}
            items={grouped[meal]}
            limits={data ? {
              proteinLimit: dayLimits.mealMacros[meal].protein,
              carbsLimit: dayLimits.mealMacros[meal].carbs,
              fatsLimit: dayLimits.mealMacros[meal].fats,
            } : null}
            calLimit={dayLimits.mealCalories[meal]}
            onLogPress={() => navigation.navigate("LogFood", { meal, date })}
          />
        ))
      )}
    </ScrollView>
  );
}

// ─── Shell: fixed header + FlatList infinite day pager ───
export default function HomeScreen() {
  const { user, signOut, token } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainTabParamList, "Diary">>();
  const { width } = useWindowDimensions();
  const todayStr = dayjs().format("YYYY-MM-DD");

  // 361 days: 180 before today → today → 180 after
  const DAYS_RANGE = 180;
  const allDates = useMemo(() => {
    const arr: string[] = [];
    for (let i = -DAYS_RANGE; i <= DAYS_RANGE; i++) {
      arr.push(dayjs(todayStr).add(i, "day").format("YYYY-MM-DD"));
    }
    return arr;
  }, [todayStr]);
  const todayIndex = DAYS_RANGE;

  const [activeIndex, setActiveIndex] = useState(todayIndex);
  const [initialIndex, setInitialIndex] = useState(todayIndex);
  const [listSeed, setListSeed] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  const [focusTarget, setFocusTarget] = useState<{ date: string; token: number } | null>(null);
  const listRef = useRef<FlatList<string>>(null);
  const activeDate = allDates[activeIndex] ?? todayStr;
  const isToday = activeDate === todayStr;

  const goToToday = () => {
    listRef.current?.scrollToIndex({ index: todayIndex, animated: true });
  };

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setActiveIndex(viewableItems[0].index);
    }
  });

  const getItemLayout = (_: any, index: number) => ({
    length: width,
    offset: width * index,
    index,
  });

  useEffect(() => {
    const targetDate = route.params?.date;
    if (!targetDate) {
      return;
    }

    const targetIndex = allDates.indexOf(targetDate);
    if (targetIndex < 0) {
      return;
    }

    const token = route.params?.focusToken ?? Date.now();
    setFocusTarget({ date: targetDate, token });

    // Re-mount FlatList at target index to avoid virtualization race conditions.
    setInitialIndex(targetIndex);
    setActiveIndex(targetIndex);
    setListSeed((value) => value + 1);
  }, [route.params?.date, route.params?.focusToken, allDates]);

  useEffect(() => {
    if (focusTarget && activeDate === focusTarget.date) {
      setFocusTarget(null);
    }
  }, [activeDate, focusTarget]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Fixed header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.greeting}>
            {user?.name ? `Hi, ${user.name.split(" ")[0]} 👋` : "Welcome back"}
          </Text>
          {!isToday ? (
            <Pressable onPress={goToToday} style={({ pressed }) => [styles.todayPill, pressed && styles.buttonPressed]}>
              <Text style={styles.todayPillText}>↩ Today</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.dateLabelWrap}>
          <Text style={styles.dateLabelMain}>{isToday ? "Today" : dayjs(activeDate).format("dddd")}</Text>
          <Text style={styles.dateLabelSub}>{dayjs(activeDate).format("MMM D, YYYY")}</Text>
        </View>
      </View>

      <FlatList
        key={`diary-${listSeed}-${initialIndex}`}
        ref={listRef}
        data={allDates}
        keyExtractor={(item) => item}
        renderItem={({ item: date, index }) => (
          <DayView
            date={date}
            width={width}
            height={listHeight}
            shouldFetch={date === activeDate || Math.abs(index - activeIndex) <= 1 || focusTarget?.date === date}
            navigation={navigation}
            token={token}
            signOut={signOut}
          />
        )}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={getItemLayout}
        initialScrollIndex={initialIndex}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfig.current}
        windowSize={5}
        maxToRenderPerBatch={3}
        removeClippedSubviews={false}
        style={{ flex: 1 }}
        onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          const safeIndex = Math.max(0, Math.min(index, allDates.length - 1));
          const estimatedItemLength = averageItemLength > 0 ? averageItemLength : width;
          listRef.current?.scrollToOffset({ offset: safeIndex * estimatedItemLength, animated: false });

          setTimeout(() => {
            listRef.current?.scrollToIndex({ index: safeIndex, animated: false });
          }, 80);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fdfb" },
  scroll: { padding: 20, gap: 16, paddingBottom: Platform.OS === "web" ? 80 : 40 },

  // Fixed header
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    gap: 10,
  },
  headerTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  greeting: { fontSize: 20, fontWeight: "700", color: "#111827" },
  todayBadge: { backgroundColor: "#dcfce7", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  todayBadgeText: { fontSize: 12, fontWeight: "600", color: "#166534" },
  todayPill: {
    borderWidth: 1, borderColor: "#bbf7d0",
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
    backgroundColor: "#f0fdf4",
  },
  todayPillText: { fontSize: 12, fontWeight: "600", color: "#16a34a" },
  dateLabelWrap: { gap: 1 },
  dateLabelMain: { fontSize: 16, fontWeight: "700", color: "#111827" },
  dateLabelSub: { fontSize: 11, color: "#9ca3af" },

  // Loading
  centerBox: { backgroundColor: "#f0fdf4", borderRadius: 16, padding: 24, alignItems: "center", gap: 10 },
  loadingText: { fontSize: 14, color: "#4b5563" },

  // Error
  errorBox: { backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", borderRadius: 16, padding: 14, gap: 8 },
  errorTitle: { color: "#991b1b", fontWeight: "700" },
  errorText: { color: "#b91c1c", fontSize: 12 },
  row: { flexDirection: "row", gap: 8 },
  primaryButton: { backgroundColor: "#16a34a", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
  secondaryButton: { borderWidth: 1, borderColor: "#fecaca", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  secondaryButtonText: { color: "#991b1b", fontWeight: "600" },
  buttonPressed: { opacity: 0.7 },

  actionsStrip: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  vacationChip: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: "#d1d5db",
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: "#f9fafb",
  },
  vacationChipActive: { backgroundColor: "#fef9c3", borderColor: "#fde047" },
  vacationChipText: { fontSize: 12, fontWeight: "600", color: "#374151" },
  vacationChipTextActive: { color: "#854d0e" },
  quickFillTrigger: {
    borderWidth: 1, borderColor: "#bbf7d0",
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: "#f0fdf4",
  },
  quickFillTriggerActive: { backgroundColor: "#dcfce7", borderColor: "#16a34a" },
  quickFillTriggerText: { fontSize: 12, fontWeight: "700", color: "#166534" },
  quickFillTriggerTextActive: { color: "#14532d" },
  fillOptionsRow: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "flex-end" },
  fillOptionsLabel: { fontSize: 11, fontWeight: "700", color: "#9ca3af", marginRight: 2 },
  quickFillChip: {
    borderWidth: 1, borderColor: "#bbf7d0",
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: "#f0fdf4",
  },
  disabledChip: { opacity: 0.4 },
  quickFillChipText: { fontSize: 12, fontWeight: "700", color: "#166534" },

  // Calorie card
  calorieCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    shadowColor: "#16a34a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    gap: 8,
  },
  calorieLabel: { fontSize: 11, color: "#6b7280", fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  calorieRow: { flexDirection: "row", alignItems: "flex-end" },
  calorieConsumed: { fontSize: 40, fontWeight: "800", color: "#166534" },
  calorieSlash: { fontSize: 22, color: "#9ca3af", marginBottom: 4 },
  calorieGoalText: { fontSize: 22, color: "#9ca3af", marginBottom: 4 },
  calorieUnit: { fontSize: 14, color: "#9ca3af", marginBottom: 6 },
  progressTrack: { height: 8, backgroundColor: "#dcfce7", borderRadius: 99, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#16a34a", borderRadius: 99 },
  calorieFooter: { flexDirection: "row", justifyContent: "space-between" },
  remainingText: { fontSize: 12, color: "#6b7280" },
  progressPct: { fontSize: 12, color: "#16a34a", fontWeight: "700" },

  // Macros
  sectionTitle: { fontSize: 11, fontWeight: "700", color: "#9ca3af", letterSpacing: 0.8, textTransform: "uppercase" },
  macroRow: { flexDirection: "row", gap: 10 },
  macroCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  macroLabel: { fontSize: 10, color: "#9ca3af", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  macroValue: { fontSize: 22, fontWeight: "800", marginTop: 2 },
  macroLimit: { fontSize: 11, color: "#9ca3af" },
  macroTrack: { height: 4, backgroundColor: "#f3f4f6", borderRadius: 99, overflow: "hidden", marginTop: 6 },
  macroFill: { height: "100%", borderRadius: 99 },

  // Refresh
  refreshButton: {
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#f0fdf4",
  },
  refreshText: { color: "#166534", fontWeight: "600", fontSize: 14 },

  // Meal summaries
  mealCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  mealCardPressed: { opacity: 0.75 },
  mealHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  mealIcon: { fontSize: 16 },
  mealName: { flex: 1, fontSize: 14, fontWeight: "700", color: "#111827" },
  mealCalBlock: { alignItems: "flex-end", gap: 3 },
  mealCal: { fontSize: 13, fontWeight: "600", color: "#16a34a" },
  mealCalTrack: { width: 80, height: 4, backgroundColor: "#f3f4f6", borderRadius: 99, overflow: "hidden" },
  mealCalFill: { height: "100%" as any, borderRadius: 99 },
  mealEmpty: { fontSize: 12, color: "#9ca3af", fontStyle: "italic" },

  // Log pill in meal header (removed — card is now fully tappable)
  mealItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 3, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  mealItemName: { flex: 1, fontSize: 13, color: "#374151", marginRight: 8 },
  mealItemMeta: { fontSize: 12, color: "#9ca3af" },

  // Per-meal macro bars
  mealMacroRow: { flexDirection: "row", gap: 8, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  mealMacro: { flex: 1, gap: 3 },
  mealMacroLabelRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  mealMacroDot: { width: 6, height: 6, borderRadius: 3 },
  mealMacroText: { fontSize: 11, fontWeight: "700", color: "#374151" },
  mealMacroLimit: { fontSize: 10, color: "#9ca3af" },
  mealMacroTrack: { height: 4, backgroundColor: "#f3f4f6", borderRadius: 99, overflow: "hidden" },
  mealMacroFill: { height: "100%" as any, borderRadius: 99 },
});
