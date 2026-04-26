import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LineChart } from "react-native-chart-kit";
import { useWeightDiary } from "../../hooks/useWeightDiary";
import { useAuth } from "../../state/AuthContext";
import { useLanguage } from "../../state/LanguageContext";

export default function WeightDiaryScreen() {
  const { signOut } = useAuth();
  const { t } = useLanguage();
  const { todayQuery, historyQuery, statsQuery, saveWeightMutation } = useWeightDiary();
  const { width: windowWidth } = useWindowDimensions();

  const [displayWeight, setDisplayWeight] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAuthExpired =
    (todayQuery.error instanceof Error && todayQuery.error.message === "AUTH_EXPIRED") ||
    (historyQuery.error instanceof Error && historyQuery.error.message === "AUTH_EXPIRED") ||
    (statsQuery.error instanceof Error && statsQuery.error.message === "AUTH_EXPIRED");

  const latestKnownWeight = useMemo(() => {
    if (todayQuery.data?.weight != null) {
      return todayQuery.data.weight;
    }

    const history = historyQuery.data || [];
    if (history.length === 0) {
      return null;
    }

    return history[history.length - 1].weight;
  }, [todayQuery.data, historyQuery.data]);

  useEffect(() => {
    if (!isEditing) {
      setDisplayWeight(latestKnownWeight ?? null);
      if (latestKnownWeight != null) {
        setInputValue(latestKnownWeight.toFixed(1));
      }
    }
  }, [latestKnownWeight, isEditing]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const queueSave = (weight: number) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(async () => {
      try {
        await saveWeightMutation.mutateAsync(weight);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to save weight";
        if (msg === "AUTH_EXPIRED") {
          signOut();
          return;
        }
        Alert.alert("Save failed", msg);
      }
    }, 450);
  };

  const handleStepChange = (delta: number) => {
    const base = displayWeight ?? latestKnownWeight ?? 70;
    const next = Math.round((base + delta) * 10) / 10;
    setDisplayWeight(next);
    setInputValue(next.toFixed(1));
    queueSave(next);
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);

    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      const normalized = Math.round(parsed * 10) / 10;
      setDisplayWeight(normalized);
      queueSave(normalized);
    }
  };

  const handleInputCommit = () => {
    const parsed = Number(inputValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      if (latestKnownWeight != null) {
        setInputValue(latestKnownWeight.toFixed(1));
      }
      setIsEditing(false);
      return;
    }

    const normalized = Math.round(parsed * 10) / 10;
    setDisplayWeight(normalized);
    setInputValue(normalized.toFixed(1));
    queueSave(normalized);
    setIsEditing(false);
  };

  const chartData = useMemo(() => {
    const history = historyQuery.data || [];
    if (history.length === 0 && latestKnownWeight == null) {
      return [] as Array<{ key: string; date: string; weight: number }>;
    }

    const map = new Map<string, number>();
    history.forEach((entry) => {
      map.set(entry.measurementDate, entry.weight);
    });

    if (latestKnownWeight != null) {
      map.set(dayjs().format("YYYY-MM-DD"), latestKnownWeight);
    }

    return Array.from(map.entries())
      .map(([date, weight]) => ({ key: date, date, weight }))
      .sort((a, b) => dayjs(a.date).diff(dayjs(b.date)))
      .slice(-24);
  }, [historyQuery.data, latestKnownWeight]);

  const weeklyChartData = useMemo(() => {
    if (chartData.length === 0) {
      return [] as Array<{ key: string; date: string; monthLabel: string; weight: number }>;
    }

    const weekLastPoint = new Map<string, { date: string; weight: number }>();
    chartData.forEach((point) => {
      const weekKey = dayjs(point.date).startOf("week").format("YYYY-MM-DD");
      const existing = weekLastPoint.get(weekKey);
      if (!existing || dayjs(point.date).isAfter(existing.date)) {
        weekLastPoint.set(weekKey, { date: point.date, weight: point.weight });
      }
    });

    const today = dayjs();
    const start = today.startOf("month").subtract(11, "month").startOf("week");
    const endWeek = today.startOf("week");

    const points: Array<{ key: string; date: string; monthLabel: string; weight: number }> = [];
    let cursor = start;
    let lastKnownWeight: number | null = null;

    while (cursor.isBefore(endWeek) || cursor.isSame(endWeek, "day")) {
      const weekKey = cursor.format("YYYY-MM-DD");
      const weekPoint = weekLastPoint.get(weekKey);
      if (weekPoint) {
        lastKnownWeight = weekPoint.weight;
      }

      if (lastKnownWeight != null) {
        const isCurrentWeek = cursor.isSame(endWeek, "day");
        points.push({
          key: weekKey,
          date: weekPoint?.date || (isCurrentWeek ? today.format("YYYY-MM-DD") : cursor.format("YYYY-MM-DD")),
          monthLabel: cursor.format("MMM"),
          weight: lastKnownWeight,
        });
      }

      cursor = cursor.add(1, "week");
    }

    return points;
  }, [chartData]);

  const chartMetrics = useMemo(() => {
    if (weeklyChartData.length === 0) {
      return {
        min: 0,
        max: 0,
        axisMin: 0,
        axisMax: 10,
        tickInterval: 1,
        segments: 4,
        labelStep: 2,
      };
    }

    const weights = weeklyChartData.map((point) => point.weight);
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const weightRange = max - min;

    let tickInterval: number;
    if (weightRange >= 30) {
      tickInterval = 10;
    } else if (weightRange >= 10) {
      tickInterval = 5;
    } else {
      tickInterval = 1;
    }

    // Keep visible headroom/footroom so the line never hugs chart bounds.
    const axisPadding = Math.max(5, weightRange * 0.35);
    const yMin = min - axisPadding;
    const yMax = Math.max(min + axisPadding, max + axisPadding);
    const axisMin = Math.floor(yMin / tickInterval) * tickInterval;
    const axisMax = Math.ceil(yMax / tickInterval) * tickInterval;
    const axisSpan = axisMax - axisMin;

    // ChartKit becomes unreadable with many labels on small mobile heights.
    const maxVisibleLabels = 6;
    const minVisibleLabels = 4;
    const rawTicks = Math.max(2, Math.round(axisSpan / tickInterval) + 1);
    const targetLabels = Math.min(maxVisibleLabels, Math.max(minVisibleLabels, rawTicks));
    const segments = Math.max(1, targetLabels - 1);
    const labelStep = axisSpan / segments;

    return { min, max, axisMin, axisMax, tickInterval, segments, labelStep };
  }, [weeklyChartData]);

  const chartWidth = Math.max(280, windowWidth - 68);
  const chartLabels = useMemo(() => {
    if (weeklyChartData.length === 0) return [] as string[];
    let previousMonth = "";
    return weeklyChartData.map((point) => {
      const currentMonth = dayjs(point.date).format("MMM");
      if (currentMonth === previousMonth) {
        return "";
      }
      previousMonth = currentMonth;
      return currentMonth;
    });
  }, [weeklyChartData]);

  const chartDataset = useMemo(() => {
    return weeklyChartData.map((point) => Number(point.weight.toFixed(2)));
  }, [weeklyChartData]);

  const axisFloorDataset = useMemo(() => {
    if (weeklyChartData.length === 0) return [] as number[];
    return [chartMetrics.axisMin];
  }, [weeklyChartData.length, chartMetrics.axisMin]);

  const axisCeilDataset = useMemo(() => {
    if (weeklyChartData.length === 0) return [] as number[];
    return [chartMetrics.axisMax];
  }, [weeklyChartData.length, chartMetrics.axisMax]);

  const stats = statsQuery.data;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.pageTitle}>{t("weight.title")}</Text>

        {isAuthExpired ? (
          <View style={s.errorBox}>
            <Text style={s.errorTitle}>{t("weight.sessionExpired")}</Text>
            <Text style={s.errorText}>{t("weight.signInAgain")}</Text>
            <Pressable onPress={signOut} style={({ pressed }) => [s.primaryBtn, pressed && s.pressed]}>
              <Text style={s.primaryBtnText}>{t("weight.signInButton")}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={s.chartCard}>
          <Text style={s.chartTitle}>{t("weight.progressChart")}</Text>
          {historyQuery.isLoading ? (
            <ActivityIndicator size="small" color="#16a34a" style={{ marginTop: 8 }} />
          ) : weeklyChartData.length === 0 ? (
            <Text style={s.muted}>{t("weight.noData")}</Text>
          ) : (
            <>
              <Text style={s.chartSub}>{t("weight.chartSubtitle")}</Text>
              <View style={s.chartBox}>
                <LineChart
                  data={{
                    labels: chartLabels,
                    datasets: [
                      { data: chartDataset, strokeWidth: 2.5, color: () => "#16a34a" },
                      // Single-point anchors force y-domain min/max without NaN rendering issues.
                      { data: axisFloorDataset, strokeWidth: 0, color: () => "rgba(0,0,0,0)" },
                      { data: axisCeilDataset, strokeWidth: 0, color: () => "rgba(0,0,0,0)" },
                    ],
                  }}
                  width={chartWidth}
                  height={220}
                  fromNumber={chartMetrics.axisMin}
                  withShadow
                  withInnerLines
                  withOuterLines
                  withVerticalLines={false}
                  withHorizontalLabels
                  withVerticalLabels
                  withDots={false}
                  segments={5}
                  yAxisSuffix="kg"
                  formatYLabel={(value) => {
                    const numeric = Number(value);
                    if (!Number.isFinite(numeric)) {
                      return value;
                    }
                    return chartMetrics.labelStep < 1 ? numeric.toFixed(1) : numeric.toFixed(0);
                  }}
                  chartConfig={{
                    backgroundColor: "#f8fafc",
                    backgroundGradientFrom: "#f8fafc",
                    backgroundGradientTo: "#f8fafc",
                    decimalPlaces: 0,
                    color: () => "#111827",
                    labelColor: () => "#4b5563",
                    propsForBackgroundLines: {
                      stroke: "#e2e8f0",
                      strokeWidth: 1,
                    },
                    propsForLabels: {
                      fontSize: 11,
                    },
                  }}
                  bezier
                  style={s.chart}
                />
              </View>
            </>
          )}
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>{t("weight.statistics")}</Text>
          {statsQuery.isLoading ? (
            <ActivityIndicator size="small" color="#16a34a" style={{ marginTop: 8 }} />
          ) : (
            <View style={s.statsGrid}>
              <View style={s.statTile}>
                <Text style={s.statLabel}>{t("weight.totalLost")}</Text>
                <Text style={[s.statValue, { color: "#16a34a" }]}>{stats?.totalWeightLost?.toFixed(1) || "0.0"} kg</Text>
              </View>
              <View style={s.statTile}>
                <Text style={s.statLabel}>{t("weight.avgPerMonth")}</Text>
                <Text style={[s.statValue, { color: "#0284c7" }]}>{stats?.averageMonthlyLoss?.toFixed(2) || "0.00"} kg</Text>
              </View>
              <View style={s.statTile}>
                <Text style={s.statLabel}>{t("weight.target")}</Text>
                <Text style={[s.statValue, { color: "#7c3aed" }]}>{stats?.targetWeight != null ? `${stats.targetWeight.toFixed(1)} kg` : t("weight.notSet")}</Text>
              </View>
              <View style={s.statTile}>
                <Text style={s.statLabel}>{t("weight.eta")}</Text>
                <Text style={[s.statValue, { color: "#ea580c" }]} numberOfLines={1}>{stats?.estimatedTargetDate || t("weight.na")}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>{t("weight.todaysWeight")}</Text>
          {todayQuery.isLoading && latestKnownWeight == null ? (
            <ActivityIndicator size="small" color="#16a34a" style={{ marginTop: 8 }} />
          ) : (
            <View style={s.weightControl}>
              <Pressable
                onPress={() => handleStepChange(-0.1)}
                style={({ pressed }) => [s.stepBtn, pressed && s.pressed]}
              >
                <Text style={s.stepBtnText}>-</Text>
              </Pressable>

              <View style={s.centerValueWrap}>
                <Pressable onPress={() => setIsEditing(true)}>
                  <TextInput
                    value={inputValue}
                    onChangeText={handleInputChange}
                    onBlur={handleInputCommit}
                    onSubmitEditing={handleInputCommit}
                    keyboardType="decimal-pad"
                    underlineColorAndroid="transparent"
                    style={s.input}
                    editable={isEditing}
                    caretHidden={!isEditing}
                    selectTextOnFocus
                    autoFocus={isEditing}
                  />
                </Pressable>
                <Text style={s.weightUnit}>kg</Text>
              </View>

              <Pressable
                onPress={() => handleStepChange(0.1)}
                style={({ pressed }) => [s.stepBtn, pressed && s.pressed]}
              >
                <Text style={s.stepBtnText}>+</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fdfb" },
  scroll: { padding: 20, gap: 14, paddingBottom: 40 },
  pageTitle: { fontSize: 24, fontWeight: "800", color: "#111827" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTitle: { fontSize: 11, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.8 },
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
  muted: { fontSize: 12, color: "#6b7280" },

  chartBox: {
    minHeight: 220,
    position: "relative",
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

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statTile: {
    width: "48%",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    padding: 10,
    gap: 4,
  },
  statLabel: { fontSize: 11, color: "#9ca3af", fontWeight: "700", textTransform: "uppercase" },
  statValue: { fontSize: 16, fontWeight: "800" },

  weightControl: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e5e7eb",
  },
  stepBtnText: { fontSize: 28, fontWeight: "700", color: "#374151", lineHeight: 30 },
  centerValueWrap: { flex: 1, alignItems: "center", minHeight: 62, justifyContent: "center" },
  weightUnit: { fontSize: 16, color: "#6b7280", fontWeight: "600" },
  input: {
    fontSize: 44,
    fontWeight: "800",
    color: "#0284c7",
    textAlign: "center",
    width: 140,
    height: 52,
    lineHeight: 48,
    maxWidth: 140,
    alignSelf: "center",
    borderWidth: 0,
    borderColor: "transparent",
    borderBottomWidth: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 2,
    margin: 0,
    includeFontPadding: false,
    ...(Platform.OS === "web"
      ? {
          outlineWidth: 0,
          outlineColor: "transparent",
          boxShadow: "none",
        }
      : {}),
  },

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
  primaryBtn: {
    alignSelf: "flex-start",
    borderRadius: 10,
    backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  pressed: { opacity: 0.7 },
});
