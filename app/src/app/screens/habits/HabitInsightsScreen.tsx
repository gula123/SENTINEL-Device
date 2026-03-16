import dayjs from "dayjs";
import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BarChart, LineChart } from "react-native-chart-kit";
import type { MainStackParamList } from "../../navigation/navigationTypes";
import {
  deleteHabitLog,
  deleteGoal,
  deleteHabit,
  fetchHabits,
  getHabitHistoricalScores,
  getHabitLogs,
  getHabitMetrics,
  getHabitMonthlyStats,
  logHabit,
  setGoal,
  updateHabit,
  type Goal,
} from "../../services/habits/habitApi";
import { useAuth } from "../../state/AuthContext";

type FormState = {
  habitName: string;
  description: string;
  goalEnabled: boolean;
  goalType: Extract<Goal["goalType"], "DAYS_PER_WEEK" | "DAYS_PER_MONTH">;
  targetDays: string;
};

const createFormState = (habit?: { habitName: string; description?: string; goal?: Goal }): FormState => ({
  habitName: habit?.habitName ?? "",
  description: habit?.description ?? "",
  goalEnabled: Boolean(habit?.goal),
  goalType: habit?.goal?.goalType === "DAYS_PER_MONTH" ? "DAYS_PER_MONTH" : "DAYS_PER_WEEK",
  targetDays: habit?.goal?.targetDays ? String(habit.goal.targetDays) : "4",
});

function HabitManageModal({
  visible,
  formState,
  setFormState,
  isSaving,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  formState: FormState;
  setFormState: (next: FormState) => void;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Edit Habit</Text>
          <Text style={styles.modalSubtitle}>Update the habit name and regularity from here.</Text>

          <Text style={styles.fieldLabel}>Habit Name</Text>
          <TextInput
            value={formState.habitName}
            onChangeText={(habitName) => setFormState({ ...formState, habitName })}
            placeholder="Habit name"
            placeholderTextColor="#9ca3af"
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            value={formState.description}
            onChangeText={(description) => setFormState({ ...formState, description })}
            placeholder="Optional detail"
            placeholderTextColor="#9ca3af"
            multiline
            style={[styles.input, styles.textArea]}
          />

          <Pressable
            onPress={() => setFormState({ ...formState, goalEnabled: !formState.goalEnabled })}
            style={({ pressed }) => [styles.goalToggle, formState.goalEnabled && styles.goalToggleActive, pressed && styles.pressed]}
          >
            <Text style={[styles.goalToggleText, formState.goalEnabled && styles.goalToggleTextActive]}>
              {formState.goalEnabled ? "Goal enabled" : "Add a goal"}
            </Text>
          </Pressable>

          {formState.goalEnabled ? (
            <>
              <View style={styles.goalTypeRow}>
                {[
                  { label: "Per week", value: "DAYS_PER_WEEK" as const },
                  { label: "Per month", value: "DAYS_PER_MONTH" as const },
                ].map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => setFormState({ ...formState, goalType: option.value })}
                    style={({ pressed }) => [
                      styles.goalTypeChip,
                      formState.goalType === option.value && styles.goalTypeChipActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.goalTypeText, formState.goalType === option.value && styles.goalTypeTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Target Days</Text>
              <TextInput
                value={formState.targetDays}
                onChangeText={(targetDays) => setFormState({ ...formState, targetDays })}
                keyboardType="numeric"
                placeholder="4"
                placeholderTextColor="#9ca3af"
                style={styles.input}
              />
            </>
          ) : null}

          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.modalSecondaryBtn, pressed && styles.pressed]}>
              <Text style={styles.modalSecondaryBtnText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={onSubmit} style={({ pressed }) => [styles.modalPrimaryBtn, (pressed || isSaving) && styles.pressed]}>
              {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalPrimaryBtnText}>Save</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const chartConfig = {
  backgroundColor: "#ffffff",
  backgroundGradientFrom: "#ffffff",
  backgroundGradientTo: "#ffffff",
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(17, 24, 39, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(75, 85, 99, ${opacity})`,
  propsForBackgroundLines: { stroke: "#e5e7eb", strokeWidth: 1 },
  propsForLabels: { fontSize: 10 },
};

type HabitInsightsRoute = RouteProp<MainStackParamList, "HabitInsights">;

const metricTone = (value: number) => {
  if (value >= 85) return { bg: "#dcfce7", text: "#166534", border: "#86efac" };
  if (value >= 65) return { bg: "#fef9c3", text: "#854d0e", border: "#fde047" };
  return { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" };
};

function InsightStat({ label, value }: { label: string; value: number }) {
  const tone = metricTone(value);

  return (
    <View style={[styles.statCard, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <Text style={[styles.statValue, { color: tone.text }]}>{value.toFixed(1)}%</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function HabitInsightsScreen() {
  const { token, signOut } = useAuth();
  const queryClient = useQueryClient();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<HabitInsightsRoute>();
  const { habitId, habitName } = route.params;
  const { width } = useWindowDimensions();
  const [currentMonth, setCurrentMonth] = useState(dayjs().startOf("month"));
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [formState, setFormState] = useState<FormState>(createFormState({ habitName }));

  const habitsQuery = useQuery({
    queryKey: ["habits"],
    queryFn: async () => {
      if (!token) throw new Error("AUTH_REQUIRED");
      return fetchHabits(token);
    },
    enabled: Boolean(token),
  });

  const habitRecord = useMemo(
    () => habitsQuery.data?.find((habit) => habit.id === habitId),
    [habitId, habitsQuery.data]
  );

  const insightsQuery = useQuery({
    queryKey: ["habitInsights", habitId],
    queryFn: async () => {
      if (!token) throw new Error("AUTH_REQUIRED");

      const today = dayjs();
      const recentStart = today.subtract(29, "day").format("YYYY-MM-DD");
      const recentEnd = today.format("YYYY-MM-DD");

      const [metrics, historicalScores, monthlyStats, recentLogs] = await Promise.all([
        getHabitMetrics(token, habitId),
        getHabitHistoricalScores(token, habitId, 12),
        getHabitMonthlyStats(token, habitId, 12),
        getHabitLogs(token, habitId, recentStart, recentEnd),
      ]);

      return { metrics, historicalScores, monthlyStats, recentLogs };
    },
    enabled: Boolean(token),
  });

  const calendarQuery = useQuery({
    queryKey: ["habitCalendar", habitId, currentMonth.format("YYYY-MM")],
    queryFn: async () => {
      if (!token) throw new Error("AUTH_REQUIRED");
      return getHabitLogs(
        token,
        habitId,
        currentMonth.startOf("month").format("YYYY-MM-DD"),
        currentMonth.endOf("month").format("YYYY-MM-DD")
      );
    },
    enabled: Boolean(token),
  });

  const logMutation = useMutation({
    mutationFn: async ({ date, currentValue }: { date: string; currentValue?: boolean }) => {
      if (!token) throw new Error("AUTH_REQUIRED");
      if (currentValue === undefined) {
        return logHabit(token, habitId, date, true);
      }
      if (currentValue === true) {
        return logHabit(token, habitId, date, false);
      }
      return deleteHabitLog(token, habitId, date);
    },
    onMutate: async ({ date, currentValue }) => {
      const queryKey = ["habitCalendar", habitId, currentMonth.format("YYYY-MM")];
      await queryClient.cancelQueries({ queryKey });
      const previousLogs = queryClient.getQueryData<Array<{ logDate: string; completed: boolean }>>(queryKey);

      queryClient.setQueryData<Array<{ logDate: string; completed: boolean }>>(queryKey, (current) => {
        const existing = current || [];

        if (currentValue === undefined) {
          return [...existing, { logDate: date, completed: true }];
        }

        if (currentValue === true) {
          return existing.map((log) =>
            log.logDate === date ? { ...log, completed: false } : log
          );
        }

        return existing.filter((log) => log.logDate !== date);
      });

      return { previousLogs };
    },
    onError: (error, _variables, context) => {
      if (context?.previousLogs) {
        queryClient.setQueryData(["habitCalendar", habitId, currentMonth.format("YYYY-MM")], context.previousLogs);
      }

      void handleError(error, "Failed to update habit day");
    },
    onSuccess: async () => {
      void queryClient.invalidateQueries({ queryKey: ["habitInsights", habitId] });
      void queryClient.invalidateQueries({ queryKey: ["habits"] });
      void queryClient.invalidateQueries({ queryKey: ["habitWidgets"] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("AUTH_REQUIRED");
      const nextName = formState.habitName.trim();
      if (!nextName) throw new Error("Habit name is required");

      const updated = await updateHabit(token, habitId, nextName, formState.description.trim());

      if (formState.goalEnabled) {
        const targetDays = Number(formState.targetDays);
        if (!Number.isFinite(targetDays) || targetDays <= 0) {
          throw new Error("Goal target days must be greater than 0");
        }
        updated.goal = await setGoal(token, habitId, formState.goalType, targetDays);
      } else if (habitRecord?.goal) {
        await deleteGoal(token, habitId);
        delete updated.goal;
      }

      return updated;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["habits"] }),
        queryClient.invalidateQueries({ queryKey: ["habitInsights", habitId] }),
        queryClient.invalidateQueries({ queryKey: ["habitWidgets"] }),
      ]);
      setIsManageModalOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("AUTH_REQUIRED");
      await deleteHabit(token, habitId);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["habits"] }),
        queryClient.invalidateQueries({ queryKey: ["habitInsights"] }),
        queryClient.invalidateQueries({ queryKey: ["habitWidgets"] }),
      ]);
      navigation.goBack();
    },
  });

  const isAuthExpired =
    (insightsQuery.error instanceof Error && insightsQuery.error.message === "AUTH_EXPIRED") ||
    (calendarQuery.error instanceof Error && calendarQuery.error.message === "AUTH_EXPIRED");

  const handleError = async (error: unknown, title: string) => {
    const message = error instanceof Error ? error.message : title;
    if (message === "AUTH_EXPIRED") {
      await signOut();
      return;
    }
    Alert.alert(title, message);
  };

  const chartWidth = Math.max(280, width - 72);

  const pageTitle = habitRecord?.habitName ?? habitName;

  const logsMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    (calendarQuery.data || []).forEach((log) => {
      map[log.logDate] = log.completed;
    });
    return map;
  }, [calendarQuery.data]);

  // Debounce handler for day taps - optimistic UI updates immediately, backend call debounced
  const debouncedLogRef = useRef<{ date: string; currentValue?: boolean } | null>(null);
  const debouncedLogTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleDayTap = useCallback(
    (date: string, currentValue?: boolean) => {
      // Cancel previous debounced call
      if (debouncedLogTimeoutRef.current) {
        clearTimeout(debouncedLogTimeoutRef.current);
      }

      // Store the latest tap
      debouncedLogRef.current = { date, currentValue };

      // Debounce the actual mutation call (300ms delay)
      debouncedLogTimeoutRef.current = setTimeout(() => {
        if (debouncedLogRef.current) {
          logMutation.mutate(debouncedLogRef.current, {
            onError: (error) => {
              void handleError(error, "Failed to update habit day");
            },
          });
          debouncedLogRef.current = null;
        }
      }, 300);

      // Optimistic UI update - immediately cycle through states for smooth feel
      const queryKey = ["habitCalendar", habitId, currentMonth.format("YYYY-MM")];
      const previousLogs = queryClient.getQueryData<Array<{ logDate: string; completed: boolean }>>(queryKey);

      queryClient.setQueryData<Array<{ logDate: string; completed: boolean }>>(queryKey, (current) => {
        const existing = current || [];

        if (currentValue === undefined) {
          return [...existing, { logDate: date, completed: true }];
        }

        if (currentValue === true) {
          return existing.map((log) =>
            log.logDate === date ? { ...log, completed: false } : log
          );
        }

        return existing.filter((log) => log.logDate !== date);
      });
    },
    [habitId, currentMonth, queryClient, logMutation, handleError]
  );

  const scoreChart = useMemo(() => {
    const points = insightsQuery.data?.historicalScores || [];
    return {
      labels: points.map((point, index) => (index % 2 === 0 || index === points.length - 1 ? point.month.slice(0, 3) : "")),
      values: points.map((point) => point.score),
    };
  }, [insightsQuery.data?.historicalScores]);

  const monthlyStatsChart = useMemo(() => {
    const points = insightsQuery.data?.monthlyStats || [];
    return {
      labels: points.map((point, index) => (index % 2 === 0 || index === points.length - 1 ? point.month.slice(0, 3) : "")),
      values: points.map((point) => point.completedDays),
    };
  }, [insightsQuery.data?.monthlyStats]);

  const monthDays = currentMonth.daysInMonth();
  // Adjust offset for Monday start: dayjs returns 0=Sun, so we need (day + 6) % 7 for Mon=0
  const monthOffset = (currentMonth.startOf("month").day() + 6) % 7;
  const monthCells = useMemo(() => {
    const leading = Array.from({ length: monthOffset }, (_, index) => ({ key: `lead-${index}`, day: 0 }));
    const days = Array.from({ length: monthDays }, (_, index) => ({ key: `day-${index + 1}`, day: index + 1 }));
    return [...leading, ...days];
  }, [monthDays, monthOffset]);

  const weeks = useMemo(() => {
    const rows: Array<typeof monthCells> = [];
    for (let index = 0; index < monthCells.length; index += 7) {
      rows.push(monthCells.slice(index, index + 7));
    }
    return rows;
  }, [monthCells]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
            <Text style={styles.backBtnText}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>{pageTitle}</Text>
            <Text style={styles.pageSubtitle}>Score history, monthly completions, and the month view for habit logging.</Text>
          </View>
        </View>

        <View style={styles.manageRow}>
          <Pressable
            onPress={() => {
              setFormState(createFormState(habitRecord ?? { habitName: pageTitle }));
              setIsManageModalOpen(true);
            }}
            style={({ pressed }) => [styles.manageBtn, pressed && styles.pressed]}
          >
            <Text style={styles.manageBtnText}>Edit habit</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Alert.alert("Delete habit?", `Remove \"${pageTitle}\"?`, [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => {
                    deleteMutation.mutate(undefined, {
                      onError: (error) => {
                        void handleError(error, "Delete failed");
                      },
                    });
                  },
                },
              ]);
            }}
            style={({ pressed }) => [styles.manageBtn, styles.manageDeleteBtn, pressed && styles.pressed]}
          >
            <Text style={[styles.manageBtnText, styles.manageDeleteBtnText]}>Delete habit</Text>
          </Pressable>
        </View>

        {insightsQuery.isLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#16a34a" />
            <Text style={styles.loadingText}>Loading habit insights...</Text>
          </View>
        ) : null}

        {insightsQuery.isError || calendarQuery.isError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>{isAuthExpired ? "Session expired" : "Failed to load habit insights"}</Text>
            <Text style={styles.errorText}>
              {isAuthExpired
                ? "Please sign in again."
                : (insightsQuery.error as Error)?.message || (calendarQuery.error as Error)?.message}
            </Text>
            <View style={styles.actionRow}>
              {isAuthExpired ? (
                <Pressable onPress={signOut} style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}>
                  <Text style={styles.secondaryBtnText}>Sign in again</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => {
                  void insightsQuery.refetch();
                  void calendarQuery.refetch();
                }}
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              >
                <Text style={styles.primaryBtnText}>Retry</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {!insightsQuery.isLoading && !insightsQuery.isError && insightsQuery.data ? (
          <>
            <View style={styles.statsRow}>
              <InsightStat label="Points" value={insightsQuery.data.metrics.habitScore} />
              <InsightStat label="Month" value={insightsQuery.data.metrics.monthlySuccess} />
              <InsightStat label="Year" value={insightsQuery.data.metrics.yearlySuccess} />
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Score Trend</Text>
              <Text style={styles.chartSubtitle}>Last 12 months</Text>
              {scoreChart.values.length ? (
                <LineChart
                  data={{ labels: scoreChart.labels, datasets: [{ data: scoreChart.values, color: () => "#16a34a", strokeWidth: 3 }] }}
                  width={chartWidth}
                  height={220}
                  yAxisSuffix="%"
                  withDots={false}
                  withInnerLines
                  withOuterLines={false}
                  withVerticalLines={false}
                  segments={4}
                  fromNumber={0}
                  chartConfig={chartConfig}
                  bezier
                  style={styles.chart}
                />
              ) : (
                <Text style={styles.emptyChartText}>No score history yet.</Text>
              )}
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Completed Days by Month</Text>
              <Text style={styles.chartSubtitle}>Last 12 months</Text>
              {monthlyStatsChart.values.length ? (
                <BarChart
                  data={{ labels: monthlyStatsChart.labels, datasets: [{ data: monthlyStatsChart.values }] }}
                  width={chartWidth}
                  height={220}
                  fromZero
                  showValuesOnTopOfBars
                  withInnerLines
                  yAxisLabel=""
                  yAxisSuffix=""
                  chartConfig={{
                    ...chartConfig,
                    fillShadowGradient: "#22c55e",
                    fillShadowGradientOpacity: 1,
                    barPercentage: 0.55,
                  }}
                  style={styles.chart}
                />
              ) : (
                <Text style={styles.emptyChartText}>No monthly completion data yet.</Text>
              )}
            </View>

            <View style={styles.calendarCard}>
              <View style={styles.calendarHeader}>
                <Pressable onPress={() => setCurrentMonth((value) => value.subtract(1, "month"))} style={({ pressed }) => [styles.monthBtn, pressed && styles.pressed]}>
                  <Text style={styles.monthBtnText}>‹</Text>
                </Pressable>
                <Text style={styles.monthLabel}>{currentMonth.format("MMMM YYYY")}</Text>
                <Pressable onPress={() => setCurrentMonth((value) => value.add(1, "month"))} style={({ pressed }) => [styles.monthBtn, pressed && styles.pressed]}>
                  <Text style={styles.monthBtnText}>›</Text>
                </Pressable>
              </View>

              <View style={styles.weekHeader}>
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
                  <Text key={label} style={styles.weekHeaderText}>{label}</Text>
                ))}
              </View>

              {calendarQuery.isLoading ? <ActivityIndicator size="small" color="#16a34a" /> : null}

              {weeks.map((week, rowIndex) => (
                <View key={`week-${rowIndex}`} style={styles.weekRow}>
                  {(week.length < 7
                    ? [...week, ...Array.from({ length: 7 - week.length }, (_, fillIndex) => ({ key: `fill-${rowIndex}-${fillIndex}`, day: 0 }))]
                    : week
                  ).map((cell) => {
                    if (cell.day === 0) {
                      return <View key={cell.key} style={styles.emptyDayCell} />;
                    }

                    const date = currentMonth.date(cell.day).format("YYYY-MM-DD");
                    const value = logsMap[date];
                    const isToday = dayjs().format("YYYY-MM-DD") === date;
                    const backgroundColor = value === true ? "#16a34a" : value === false ? "#ef4444" : "#f3f4f6";
                    const textColor = value === undefined ? "#374151" : "#ffffff";

                    return (
                      <Pressable
                        key={cell.key}
                        onPress={() => handleDayTap(date, value)}
                        style={({ pressed }) => [
                          styles.dayCell,
                          { backgroundColor, borderColor: isToday ? "#0f172a" : backgroundColor },
                          isToday && styles.todayRing,
                          (pressed || logMutation.isPending) && styles.pressed,
                        ]}
                      >
                        <Text style={[styles.dayCellText, { color: textColor }]}>{cell.day}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}

              <Text style={styles.calendarHint}>Tap a day to toggle success and failure.</Text>
            </View>
          </>
        ) : null}
      </ScrollView>

      <HabitManageModal
        visible={isManageModalOpen}
        formState={formState}
        setFormState={setFormState}
        isSaving={saveMutation.isPending}
        onClose={() => setIsManageModalOpen(false)}
        onSubmit={() => {
          saveMutation.mutate(undefined, {
            onError: (error) => {
              void handleError(error, "Save failed");
            },
          });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fdfb" },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  pressed: { opacity: 0.72 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1fae5",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: { fontSize: 24, color: "#16a34a", fontWeight: "800", lineHeight: 26 },
  pageTitle: { fontSize: 24, fontWeight: "800", color: "#111827" },
  pageSubtitle: { fontSize: 13, color: "#6b7280" },
  manageRow: { flexDirection: "row", gap: 8 },
  manageBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1fae5",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  manageBtnText: { color: "#166534", fontWeight: "700", fontSize: 12 },
  manageDeleteBtn: { borderColor: "#fecaca", backgroundColor: "#fff7f7" },
  manageDeleteBtnText: { color: "#b91c1c" },

  centerBox: { backgroundColor: "#f0fdf4", borderRadius: 16, padding: 24, alignItems: "center", gap: 10 },
  loadingText: { fontSize: 14, color: "#4b5563" },
  errorBox: { backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", borderRadius: 16, padding: 14, gap: 8 },
  errorTitle: { color: "#991b1b", fontWeight: "700" },
  errorText: { color: "#b91c1c", fontSize: 12 },
  actionRow: { flexDirection: "row", gap: 8 },
  primaryBtn: { backgroundColor: "#16a34a", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: { borderWidth: 1, borderColor: "#fecaca", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  secondaryBtnText: { color: "#991b1b", fontWeight: "700" },

  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 4,
  },
  statValue: { fontSize: 19, fontWeight: "800" },
  statLabel: { fontSize: 11, fontWeight: "700", color: "#374151", textTransform: "uppercase" },

  chartCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d1fae5",
    padding: 16,
    gap: 6,
  },
  chartTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },
  chartSubtitle: { fontSize: 12, color: "#6b7280", marginBottom: 4 },
  chart: { borderRadius: 16, marginLeft: -8 },
  emptyChartText: { fontSize: 13, color: "#6b7280", paddingVertical: 24 },

  calendarCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d1fae5",
    padding: 16,
    gap: 12,
  },
  calendarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1fae5",
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
  },
  monthBtnText: { fontSize: 22, fontWeight: "800", color: "#16a34a", lineHeight: 24 },
  monthLabel: { fontSize: 17, fontWeight: "800", color: "#111827" },
  weekHeader: { flexDirection: "row" },
  weekHeaderText: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", color: "#6b7280" },
  weekRow: { flexDirection: "row", gap: 6 },
  emptyDayCell: { flex: 1, height: 42 },
  dayCell: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  todayRing: { borderWidth: 2 },
  dayCellText: { fontWeight: "800" },
  calendarHint: { fontSize: 12, color: "#6b7280" },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.35)",
    justifyContent: "flex-end",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    gap: 12,
  },
  modalTitle: { fontSize: 22, fontWeight: "800", color: "#111827" },
  modalSubtitle: { fontSize: 13, color: "#6b7280" },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#374151" },
  input: {
    borderWidth: 1,
    borderColor: "#d1fae5",
    borderRadius: 12,
    backgroundColor: "#f8fdfb",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
  },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  goalToggle: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  goalToggleActive: { borderColor: "#86efac", backgroundColor: "#f0fdf4" },
  goalToggleText: { color: "#374151", fontWeight: "700" },
  goalToggleTextActive: { color: "#166534" },
  goalTypeRow: { flexDirection: "row", gap: 10 },
  goalTypeChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  goalTypeChipActive: { borderColor: "#86efac", backgroundColor: "#f0fdf4" },
  goalTypeText: { color: "#374151", fontWeight: "700" },
  goalTypeTextActive: { color: "#166534" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalSecondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalSecondaryBtnText: { color: "#374151", fontWeight: "700" },
  modalPrimaryBtn: {
    flex: 1,
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalPrimaryBtnText: { color: "#fff", fontWeight: "700" },
});