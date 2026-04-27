import dayjs from "dayjs";
import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  NativeSyntheticEvent,
  NativeScrollEvent,
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
import { useLanguage } from "../../state/LanguageContext";

type FormState = {
  habitName: string;
  description: string;
  goalEnabled: boolean;
  goalType: Extract<Goal["goalType"], "DAYS_PER_WEEK" | "DAYS_PER_MONTH">;
  targetDays: string;
};

type HabitCalendarLog = { logDate: string; completed: boolean };
const CALENDAR_MONTHS_RANGE = 60;

const createFormState = (habit?: { habitName: string; description?: string; goal?: Goal }): FormState => ({
  habitName: habit?.habitName ?? "",
  description: habit?.description ?? "",
  goalEnabled: Boolean(habit?.goal),
  goalType: habit?.goal?.goalType === "DAYS_PER_MONTH" ? "DAYS_PER_MONTH" : "DAYS_PER_WEEK",
  targetDays: habit?.goal?.targetDays ? String(habit.goal.targetDays) : "4",
});

function buildMonthWeeks(month: dayjs.Dayjs) {
  const monthDays = month.daysInMonth();
  const monthOffset = (month.startOf("month").day() + 6) % 7;
  const monthCells = [
    ...Array.from({ length: monthOffset }, (_, index) => ({ key: `lead-${index}`, day: 0 })),
    ...Array.from({ length: monthDays }, (_, index) => ({ key: `day-${index + 1}`, day: index + 1 })),
  ];

  const rows: Array<typeof monthCells> = [];
  for (let index = 0; index < monthCells.length; index += 7) {
    rows.push(monthCells.slice(index, index + 7));
  }
  return rows;
}

function toLogsMap(logs?: HabitCalendarLog[]) {
  const map: Record<string, boolean> = {};
  (logs || []).forEach((log) => {
    map[log.logDate] = log.completed;
  });
  return map;
}

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
  const { t } = useLanguage();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{t("habitInsights.manageTitle")}</Text>
          <Text style={styles.modalSubtitle}>{t("habitInsights.manageSubtitle")}</Text>

          <Text style={styles.fieldLabel}>{t("habitInsights.habitName")}</Text>
          <TextInput
            value={formState.habitName}
            onChangeText={(habitName) => setFormState({ ...formState, habitName })}
            placeholder={t("habitInsights.habitNamePlaceholder")}
            placeholderTextColor="#9ca3af"
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>{t("habitInsights.description")}</Text>
          <TextInput
            value={formState.description}
            onChangeText={(description) => setFormState({ ...formState, description })}
            placeholder={t("habitInsights.descriptionPlaceholder")}
            placeholderTextColor="#9ca3af"
            multiline
            style={[styles.input, styles.textArea]}
          />

          <Pressable
            onPress={() => setFormState({ ...formState, goalEnabled: !formState.goalEnabled })}
            style={({ pressed }) => [styles.goalToggle, formState.goalEnabled && styles.goalToggleActive, pressed && styles.pressed]}
          >
            <Text style={[styles.goalToggleText, formState.goalEnabled && styles.goalToggleTextActive]}>
              {formState.goalEnabled ? t("habitInsights.goalEnabled") : t("habitInsights.addGoal")}
            </Text>
          </Pressable>

          {formState.goalEnabled ? (
            <>
              <View style={styles.goalTypeRow}>
                {[
                  { label: t("habitInsights.perWeek"), value: "DAYS_PER_WEEK" as const },
                  { label: t("habitInsights.perMonth"), value: "DAYS_PER_MONTH" as const },
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

              <Text style={styles.fieldLabel}>{t("habitInsights.targetDays")}</Text>
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

function HabitCalendarMonthPage({
  token,
  habitId,
  month,
  pageWidth,
  onPrevMonth,
  onNextMonth,
  onDayTap,
}: {
  token: string | null;
  habitId: number;
  month: dayjs.Dayjs;
  pageWidth: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onDayTap: (date: string, currentValue?: boolean) => void;
}) {
  const { t } = useLanguage();

  const calendarQuery = useQuery({
    queryKey: ["habitCalendar", habitId, month.format("YYYY-MM")],
    queryFn: async () => {
      if (!token) throw new Error("AUTH_REQUIRED");
      return getHabitLogs(
        token,
        habitId,
        month.startOf("month").format("YYYY-MM-DD"),
        month.endOf("month").format("YYYY-MM-DD")
      );
    },
    enabled: Boolean(token),
  });

  const pageWeeks = useMemo(() => buildMonthWeeks(month), [month]);
  const logsMap = useMemo(() => toLogsMap(calendarQuery.data), [calendarQuery.data]);

  return (
    <View style={[styles.calendarPage, { width: pageWidth }]}> 
      <View style={styles.calendarHeader}>
        <Pressable onPress={onPrevMonth} style={({ pressed }) => [styles.monthBtn, pressed && styles.pressed]}>
          <Text style={styles.monthBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{month.format("MMMM YYYY")}</Text>
        <Pressable onPress={onNextMonth} style={({ pressed }) => [styles.monthBtn, pressed && styles.pressed]}>
          <Text style={styles.monthBtnText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekHeader}>
        {[t("habitInsights.weekMon"), t("habitInsights.weekTue"), t("habitInsights.weekWed"), t("habitInsights.weekThu"), t("habitInsights.weekFri"), t("habitInsights.weekSat"), t("habitInsights.weekSun")].map((label) => (
          <Text key={`${month.format("YYYY-MM")}-${label}`} style={styles.weekHeaderText}>{label}</Text>
        ))}
      </View>

      {calendarQuery.isLoading ? <ActivityIndicator size="small" color="#16a34a" /> : null}

      {calendarQuery.isError ? (
        <Text style={styles.calendarErrorText}>{t("habitInsights.calendarError")}</Text>
      ) : null}

      {pageWeeks.map((week, rowIndex) => (
        <View key={`${month.format("YYYY-MM")}-w-${rowIndex}`} style={styles.weekRow}>
          {(week.length < 7
            ? [...week, ...Array.from({ length: 7 - week.length }, (_, fillIndex) => ({ key: `fill-${rowIndex}-${fillIndex}`, day: 0 }))]
            : week
          ).map((cell) => {
            if (cell.day === 0) {
              return <View key={`${month.format("YYYY-MM")}-${cell.key}`} style={styles.emptyDayCell} />;
            }

            const date = month.date(cell.day).format("YYYY-MM-DD");
            const value = logsMap[date];
            const isToday = dayjs().format("YYYY-MM-DD") === date;
            const backgroundColor = value === true ? "#16a34a" : value === false ? "#ef4444" : "#f3f4f6";
            const textColor = value === undefined ? "#374151" : "#ffffff";

            return (
              <Pressable
                key={`${month.format("YYYY-MM")}-${cell.key}`}
                onPress={() => onDayTap(date, value)}
                style={({ pressed }) => [
                  styles.dayCell,
                  { backgroundColor, borderColor: isToday ? "#0f172a" : backgroundColor },
                  isToday && styles.todayRing,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.dayCellText, { color: textColor }]}>{cell.day}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export default function HabitInsightsScreen() {
  const { token, signOut } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<HabitInsightsRoute>();
  const { habitId, habitName } = route.params;
  const { width } = useWindowDimensions();
  const [activeMonthIndex, setActiveMonthIndex] = useState(CALENDAR_MONTHS_RANGE);
  const calendarPagerRef = useRef<FlatList<string>>(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [formState, setFormState] = useState<FormState>(createFormState({ habitName }));

  const calendarMonths = useMemo(() => {
    const base = dayjs().startOf("month");
    const items: string[] = [];
    for (let i = -CALENDAR_MONTHS_RANGE; i <= CALENDAR_MONTHS_RANGE; i++) {
      items.push(base.add(i, "month").format("YYYY-MM-01"));
    }
    return items;
  }, []);

  const currentMonth = dayjs(calendarMonths[activeMonthIndex] || dayjs().startOf("month").format("YYYY-MM-01"));

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
    onMutate: async (variables) => {
      const queryKey = ["habitCalendar", habitId, dayjs(variables.date).format("YYYY-MM")];
      await queryClient.cancelQueries({ queryKey });
      const previousLogs = queryClient.getQueryData<HabitCalendarLog[]>(queryKey);
      return { previousLogs, queryKey };
    },
    onError: (error, _variables, context) => {
      if (context?.previousLogs && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousLogs);
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
    insightsQuery.error instanceof Error && insightsQuery.error.message === "AUTH_EXPIRED";

  const handleError = async (error: unknown, title: string) => {
    const message = error instanceof Error ? error.message : title;
    if (message === "AUTH_EXPIRED") {
      await signOut();
      return;
    }
    Alert.alert(title, message);
  };

  const chartWidth = Math.max(280, width - 72);
  const [calendarPagerWidth, setCalendarPagerWidth] = useState(chartWidth);

  const pageTitle = habitRecord?.habitName ?? habitName;

  // Debounce handler for day taps - optimistic UI updates immediately, backend call debounced
  const debouncedLogRef = useRef<{ date: string; currentValue?: boolean } | null>(null);
  const debouncedLogTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const queryKey = ["habitCalendar", habitId, dayjs(date).format("YYYY-MM")];

      queryClient.setQueryData<HabitCalendarLog[]>(queryKey, (current) => {
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
    [habitId, queryClient, logMutation, handleError]
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

  const calendarViewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });
  const onCalendarViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setActiveMonthIndex(viewableItems[0].index);
    }
  });

  const triggerPrevMonth = () => {
    const nextIndex = Math.max(0, activeMonthIndex - 1);
    calendarPagerRef.current?.scrollToIndex({ index: nextIndex, animated: true });
  };

  const triggerNextMonth = () => {
    const nextIndex = Math.min(calendarMonths.length - 1, activeMonthIndex + 1);
    calendarPagerRef.current?.scrollToIndex({ index: nextIndex, animated: true });
  };

  const handleCalendarMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (calendarPagerWidth <= 0) return;
    const x = event.nativeEvent.contentOffset.x;
    const nearestIndex = Math.max(
      0,
      Math.min(calendarMonths.length - 1, Math.round(x / calendarPagerWidth))
    );
    const targetOffset = nearestIndex * calendarPagerWidth;

    // Force exact alignment to prevent partial-page resting on some Android devices.
    if (Math.abs(x - targetOffset) > 1) {
      calendarPagerRef.current?.scrollToOffset({ offset: targetOffset, animated: true });
    }
    setActiveMonthIndex(nearestIndex);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
            <Text style={styles.backBtnText}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>{pageTitle}</Text>
            <Text style={styles.pageSubtitle}>{t("habitInsights.subtitle")}</Text>
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
            <Text style={styles.manageBtnText}>{t("habitInsights.editHabit")}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Alert.alert(t("habitInsights.deleteTitle"), `${t("habitInsights.deleteTitle")} "${pageTitle}"?`, [
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
            <Text style={[styles.manageBtnText, styles.manageDeleteBtnText]}>{t("habitInsights.deleteHabit")}</Text>
          </Pressable>
        </View>

        {insightsQuery.isLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#16a34a" />
            <Text style={styles.loadingText}>{t("habitInsights.loading")}</Text>
          </View>
        ) : null}

        {insightsQuery.isError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>{isAuthExpired ? t("habitInsights.sessionExpired") : t("habitInsights.loadFailed")}</Text>
            <Text style={styles.errorText}>
              {isAuthExpired
                ? t("habitInsights.signInAgain")
                : (insightsQuery.error as Error)?.message}
            </Text>
            <View style={styles.actionRow}>
              {isAuthExpired ? (
                <Pressable onPress={signOut} style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}>
                  <Text style={styles.secondaryBtnText}>{t("habitInsights.signInButton")}</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => {
                  void insightsQuery.refetch();
                }}
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              >
                <Text style={styles.primaryBtnText}>{t("habitInsights.retry")}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {!insightsQuery.isLoading && !insightsQuery.isError && insightsQuery.data ? (
          <>
            <View style={styles.statsRow}>
              <InsightStat label={t("habitInsights.points")} value={insightsQuery.data.metrics.habitScore} />
              <InsightStat label={t("habitInsights.month")} value={insightsQuery.data.metrics.monthlySuccess} />
              <InsightStat label={t("habitInsights.year")} value={insightsQuery.data.metrics.yearlySuccess} />
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>{t("habitInsights.scoreTrend")}</Text>
              <Text style={styles.chartSubtitle}>{t("habitInsights.last12months")}</Text>
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
                <Text style={styles.emptyChartText}>{t("habitInsights.noScoreHistory")}</Text>
              )}
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>{t("habitInsights.completedByMonth")}</Text>
              <Text style={styles.chartSubtitle}>{t("habitInsights.last12months")}</Text>
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
                <Text style={styles.emptyChartText}>{t("habitInsights.noMonthlyData")}</Text>
              )}
            </View>

            <View style={styles.calendarCard}>
              <View
                onLayout={(event) => {
                  const nextWidth = Math.max(1, Math.round(event.nativeEvent.layout.width));
                  if (nextWidth !== calendarPagerWidth) {
                    setCalendarPagerWidth(nextWidth);
                  }
                }}
              >
                <FlatList
                  key={calendarPagerWidth}
                  ref={calendarPagerRef}
                  data={calendarMonths}
                  horizontal
                  pagingEnabled
                  disableIntervalMomentum
                  snapToInterval={calendarPagerWidth}
                  snapToAlignment="start"
                  decelerationRate="fast"
                  bounces={false}
                  showsHorizontalScrollIndicator={false}
                  initialScrollIndex={CALENDAR_MONTHS_RANGE}
                  getItemLayout={(_, index) => ({ length: calendarPagerWidth, offset: calendarPagerWidth * index, index })}
                  keyExtractor={(item) => item}
                  onMomentumScrollEnd={handleCalendarMomentumEnd}
                  onViewableItemsChanged={onCalendarViewableItemsChanged.current}
                  viewabilityConfig={calendarViewabilityConfig.current}
                  renderItem={({ item }) => {
                    const month = dayjs(item);
                    return (
                      <HabitCalendarMonthPage
                        token={token}
                        habitId={habitId}
                        month={month}
                        pageWidth={calendarPagerWidth}
                        onPrevMonth={triggerPrevMonth}
                        onNextMonth={triggerNextMonth}
                        onDayTap={handleDayTap}
                      />
                    );
                  }}
                />
              </View>

              <Text style={styles.calendarHint}>{t("habitInsights.calendarHint")}</Text>
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
  calendarPage: { gap: 12 },
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
  calendarErrorText: { fontSize: 12, color: "#b91c1c" },

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