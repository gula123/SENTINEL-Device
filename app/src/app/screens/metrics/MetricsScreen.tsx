import dayjs from "dayjs";
import { useMemo, useState } from "react";
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
import { useLanguage } from "../../state/LanguageContext";

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

type MonthlyOutcome = {
  score: number;
  confidence: "Low" | "Medium" | "High";
  label: string;
  averageDailyCalories: number;
  estimatedMaintenance: number | null;
  planAdequacy: "Supports loss" | "Near maintenance" | "Too lenient" | "Insufficient history";
  dayTypes: { green: number; yellow: number; orange: number; red: number; active: number };
  drivers: string[];
};

type HistoricalMonthSummary = {
  monthKey: string;
  averageDailyCalories: number;
  loggedDays: number;
  weightDelta: number | null;
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

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const classifyDayType = (consumed: number, limit: number) => {
  if (limit <= 0) return "active" as const;
  const ratio = consumed / limit;
  if (ratio < 1.0) return "perfect" as const;
  if (ratio < 1.08) return "good" as const;
  if (ratio < 1.15) return "warning" as const;
  if (ratio < 1.25) return "caution" as const;
  return "exceeded" as const;
};

const outcomeLabelForScoreKey = (score: number) => {
  if (score >= 35) return "metrics.likelyLoss";
  if (score <= -35) return "metrics.likelyGain";
  return "metrics.likelyMaintenance";
};

const average = (values: number[]) => values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

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
  const { t } = useLanguage();
  const metricsQuery = useMetrics();

  const isAuthExpired = metricsQuery.error instanceof Error && metricsQuery.error.message === "AUTH_EXPIRED";

  const { stats, monthlyData, outcome } = useMemo(() => {
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

    const emptyOutcome: MonthlyOutcome = {
      score: 0,
      confidence: "Low",
      label: "Likely maintenance",
      averageDailyCalories: 0,
      estimatedMaintenance: null,
      planAdequacy: "Insufficient history",
      dayTypes: { green: 0, yellow: 0, orange: 0, red: 0, active: 0 },
      drivers: ["metrics.notEnoughData"],  // i18n key, resolved in render
    };

    if (!metricsQuery.data) {
      return { stats: emptyStats, monthlyData: [] as MonthlyPoint[], outcome: emptyOutcome };
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

    const monthlyWeightSummary = new Map<string, { first: number; last: number; count: number }>();
    sortedWeights.forEach((log) => {
      const monthKey = dayjs(log.measurementDate).format("YYYY-MM");
      const current = monthlyWeightSummary.get(monthKey);
      if (!current) {
        monthlyWeightSummary.set(monthKey, { first: log.weight, last: log.weight, count: 1 });
        return;
      }
      current.last = log.weight;
      current.count += 1;
      monthlyWeightSummary.set(monthKey, current);
    });

    const historicalMonths: HistoricalMonthSummary[] = Array.from(monthlyMap.entries()).map(([monthKey, bucket]) => {
      const withFood = bucket.points.filter((point) => point.hasFoodData);
      const averageDailyCalories = withFood.length > 0
        ? average(withFood.map((point) => point.caloriesConsumed))
        : 0;
      const weightSummary = monthlyWeightSummary.get(monthKey);
      const weightDelta = weightSummary && weightSummary.count >= 2
        ? weightSummary.last - weightSummary.first
        : null;

      return {
        monthKey,
        averageDailyCalories,
        loggedDays: withFood.length,
        weightDelta,
      };
    });

    const monthlyHabitRateValue = habitRate(monthlyDailyPoints);
    const yearlyHabitRateValue = habitRate(yearlyDailyPoints);
    const monthlyCalorieAdherenceValue = averageAdherence(monthlyDailyPoints, calculateMaximumSuccess, "caloriesConsumed", "calorieLimit");
    const yearlyCalorieAdherenceValue = averageAdherence(yearlyDailyPoints, calculateMaximumSuccess, "caloriesConsumed", "calorieLimit");
    const monthlyCarbsAdherenceValue = averageAdherence(monthlyDailyPoints, calculateMaximumSuccess, "carbsConsumed", "carbsLimit");
    const yearlyCarbsAdherenceValue = averageAdherence(yearlyDailyPoints, calculateMaximumSuccess, "carbsConsumed", "carbsLimit");
    const monthlyProteinAdherenceValue = averageAdherence(monthlyDailyPoints, calculateMinimumSuccess, "proteinConsumed", "proteinLimit");
    const yearlyProteinAdherenceValue = averageAdherence(yearlyDailyPoints, calculateMinimumSuccess, "proteinConsumed", "proteinLimit");
    const monthlyFatsAdherenceValue = averageAdherence(monthlyDailyPoints, calculateMaximumSuccess, "fatsConsumed", "fatsLimit");
    const yearlyFatsAdherenceValue = averageAdherence(yearlyDailyPoints, calculateMaximumSuccess, "fatsConsumed", "fatsLimit");
    const monthlyPerMealAdherenceValue = mealAdherence("month");
    const yearlyPerMealAdherenceValue = mealAdherence("year");

    const dayTypeCounts = { green: 0, yellow: 0, orange: 0, red: 0, active: 0 };
    const dayTypeScoreMap = {
      perfect: 1.0,
      good: 0.7,
      warning: 0.1,
      caution: -0.5,
      exceeded: -1.0,
      active: 0,
    } as const;
    let dayTypeScoreAccumulator = 0;
    let dayTypeScoreSamples = 0;

    monthlyDailyPoints
      .filter((point) => point.hasFoodData)
      .forEach((point) => {
        const dayType = classifyDayType(point.caloriesConsumed, point.calorieLimit);
        if (dayType === "perfect" || dayType === "good") dayTypeCounts.green += 1;
        else if (dayType === "warning") dayTypeCounts.yellow += 1;
        else if (dayType === "caution") dayTypeCounts.orange += 1;
        else if (dayType === "exceeded") dayTypeCounts.red += 1;
        else dayTypeCounts.active += 1;

        dayTypeScoreAccumulator += dayTypeScoreMap[dayType];
        dayTypeScoreSamples += 1;
      });

    const dayTypeScore = dayTypeScoreSamples > 0 ? clamp((dayTypeScoreAccumulator / dayTypeScoreSamples) * 100, -100, 100) : 0;
    const mealHabitScore = clamp(((monthlyPerMealAdherenceValue - 50) * 2) * 0.6 + ((monthlyHabitRateValue - 50) * 2) * 0.4, -100, 100);

    const monthlyWeightChanges = monthlyDailyPoints.map((point) => point.weightChange).filter((value) => value !== 0);
    const avgWeightChange = monthlyWeightChanges.length > 0
      ? monthlyWeightChanges.reduce((sum, value) => sum + value, 0) / monthlyWeightChanges.length
      : 0;
    const weightTrendScore = clamp(-avgWeightChange * 80, -100, 100);

    const currentMonthKey = now.format("YYYY-MM");
    const currentMonthSummary = historicalMonths.find((month) => month.monthKey === currentMonthKey) || null;
    const priorHistoricalMonths = historicalMonths.filter((month) => month.monthKey !== currentMonthKey && month.loggedDays >= 7 && month.averageDailyCalories > 0);

    const maintenanceCandidates = priorHistoricalMonths
      .filter((month) => month.weightDelta != null && Math.abs(month.weightDelta) <= 0.6)
      .map((month) => month.averageDailyCalories);
    const gainingCandidates = priorHistoricalMonths
      .filter((month) => month.weightDelta != null && month.weightDelta > 0.6)
      .map((month) => month.averageDailyCalories);
    const losingCandidates = priorHistoricalMonths
      .filter((month) => month.weightDelta != null && month.weightDelta < -0.6)
      .map((month) => month.averageDailyCalories);

    let estimatedMaintenance: number | null = null;
    if (maintenanceCandidates.length > 0) {
      estimatedMaintenance = average(maintenanceCandidates);
    } else if (gainingCandidates.length > 0 && losingCandidates.length > 0) {
      estimatedMaintenance = (Math.min(...gainingCandidates) + Math.max(...losingCandidates)) / 2;
    } else if (gainingCandidates.length > 0) {
      estimatedMaintenance = Math.min(...gainingCandidates) * 0.9;
    } else if (losingCandidates.length > 0) {
      estimatedMaintenance = Math.max(...losingCandidates) * 1.1;
    }

    const currentAverageCalories = currentMonthSummary?.averageDailyCalories ?? 0;
    const adequacyDifferencePct = estimatedMaintenance && currentAverageCalories > 0
      ? (currentAverageCalories - estimatedMaintenance) / estimatedMaintenance
      : 0;
    const adequacyScore = estimatedMaintenance && currentAverageCalories > 0
      ? clamp(-(adequacyDifferencePct * 250), -100, 100)
      : 0;

    const planAdequacy: MonthlyOutcome["planAdequacy"] = !estimatedMaintenance || currentAverageCalories <= 0
      ? "Insufficient history"
      : adequacyDifferencePct > 0.07
        ? "Too lenient"
        : adequacyDifferencePct < -0.07
          ? "Supports loss"
          : "Near maintenance";

    const outcomeScore = clamp((dayTypeScore * 0.3) + (mealHabitScore * 0.2) + (weightTrendScore * 0.1) + (adequacyScore * 0.4), -100, 100);

    const loggedDays = monthlyDailyPoints.filter((point) => point.hasFoodData).length;
    const confidence: "High" | "Medium" | "Low" = loggedDays >= 20 && priorHistoricalMonths.length >= 3
      ? "High"
      : loggedDays >= 10 && priorHistoricalMonths.length >= 1
        ? "Medium"
        : "Low";

    const drivers: string[] = [];
    drivers.push(`metrics.driverDayMix|${dayTypeCounts.green}|${dayTypeCounts.yellow}|${dayTypeCounts.orange}|${dayTypeCounts.red}`);

    if (estimatedMaintenance && currentAverageCalories > 0) {
      drivers.push(`metrics.driverAvgIntake|${Math.round(currentAverageCalories)}|${Math.round(estimatedMaintenance)}`);
    }

    drivers.push(`metrics.driverMealConsistency|${Math.round(monthlyPerMealAdherenceValue)}`);
    drivers.push(`metrics.driverHabitCompletion|${Math.round(monthlyHabitRateValue)}`);

    if (avgWeightChange !== 0) {
      const direction = avgWeightChange > 0 ? "Up" : "Down";
      drivers.push(`metrics.driverWeightTrend${direction}|${Math.abs(clampOneDecimal(avgWeightChange))}`);
    }

    if (planAdequacy === "Too lenient") drivers.push("metrics.driverAboveNeutral");
    if (planAdequacy === "Supports loss") drivers.push("metrics.driverBelowNeutral");

    const confidenceReason = `metrics.driverConfidence${confidence === "High" ? "High" : "MediumLow"}|${loggedDays}|${priorHistoricalMonths.length}`;
    drivers.push(confidenceReason);

    return {
      stats: {
        monthlyHabitRate: monthlyHabitRateValue,
        yearlyHabitRate: yearlyHabitRateValue,
        monthlyCalorieAdherence: monthlyCalorieAdherenceValue,
        yearlyCalorieAdherence: yearlyCalorieAdherenceValue,
        monthlyCorrelation: correlationFor(monthlyDailyPoints),
        yearlyCorrelation: correlationFor(yearlyDailyPoints),
        monthlyCarbsAdherence: monthlyCarbsAdherenceValue,
        yearlyCarbsAdherence: yearlyCarbsAdherenceValue,
        monthlyProteinAdherence: monthlyProteinAdherenceValue,
        yearlyProteinAdherence: yearlyProteinAdherenceValue,
        monthlyFatsAdherence: monthlyFatsAdherenceValue,
        yearlyFatsAdherence: yearlyFatsAdherenceValue,
        monthlyPerMealCalorieAdherence: monthlyPerMealAdherenceValue,
        yearlyPerMealCalorieAdherence: yearlyPerMealAdherenceValue,
      },
      monthlyData: monthlySeries,
      outcome: {
        score: clampOneDecimal(outcomeScore),
        confidence,
        label: outcomeLabelForScoreKey(outcomeScore),
        averageDailyCalories: clampOneDecimal(currentAverageCalories),
        estimatedMaintenance: estimatedMaintenance ? clampOneDecimal(estimatedMaintenance) : null,
        planAdequacy,
        dayTypes: dayTypeCounts,
        drivers,
      },
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
        <Text style={s.pageTitle}>{t("metrics.title")}</Text>
        <Text style={s.pageSubtitle}>{t("metrics.subtitle")}</Text>

        {metricsQuery.isLoading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color="#16a34a" />
            <Text style={s.muted}>{t("metrics.loading")}</Text>
          </View>
        ) : null}

        {metricsQuery.isError ? (
          <View style={s.errorBox}>
            <Text style={s.errorTitle}>{isAuthExpired ? t("metrics.sessionExpired") : t("metrics.loadFailed")}</Text>
            <Text style={s.errorText}>
              {isAuthExpired ? t("metrics.signInAgain") : (metricsQuery.error as Error).message}
            </Text>
            <View style={s.errorActions}>
              {isAuthExpired ? (
                <Pressable onPress={signOut} style={({ pressed }) => [s.secondaryBtn, pressed && s.pressed]}>
                  <Text style={s.secondaryBtnText}>{t("metrics.signInButton")}</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => metricsQuery.refetch()} style={({ pressed }) => [s.primaryBtn, pressed && s.pressed]}>
                <Text style={s.primaryBtnText}>{t("metrics.retry")}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {!metricsQuery.isLoading && !metricsQuery.isError ? (
          <>
            <MonthlyOutcomeCard outcome={outcome} />

            <View style={s.cardGrid}>
              <StatPairCard title={t("metrics.habitCompletion")} month={stats.monthlyHabitRate} year={stats.yearlyHabitRate} thisMonthLabel={t("metrics.thisMonth")} thisYearLabel={t("metrics.thisYear")} />
              <StatPairCard title={t("metrics.calorieTarget")} month={stats.monthlyCalorieAdherence} year={stats.yearlyCalorieAdherence} thisMonthLabel={t("metrics.thisMonth")} thisYearLabel={t("metrics.thisYear")} />
              <StatPairCard title={t("metrics.habitWeightCorr")} month={stats.monthlyCorrelation} year={stats.yearlyCorrelation} thisMonthLabel={t("metrics.thisMonth")} thisYearLabel={t("metrics.thisYear")} />
              <StatPairCard title={t("metrics.carbsTarget")} month={stats.monthlyCarbsAdherence} year={stats.yearlyCarbsAdherence} thisMonthLabel={t("metrics.thisMonth")} thisYearLabel={t("metrics.thisYear")} />
              <StatPairCard title={t("metrics.proteinTarget")} month={stats.monthlyProteinAdherence} year={stats.yearlyProteinAdherence} thisMonthLabel={t("metrics.thisMonth")} thisYearLabel={t("metrics.thisYear")} />
              <StatPairCard title={t("metrics.fatTarget")} month={stats.monthlyFatsAdherence} year={stats.yearlyFatsAdherence} thisMonthLabel={t("metrics.thisMonth")} thisYearLabel={t("metrics.thisYear")} />
              <StatPairCard title={t("metrics.perMealCalorie")} month={stats.monthlyPerMealCalorieAdherence} year={stats.yearlyPerMealCalorieAdherence} thisMonthLabel={t("metrics.thisMonth")} thisYearLabel={t("metrics.thisYear")} />
            </View>

            <View style={s.chartCard}>
              <Text style={s.chartTitle}>{t("metrics.chartTitle")}</Text>
              <Text style={s.chartSub}>{t("metrics.last12months")}</Text>
              <View style={s.chartBox}>
                <LineChart
                  data={{
                    labels,
                    datasets: [
                      { data: monthlyData.map((point) => point.habitScore), strokeWidth: 2.5, color: () => "#16a34a" },
                      { data: monthlyData.map((point) => point.calorieAdherence), strokeWidth: 2.5, color: () => "#f97316" },
                    ],
                    legend: [t("metrics.habitsPercent"), t("metrics.caloriesPercent")],
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

function MonthlyOutcomeCard({ outcome }: { outcome: MonthlyOutcome }) {
  const [showSignals, setShowSignals] = useState(false);
  const { t } = useLanguage();
  const pointerLeft = `${((outcome.score + 100) / 200) * 100}%`;

  return (
    <View style={s.outcomeCard}>
      <View style={s.outcomeHeader}>
        <Text style={s.outcomeTitle}>{t("metrics.monthlyOutcome")}</Text>
        <View style={s.outcomeConfidencePill}>
          <Text style={s.outcomeConfidenceText}>{t("metrics.confidence").replace("{confidence}", t(`metrics.confidence${outcome.confidence}`))}</Text>
        </View>
      </View>

      <View style={s.outcomeScaleWrap}>
        <View style={s.outcomeScaleTrack}>
          <View style={s.outcomeScaleLeft} />
          <View style={s.outcomeScaleCenter} />
          <View style={s.outcomeScaleRight} />
        </View>
        <View style={[s.outcomePointer, { left: pointerLeft as `${number}%` }]} />
      </View>

      <View style={s.outcomeLegendRow}>
        <Text style={s.outcomeLegendLeft}>{t("metrics.fatGainRisk")}</Text>
        <Text style={s.outcomeLegendRight}>{t("metrics.weightLossDirection")}</Text>
      </View>

      <Text style={s.outcomeResultLabel}>{t(outcome.label)}</Text>

      <Pressable
        onPress={() => setShowSignals((prev) => !prev)}
        accessibilityRole="button"
        style={({ pressed }) => [s.outcomeSignalsToggle, pressed && s.pressed]}
      >
        <Text style={s.outcomeSignalsToggleText}>{showSignals ? t("metrics.hideSignals") : t("metrics.showSignals")}</Text>
      </Pressable>

      {showSignals ? (
        <View style={s.outcomeSignalsWrap}>
          <Text style={s.outcomeSignalsTitle}>{t("metrics.signalsConsidered")}</Text>
          <View style={s.outcomeSignalGrid}>
            {outcome.drivers.map((driver) => {
              const parts = driver.split("|");
              const key = parts[0];
              const params = parts.slice(1);
              let text: string;
              if (key.startsWith("metrics.")) {
                text = t(key);
                const found = Array.from(text.matchAll(/\{[^}]+\}/g)).map((m) => m[0]);
                found.forEach((placeholder, i) => {
                  if (i < params.length) text = text.replace(placeholder, params[i]);
                });
              } else {
                text = driver;
              }
              return (
                <View key={driver} style={s.outcomeSignalChip}>
                  <Text style={s.outcomeSignalText}>{text}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function StatPairCard({
  title,
  month,
  year,
  thisMonthLabel,
  thisYearLabel,
}: {
  title: string;
  month: number;
  year: number;
  thisMonthLabel: string;
  thisYearLabel: string;
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
          <Text style={s.statCaption}>{thisMonthLabel}</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <View style={[s.valuePill, { backgroundColor: yearTier.bg, borderColor: yearTier.border }]}>
            <Text style={[s.statValue, { color: yearTier.text }]}>{yearValue.toFixed(1)}%</Text>
          </View>
          <Text style={s.statCaption}>{thisYearLabel}</Text>
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

  outcomeCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    gap: 8,
  },
  outcomeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  outcomeTitle: { fontSize: 15, fontWeight: "800", color: "#111827" },
  outcomeSignalsToggle: { alignSelf: "center", paddingVertical: 6, paddingHorizontal: 12, marginTop: 4 },
  outcomeSignalsToggleText: { fontSize: 12, color: "#6b7280", fontWeight: "600" },
  outcomeConfidencePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#f9fafb",
  },
  outcomeConfidenceText: { fontSize: 11, color: "#374151", fontWeight: "700" },
  outcomeScaleWrap: { position: "relative", paddingVertical: 8 },
  outcomeScaleTrack: {
    height: 12,
    borderRadius: 99,
    overflow: "hidden",
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  outcomeScaleLeft: { flex: 1, backgroundColor: "#fecaca" },
  outcomeScaleCenter: { flex: 1, backgroundColor: "#fef9c3" },
  outcomeScaleRight: { flex: 1, backgroundColor: "#86efac" },
  outcomePointer: {
    position: "absolute",
    top: 3,
    width: 2,
    height: 22,
    backgroundColor: "#111827",
    transform: [{ translateX: -1 }],
  },
  outcomeLegendRow: { flexDirection: "row", justifyContent: "space-between" },
  outcomeLegendLeft: { fontSize: 11, color: "#991b1b", fontWeight: "700" },
  outcomeLegendRight: { fontSize: 11, color: "#166534", fontWeight: "700" },
  outcomeResultLabel: { fontSize: 15, fontWeight: "700", color: "#111827", textAlign: "center", marginTop: 4 },
  outcomeSignalsWrap: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingTop: 10,
  },
  outcomeSignalsTitle: { fontSize: 11, color: "#6b7280", fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  outcomeSignalGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  outcomeSignalChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: "100%",
  },
  outcomeSignalText: { fontSize: 11, color: "#374151", fontWeight: "600" },
});
