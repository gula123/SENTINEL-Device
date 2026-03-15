import dayjs from "dayjs";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LineChart } from "react-native-chart-kit";
import { useMetrics } from "../../hooks/useMetrics";
import { useAuth } from "../../state/AuthContext";

type DailyPoint = {
  date: string;
  caloriesConsumed: number;
  carbsConsumed: number;
  proteinConsumed: number;
  fatsConsumed: number;
  habitCompletions: number;
  weightChange: number;
  calorieLimit: number;
  carbsLimit: number;
  proteinLimit: number;
  fatsLimit: number;
  hasFoodData: boolean;
};

type MonthlyPoint = {
  monthKey: string;
  monthLabel: string;
  habitScore: number;
  calorieAdherence: number;
};

type Stats = {
  monthlyHabitRate: number;
  yearlyHabitRate: number;
  monthlyCalorieAdherence: number;
  yearlyCalorieAdherence: number;
  monthlyCorrelation: number;
  yearlyCorrelation: number;
  monthlyCarbsAdherence: number;
  yearlyCarbsAdherence: number;
  monthlyProteinAdherence: number;
  yearlyProteinAdherence: number;
  monthlyFatsAdherence: number;
  yearlyFatsAdherence: number;
  monthlyPerMealCalorieAdherence: number;
  yearlyPerMealCalorieAdherence: number;
};

type PerDayLimits = Record<
  string,
  {
    overall?: {
      calories?: number;
      carbs?: number;
      protein?: number;
      fats?: number;
    };
    meals?: Record<string, { calories?: number }>;
  }
>;

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const calculateMaximumSuccess = (consumed: number, limit: number) => {
  if (limit <= 0) return 0;
  if (consumed <= limit) return 100;
  return (limit / consumed) * 100;
};

const calculateMinimumSuccess = (consumed: number, limit: number) => {
  if (limit <= 0) return 0;
  if (consumed >= limit) return 100;
  return (consumed / limit) * 100;
};

const clampOneDecimal = (value: number) => Number(value.toFixed(1));

type MetricColorTier = {
  bg: string;
  border: string;
  text: string;
};

const getMetricColorTier = (rawValue: number): MetricColorTier => {
  const value = Math.max(0, Math.min(100, rawValue));

  if (value < 50) {
    return { bg: "#fee2e2", border: "#fca5a5", text: "#991b1b" }; // red
  }
  if (value < 65) {
    return { bg: "#ffedd5", border: "#fdba74", text: "#9a3412" }; // orange
  }
  if (value < 80) {
    return { bg: "#fef9c3", border: "#fde047", text: "#854d0e" }; // yellow
  }
  if (value < 90) {
    return { bg: "#dcfce7", border: "#86efac", text: "#166534" }; // light green
  }

  return { bg: "#bbf7d0", border: "#4ade80", text: "#14532d" }; // strong green
};

export default function MetricsScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const { signOut } = useAuth();
  const metricsQuery = useMetrics();

  const isAuthExpired = metricsQuery.error instanceof Error && metricsQuery.error.message === "AUTH_EXPIRED";

  const { stats, monthlyData } = useMemo(() => {
    const emptyStats: Stats = {
      monthlyHabitRate: 0,
      yearlyHabitRate: 0,
      monthlyCalorieAdherence: 0,
      yearlyCalorieAdherence: 0,
      monthlyCorrelation: 50,
      yearlyCorrelation: 50,
      monthlyCarbsAdherence: 0,
      yearlyCarbsAdherence: 0,
      monthlyProteinAdherence: 0,
      yearlyProteinAdherence: 0,
      monthlyFatsAdherence: 0,
      yearlyFatsAdherence: 0,
      monthlyPerMealCalorieAdherence: 0,
      yearlyPerMealCalorieAdherence: 0,
    };

    if (!metricsQuery.data) {
      return { stats: emptyStats, monthlyData: [] as MonthlyPoint[] };
    }

    const { foodLogs, habitLogs, weightLogs, userSettings } = metricsQuery.data;

    const defaultDailyCalorieLimit = Number(userSettings?.dailyCalorieLimit) || 1800;
    const defaultDailyCarbsLimit = Number(userSettings?.dailyCarbsLimit) || 250;
    const defaultDailyProteinLimit = Number(userSettings?.dailyProteinLimit) || 150;
    const defaultDailyFatsLimit = Number(userSettings?.dailyFatsLimit) || 65;

    const defaultMealCalorieLimits = {
      breakfast: 600,
      lunch: 700,
      dinner: 600,
      snacks: 100,
    };

    let perDayLimits: PerDayLimits = {};
    try {
      perDayLimits = userSettings?.perDayCalorieLimits
        ? (JSON.parse(userSettings.perDayCalorieLimits) as PerDayLimits)
        : {};
    } catch {
      perDayLimits = {};
    }

    const dailyLimitsForDate = (date: string) => {
      const dayName = DAY_NAMES[dayjs(date).day()];
      const config = perDayLimits[dayName];
      return {
        calories: Number(config?.overall?.calories) || defaultDailyCalorieLimit,
        carbs: Number(config?.overall?.carbs) || defaultDailyCarbsLimit,
        protein: Number(config?.overall?.protein) || defaultDailyProteinLimit,
        fats: Number(config?.overall?.fats) || defaultDailyFatsLimit,
        meals: {
          breakfast: Number(config?.meals?.breakfast?.calories) || defaultMealCalorieLimits.breakfast,
          lunch: Number(config?.meals?.lunch?.calories) || defaultMealCalorieLimits.lunch,
          dinner: Number(config?.meals?.dinner?.calories) || defaultMealCalorieLimits.dinner,
          snacks: Number(config?.meals?.snacks?.calories) || defaultMealCalorieLimits.snacks,
        },
      };
    };

    const groupedByDate = new Map<
      string,
      {
        calories: number;
        carbs: number;
        protein: number;
        fats: number;
        habitCount: number;
        hasFoodData: boolean;
      }
    >();

    foodLogs.forEach((log) => {
      if (!log.logDate) return;
      const current = groupedByDate.get(log.logDate) || {
        calories: 0,
        carbs: 0,
        protein: 0,
        fats: 0,
        habitCount: 0,
        hasFoodData: false,
      };
      current.calories += Number(log.calories) || 0;
      current.carbs += Number(log.carbs) || 0;
      current.protein += Number(log.protein) || 0;
      current.fats += Number(log.fats) || 0;
      current.hasFoodData = true;
      groupedByDate.set(log.logDate, current);
    });

    habitLogs.forEach((log) => {
      if (!log.logDate || !log.completed) return;
      const current = groupedByDate.get(log.logDate) || {
        calories: 0,
        carbs: 0,
        protein: 0,
        fats: 0,
        habitCount: 0,
        hasFoodData: false,
      };
      current.habitCount += 1;
      groupedByDate.set(log.logDate, current);
    });

    const sortedWeights = [...weightLogs]
      .filter((log) => Boolean(log.measurementDate) && Number.isFinite(log.weight))
      .sort((a, b) => dayjs(a.measurementDate).valueOf() - dayjs(b.measurementDate).valueOf());

    const weightChangeByDate = new Map<string, number>();
    for (let i = 1; i < sortedWeights.length; i += 1) {
      const current = sortedWeights[i];
      const prev = sortedWeights[i - 1];
      weightChangeByDate.set(current.measurementDate, current.weight - prev.weight);
    }

    const dailyPoints: DailyPoint[] = Array.from(groupedByDate.entries())
      .map(([date, value]) => {
        const limits = dailyLimitsForDate(date);
        return {
          date,
          caloriesConsumed: value.calories,
          carbsConsumed: value.carbs,
          proteinConsumed: value.protein,
          fatsConsumed: value.fats,
          habitCompletions: value.habitCount,
          weightChange: weightChangeByDate.get(date) || 0,
          calorieLimit: limits.calories,
          carbsLimit: limits.carbs,
          proteinLimit: limits.protein,
          fatsLimit: limits.fats,
          hasFoodData: value.hasFoodData,
        };
      })
      .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());

    const now = dayjs();
    const monthlyDailyPoints = dailyPoints.filter((point) => dayjs(point.date).isSame(now, "month"));
    const yearlyDailyPoints = dailyPoints.filter((point) => dayjs(point.date).isSame(now, "year"));

    const maxHabitsPerDay = 5;
    const habitRate = (points: DailyPoint[]) => {
      const possible = points.length * maxHabitsPerDay;
      if (possible === 0) return 0;
      return clampOneDecimal((points.reduce((sum, p) => sum + p.habitCompletions, 0) / possible) * 100);
    };

    const averageAdherence = (
      points: DailyPoint[],
      calc: (consumed: number, limit: number) => number,
      consumedKey: keyof Pick<DailyPoint, "caloriesConsumed" | "carbsConsumed" | "proteinConsumed" | "fatsConsumed">,
      limitKey: keyof Pick<DailyPoint, "calorieLimit" | "carbsLimit" | "proteinLimit" | "fatsLimit">
    ) => {
      const withFood = points.filter((point) => point.hasFoodData);
      if (withFood.length === 0) return 0;
      const total = withFood.reduce(
        (sum, point) => sum + calc(point[consumedKey] as number, point[limitKey] as number),
        0
      );
      return clampOneDecimal(total / withFood.length);
    };

    const mealTotalsByDateType = new Map<string, number>();
    foodLogs.forEach((log) => {
      const mealType = typeof log.mealType === "string" ? log.mealType.toLowerCase() : "";
      if (!log.logDate || !["breakfast", "lunch", "dinner", "snacks"].includes(mealType)) {
        return;
      }
      const key = `${log.logDate}|${mealType}`;
      mealTotalsByDateType.set(key, (mealTotalsByDateType.get(key) || 0) + (Number(log.calories) || 0));
    });

    const mealAdherence = (scope: "month" | "year") => {
      let total = 0;
      let count = 0;

      mealTotalsByDateType.forEach((consumed, key) => {
        const [date, mealType] = key.split("|");
        const pointDate = dayjs(date);
        const inScope = scope === "month" ? pointDate.isSame(now, "month") : pointDate.isSame(now, "year");
        if (!inScope) return;

        const dailyMealLimits = dailyLimitsForDate(date).meals;
        const limit = dailyMealLimits[mealType as keyof typeof dailyMealLimits] || 0;
        total += calculateMaximumSuccess(consumed, limit);
        count += 1;
      });

      if (count === 0) return 0;
      return clampOneDecimal(total / count);
    };

    const correlationFor = (points: DailyPoint[]) => {
      const withWeightChange = points.filter((point) => point.weightChange !== 0);
      if (withWeightChange.length < 2) return 50;

      const x = withWeightChange.map((point) => point.habitCompletions);
      const y = withWeightChange.map((point) => -point.weightChange);
      const xMean = x.reduce((sum, value) => sum + value, 0) / x.length;
      const yMean = y.reduce((sum, value) => sum + value, 0) / y.length;

      let covariance = 0;
      let xVariance = 0;
      let yVariance = 0;

      for (let i = 0; i < x.length; i += 1) {
        const xDev = x[i] - xMean;
        const yDev = y[i] - yMean;
        covariance += xDev * yDev;
        xVariance += xDev * xDev;
        yVariance += yDev * yDev;
      }

      if (xVariance === 0 || yVariance === 0) return 50;
      const pearson = covariance / Math.sqrt(xVariance * yVariance);
      return clampOneDecimal(((pearson + 1) / 2) * 100);
    };

    const monthlyMap = new Map<string, { label: string; points: DailyPoint[] }>();
    for (let i = 11; i >= 0; i -= 1) {
      const date = now.subtract(i, "month");
      const key = date.format("YYYY-MM");
      monthlyMap.set(key, { label: date.format("MMM"), points: [] });
    }

    dailyPoints.forEach((point) => {
      const key = dayjs(point.date).format("YYYY-MM");
      const bucket = monthlyMap.get(key);
      if (bucket) bucket.points.push(point);
    });

    const monthlySeries: MonthlyPoint[] = Array.from(monthlyMap.entries()).map(([monthKey, bucket]) => {
      const habits = habitRate(bucket.points);
      const cal = averageAdherence(bucket.points, calculateMaximumSuccess, "caloriesConsumed", "calorieLimit");
      return {
        monthKey,
        monthLabel: bucket.label,
        habitScore: habits,
        calorieAdherence: cal,
      };
    });

    return {
      stats: {
        monthlyHabitRate: habitRate(monthlyDailyPoints),
        yearlyHabitRate: habitRate(yearlyDailyPoints),
        monthlyCalorieAdherence: averageAdherence(monthlyDailyPoints, calculateMaximumSuccess, "caloriesConsumed", "calorieLimit"),
        yearlyCalorieAdherence: averageAdherence(yearlyDailyPoints, calculateMaximumSuccess, "caloriesConsumed", "calorieLimit"),
        monthlyCorrelation: correlationFor(monthlyDailyPoints),
        yearlyCorrelation: correlationFor(yearlyDailyPoints),
        monthlyCarbsAdherence: averageAdherence(monthlyDailyPoints, calculateMaximumSuccess, "carbsConsumed", "carbsLimit"),
        yearlyCarbsAdherence: averageAdherence(yearlyDailyPoints, calculateMaximumSuccess, "carbsConsumed", "carbsLimit"),
        monthlyProteinAdherence: averageAdherence(monthlyDailyPoints, calculateMinimumSuccess, "proteinConsumed", "proteinLimit"),
        yearlyProteinAdherence: averageAdherence(yearlyDailyPoints, calculateMinimumSuccess, "proteinConsumed", "proteinLimit"),
        monthlyFatsAdherence: averageAdherence(monthlyDailyPoints, calculateMaximumSuccess, "fatsConsumed", "fatsLimit"),
        yearlyFatsAdherence: averageAdherence(yearlyDailyPoints, calculateMaximumSuccess, "fatsConsumed", "fatsLimit"),
        monthlyPerMealCalorieAdherence: mealAdherence("month"),
        yearlyPerMealCalorieAdherence: mealAdherence("year"),
      },
      monthlyData: monthlySeries,
    };
  }, [metricsQuery.data]);

  const chartWidth = Math.max(280, windowWidth - 68);
  const labels = monthlyData.map((point, index) => {
    if (index % 2 === 0 || index === monthlyData.length - 1) return point.monthLabel;
    return "";
  });

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.pageTitle}>Metrics</Text>
        <Text style={s.pageSubtitle}>Use this page to spot what is working and what you can improve next.</Text>

        {metricsQuery.isLoading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color="#16a34a" />
            <Text style={s.muted}>Loading metrics...</Text>
          </View>
        ) : null}

        {metricsQuery.isError ? (
          <View style={s.errorBox}>
            <Text style={s.errorTitle}>{isAuthExpired ? "Session expired" : "Failed to load metrics"}</Text>
            <Text style={s.errorText}>
              {isAuthExpired ? "Please sign in again." : (metricsQuery.error as Error).message}
            </Text>
            <View style={s.errorActions}>
              {isAuthExpired ? (
                <Pressable onPress={signOut} style={({ pressed }) => [s.secondaryBtn, pressed && s.pressed]}>
                  <Text style={s.secondaryBtnText}>Sign in again</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => metricsQuery.refetch()} style={({ pressed }) => [s.primaryBtn, pressed && s.pressed]}>
                <Text style={s.primaryBtnText}>Retry</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {!metricsQuery.isLoading && !metricsQuery.isError ? (
          <>
            <View style={s.cardGrid}>
              <StatPairCard title="Habit Completion Rate" month={stats.monthlyHabitRate} year={stats.yearlyHabitRate} />
              <StatPairCard title="Calorie Target Success" month={stats.monthlyCalorieAdherence} year={stats.yearlyCalorieAdherence} />
              <StatPairCard title="Habit-Weight Correlation" month={stats.monthlyCorrelation} year={stats.yearlyCorrelation} />
              <StatPairCard title="Carbs Target Success" month={stats.monthlyCarbsAdherence} year={stats.yearlyCarbsAdherence} />
              <StatPairCard title="Protein Target Success" month={stats.monthlyProteinAdherence} year={stats.yearlyProteinAdherence} />
              <StatPairCard title="Fat Target Success" month={stats.monthlyFatsAdherence} year={stats.yearlyFatsAdherence} />
              <StatPairCard title="Per-Meal Calorie Success" month={stats.monthlyPerMealCalorieAdherence} year={stats.yearlyPerMealCalorieAdherence} />
            </View>

            <View style={s.chartCard}>
              <Text style={s.chartTitle}>Monthly Habit Score vs Calorie Success</Text>
              <Text style={s.chartSub}>Last 12 months</Text>
              <View style={s.chartBox}>
                <LineChart
                  data={{
                    labels,
                    datasets: [
                      { data: monthlyData.map((point) => point.habitScore), strokeWidth: 2.5, color: () => "#16a34a" },
                      { data: monthlyData.map((point) => point.calorieAdherence), strokeWidth: 2.5, color: () => "#f97316" },
                    ],
                    legend: ["Habits %", "Calories %"],
                  }}
                  width={chartWidth}
                  height={220}
                  withHorizontalLabels
                  withVerticalLabels
                  withDots={false}
                  withInnerLines
                  withOuterLines
                  withVerticalLines={false}
                  segments={5}
                  fromNumber={0}
                  yAxisSuffix="%"
                  chartConfig={{
                    backgroundColor: "#f8fafc",
                    backgroundGradientFrom: "#f8fafc",
                    backgroundGradientTo: "#f8fafc",
                    decimalPlaces: 0,
                    color: () => "#111827",
                    labelColor: () => "#4b5563",
                    propsForBackgroundLines: { stroke: "#e2e8f0", strokeWidth: 1 },
                    propsForLabels: { fontSize: 11 },
                  }}
                  bezier
                  style={s.chart}
                />
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatPairCard({
  title,
  month,
  year,
}: {
  title: string;
  month: number;
  year: number;
}) {
  const monthValue = Math.max(0, Math.min(100, month));
  const yearValue = Math.max(0, Math.min(100, year));
  const monthTier = getMetricColorTier(monthValue);
  const yearTier = getMetricColorTier(yearValue);
  const cardTier = getMetricColorTier((monthValue + yearValue) / 2);

  return (
    <View style={[s.statCard, { borderColor: cardTier.border }]}>
      <Text style={s.statTitle}>{title}</Text>
      <View style={s.statRow}>
        <View style={s.statItem}>
          <View style={[s.valuePill, { backgroundColor: monthTier.bg, borderColor: monthTier.border }]}>
            <Text style={[s.statValue, { color: monthTier.text }]}>{monthValue.toFixed(1)}%</Text>
          </View>
          <Text style={s.statCaption}>This Month</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <View style={[s.valuePill, { backgroundColor: yearTier.bg, borderColor: yearTier.border }]}>
            <Text style={[s.statValue, { color: yearTier.text }]}>{yearValue.toFixed(1)}%</Text>
          </View>
          <Text style={s.statCaption}>This Year</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fdfb" },
  scroll: { padding: 20, gap: 14, paddingBottom: 40 },
  pageTitle: { fontSize: 24, fontWeight: "800", color: "#111827" },
  pageSubtitle: { marginTop: -4, fontSize: 13, color: "#6b7280" },

  loadingBox: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  muted: { fontSize: 12, color: "#6b7280" },

  errorBox: {
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    padding: 12,
    gap: 8,
  },
  errorTitle: { fontSize: 14, fontWeight: "700", color: "#991b1b" },
  errorText: { fontSize: 12, color: "#b91c1c" },
  errorActions: { flexDirection: "row", gap: 8 },

  primaryBtn: {
    alignSelf: "flex-start",
    borderRadius: 10,
    backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  secondaryBtn: {
    alignSelf: "flex-start",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#111827",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryBtnText: { color: "#111827", fontWeight: "700", fontSize: 12 },
  pressed: { opacity: 0.7 },

  cardGrid: { gap: 10 },
  statCard: {
    backgroundColor: "#fffaf3",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f1dcc8",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 8,
    shadowColor: "#7c4a1e",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  statTitle: { fontSize: 13, color: "#5b4636", fontWeight: "800" },
  statRow: { flexDirection: "row", alignItems: "center" },
  statItem: { flex: 1, alignItems: "center" },
  valuePill: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    minWidth: 92,
    alignItems: "center",
  },
  statValue: { fontSize: 20, fontWeight: "800" },
  statCaption: { fontSize: 11, color: "#a38266", marginTop: 3, fontWeight: "600" },
  statDivider: { width: 1, height: 36, backgroundColor: "#efdcc9" },

  chartCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    gap: 8,
  },
  chartTitle: { fontSize: 15, fontWeight: "800", color: "#111827" },
  chartSub: { fontSize: 12, color: "#6b7280" },
  chartBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    overflow: "hidden",
  },
  chart: {
    borderRadius: 10,
    marginLeft: -16,
  },
});
