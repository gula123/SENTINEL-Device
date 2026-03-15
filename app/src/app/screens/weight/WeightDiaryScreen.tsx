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

export default function WeightDiaryScreen() {
  const { signOut } = useAuth();
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

  const chartMetrics = useMemo(() => {
    if (chartData.length === 0) {
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

    const weights = chartData.map((point) => point.weight);
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

    const yMin = min - 5;
    const yMax = Math.max(min + 5, max + 5);
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
  }, [chartData]);

  const chartWidth = Math.max(304, windowWidth - 72);
  const chartLabels = useMemo(() => {
    if (chartData.length === 0) return [] as string[];
    return chartData.map((point, index) => {
      if (index === 0) return dayjs(point.date).format("MMM D");
      if (index === chartData.length - 1) return dayjs(point.date).format("MMM D");
      return "";
    });
  }, [chartData]);

  const chartDataset = useMemo(() => {
    const raw = chartData.map((point) => Number(point.weight.toFixed(2)));
    if (raw.length <= 3) {
      return raw;
    }

    // Two-pass weighted moving average for smoother trend without bezier overshoot artifacts.
    const smoothOnce = (data: number[]) =>
      data.map((value, index) => {
        if (index === 0 || index === data.length - 1) {
          return value;
        }

        const prev = data[index - 1];
        const next = data[index + 1];
        return Number(((prev * 0.25) + (value * 0.5) + (next * 0.25)).toFixed(2));
      });

    return smoothOnce(smoothOnce(raw));
  }, [chartData]);

  const axisFloorDataset = useMemo(() => chartData.map(() => chartMetrics.axisMin), [chartData, chartMetrics.axisMin]);
  const axisCeilDataset = useMemo(() => chartData.map(() => chartMetrics.axisMax), [chartData, chartMetrics.axisMax]);

  const stats = statsQuery.data;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.pageTitle}>Weight Diary</Text>

        {isAuthExpired ? (
          <View style={s.errorBox}>
            <Text style={s.errorTitle}>Session expired</Text>
            <Text style={s.errorText}>Please sign in again.</Text>
            <Pressable onPress={signOut} style={({ pressed }) => [s.primaryBtn, pressed && s.pressed]}>
              <Text style={s.primaryBtnText}>Sign in again</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={s.card}>
          <Text style={s.cardTitle}>Weight Progress</Text>
          {historyQuery.isLoading ? (
            <ActivityIndicator size="small" color="#16a34a" style={{ marginTop: 8 }} />
          ) : chartData.length === 0 ? (
            <Text style={s.muted}>No weight data yet.</Text>
          ) : (
            <>
              <View style={s.chartBox}>
                <LineChart
                  data={{
                    labels: chartLabels,
                    datasets: [
                      { data: chartDataset, strokeWidth: 3 },
                      {
                        data: axisFloorDataset,
                        strokeWidth: 1.6,
                        color: () => "#64748b99",
                      },
                      {
                        data: axisCeilDataset,
                        strokeWidth: 0,
                        color: () => "transparent",
                      },
                    ],
                  }}
                  width={chartWidth}
                  height={180}
                  fromNumber={chartMetrics.axisMin}
                  withShadow={false}
                  withInnerLines
                  withOuterLines
                  withVerticalLines={false}
                  withHorizontalLabels
                  withVerticalLabels
                  withDots={false}
                  yLabelsOffset={6}
                  xLabelsOffset={2}
                  segments={chartMetrics.segments}
                  formatYLabel={(value) => {
                    const numeric = Number(value);
                    if (!Number.isFinite(numeric)) {
                      return value;
                    }
                    return chartMetrics.labelStep < 1 ? numeric.toFixed(1) : numeric.toFixed(0);
                  }}
                  chartConfig={{
                    backgroundColor: "#f0fdf4",
                    backgroundGradientFrom: "#f0fdf4",
                    backgroundGradientTo: "#f0fdf4",
                    decimalPlaces: 1,
                    color: () => "#16a34a",
                    labelColor: () => "#4b5563",
                    propsForDots: {
                      r: "2",
                      strokeWidth: "0",
                      fill: "#16a34a",
                    },
                    propsForBackgroundLines: {
                      stroke: "#e2e8f0",
                      strokeWidth: 1,
                    },
                    propsForLabels: {
                      fontSize: 11,
                    },
                  }}
                  bezier={false}
                  style={s.chart}
                />
              </View>
            </>
          )}
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Statistics</Text>
          {statsQuery.isLoading ? (
            <ActivityIndicator size="small" color="#16a34a" style={{ marginTop: 8 }} />
          ) : (
            <View style={s.statsGrid}>
              <View style={s.statTile}>
                <Text style={s.statLabel}>Total Lost</Text>
                <Text style={[s.statValue, { color: "#16a34a" }]}>{stats?.totalWeightLost?.toFixed(1) || "0.0"} kg</Text>
              </View>
              <View style={s.statTile}>
                <Text style={s.statLabel}>Avg / Month</Text>
                <Text style={[s.statValue, { color: "#0284c7" }]}>{stats?.averageMonthlyLoss?.toFixed(2) || "0.00"} kg</Text>
              </View>
              <View style={s.statTile}>
                <Text style={s.statLabel}>Target</Text>
                <Text style={[s.statValue, { color: "#7c3aed" }]}>{stats?.targetWeight != null ? `${stats.targetWeight.toFixed(1)} kg` : "Not set"}</Text>
              </View>
              <View style={s.statTile}>
                <Text style={s.statLabel}>ETA</Text>
                <Text style={[s.statValue, { color: "#ea580c" }]} numberOfLines={1}>{stats?.estimatedTargetDate || "N/A"}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Today's Weight</Text>
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
  muted: { fontSize: 12, color: "#6b7280" },

  chartBox: {
    minHeight: 180,
    position: "relative",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dcfce7",
    backgroundColor: "#f0fdf4",
    overflow: "hidden",
  },
  chart: {
    borderRadius: 10,
    alignSelf: "center",
    marginLeft: -36,
    marginRight: -20,
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
