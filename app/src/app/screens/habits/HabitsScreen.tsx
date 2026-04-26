import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { MainStackParamList } from "../../navigation/navigationTypes";
import {
  createHabit,
  deleteHabitLog,
  fetchHabits,
  getHabitLogsBatch,
  getHabitMetricsBatch,
  logHabit,
  setGoal,
  type Goal,
  type HabitMetrics,
} from "../../services/habits/habitApi";
import { useAuth } from "../../state/AuthContext";
import { useLanguage } from "../../state/LanguageContext";

type DayStatus = "unknown" | "success" | "no-success";

type FormState = {
  habitName: string;
  description: string;
  goalEnabled: boolean;
  goalType: Extract<Goal["goalType"], "DAYS_PER_WEEK" | "DAYS_PER_MONTH">;
  targetDays: string;
};

type WidgetData = {
  metricsByHabitId: Record<number, HabitMetrics>;
  lastFourDaysByHabitId: Record<number, Array<{ date: string; status: DayStatus }>>;
};

const EMPTY_WIDGET_DATA: WidgetData = {
  metricsByHabitId: {},
  lastFourDaysByHabitId: {},
};

const createFormState = (): FormState => ({
  habitName: "",
  description: "",
  goalEnabled: false,
  goalType: "DAYS_PER_WEEK",
  targetDays: "4",
});

const getNextDayStatus = (status: DayStatus): DayStatus => {
  if (status === "unknown") return "success";
  if (status === "success") return "no-success";
  return "unknown";
};

const toCompletedValue = (status: DayStatus): boolean => status === "success";

const metricTone = (value: number) => {
  if (value >= 85) return { bg: "#dcfce7", text: "#166534", border: "#86efac" };
  if (value >= 65) return { bg: "#fef9c3", text: "#854d0e", border: "#fde047" };
  return { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" };
};

function MetricPill({ label, value }: { label: string; value: number }) {
  const tone = metricTone(value);

  return (
    <View style={[styles.metricPill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <Text style={[styles.metricValue, { color: tone.text }]}>{value.toFixed(0)}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function DayStatusBadge({ date, status, onPress }: { date: string; status: DayStatus; onPress: () => void }) {
  const meta =
    status === "success"
      ? { bg: "#dcfce7", text: "#166534", glyph: "✓" }
      : status === "no-success"
        ? { bg: "#fee2e2", text: "#991b1b", glyph: "✕" }
        : { bg: "#f3f4f6", text: "#9ca3af", glyph: "•" };

  return (
    <Pressable
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      style={({ pressed }) => [styles.dayStatusWrap, pressed && styles.pressed]}
    >
      <Text style={styles.dayStatusLabel}>{dayjs(date).format("dd")}</Text>
      <View style={[styles.dayStatusDot, { backgroundColor: meta.bg }]}>
        <Text style={[styles.dayStatusGlyph, { color: meta.text }]}>{meta.glyph}</Text>
      </View>
    </Pressable>
  );
}

function HabitFormModal({
  visible,
  formState,
  setFormState,
  isSaving,
  onClose,
  onSubmit,
  t,
}: {
  visible: boolean;
  formState: FormState;
  setFormState: (next: FormState) => void;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  t: (key: string) => string;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{t("habits.create")}</Text>
          <Text style={styles.modalSubtitle}>Create the same habit widgets you use on the frontend.</Text>

          <Text style={styles.fieldLabel}>Habit Name</Text>
          <TextInput
            value={formState.habitName}
            onChangeText={(habitName) => setFormState({ ...formState, habitName })}
            placeholder="Example: Walk 8k steps"
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
                    <Text
                      style={[
                        styles.goalTypeText,
                        formState.goalType === option.value && styles.goalTypeTextActive,
                      ]}
                    >
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
            <Pressable
              onPress={onSubmit}
              disabled={isSaving}
              style={({ pressed }) => [styles.modalPrimaryBtn, (pressed || isSaving) && styles.pressed]}
            >
              {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalPrimaryBtnText}>Save</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const formatGoalLabel = (goal?: Goal): string | null => {
  if (!goal) return null;
  if (goal.goalType === "DAILY") return "Every day";
  return goal.goalType === "DAYS_PER_WEEK"
    ? `${goal.targetDays}x / week`
    : `${goal.targetDays}x / month`;
};

export default function HabitsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const queryClient = useQueryClient();
  const { token, signOut } = useAuth();
  const { t } = useLanguage();
  const [modalVisible, setModalVisible] = useState(false);
  const [formState, setFormState] = useState<FormState>(createFormState());

  const habitsQuery = useQuery({
    queryKey: ["habits"],
    queryFn: async () => {
      if (!token) throw new Error("AUTH_REQUIRED");
      return fetchHabits(token);
    },
    enabled: Boolean(token),
  });

  const habitIds = useMemo(() => (habitsQuery.data || []).map((habit) => habit.id), [habitsQuery.data]);

  const widgetQuery = useQuery({
    queryKey: ["habitWidgets", ...habitIds],
    queryFn: async (): Promise<WidgetData> => {
      if (!token) throw new Error("AUTH_REQUIRED");
      if (habitIds.length === 0) return EMPTY_WIDGET_DATA;

      const today = dayjs();
      const startDate = today.subtract(3, "day").format("YYYY-MM-DD");
      const endDate = today.format("YYYY-MM-DD");
      const [metricsByHabitId, logs] = await Promise.all([
        getHabitMetricsBatch(token, habitIds),
        getHabitLogsBatch(token, habitIds, startDate, endDate),
      ]);

      const lastFourDaysByHabitId: WidgetData["lastFourDaysByHabitId"] = {};

      habitIds.forEach((habitId) => {
        lastFourDaysByHabitId[habitId] = Array.from({ length: 4 }, (_, index) => ({
          date: today.subtract(index, "day").format("YYYY-MM-DD"),
          status: "unknown" as DayStatus,
        }));
      });

      logs.forEach((log) => {
        const days = lastFourDaysByHabitId[log.habitId];
        const match = days?.find((day) => day.date === log.logDate);
        if (match) {
          match.status = log.completed ? "success" : "no-success";
        }
      });

      return { metricsByHabitId, lastFourDaysByHabitId };
    },
    enabled: Boolean(token) && Boolean(habitsQuery.data),
  });

  const closeModal = () => {
    setModalVisible(false);
    setFormState(createFormState());
  };

  const openCreateModal = () => {
    setFormState(createFormState());
    setModalVisible(true);
  };

  const handleMutationError = async (error: unknown, fallbackTitle: string) => {
    const message = error instanceof Error ? error.message : fallbackTitle;
    if (message === "AUTH_EXPIRED") {
      await signOut();
      return;
    }
    Alert.alert(fallbackTitle, message);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("AUTH_REQUIRED");

      const habitName = formState.habitName.trim();
      const description = formState.description.trim();
      if (!habitName) {
        throw new Error("Habit name is required");
      }

      const parsedTargetDays = Number(formState.targetDays);
      if (formState.goalEnabled && (!Number.isFinite(parsedTargetDays) || parsedTargetDays <= 0)) {
        throw new Error("Goal target days must be greater than 0");
      }

      const savedHabit = await createHabit(token, habitName, description);

      if (formState.goalEnabled) {
        const goal = await setGoal(token, savedHabit.id, formState.goalType, parsedTargetDays);
        savedHabit.goal = goal;
      }

      return savedHabit;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["habits"] }),
        queryClient.invalidateQueries({ queryKey: ["habitWidgets"] }),
        queryClient.invalidateQueries({ queryKey: ["habitInsights"] }),
        queryClient.invalidateQueries({ queryKey: ["habitCalendar"] }),
      ]);
      closeModal();
    },
  });

  const dayToggleMutation = useMutation({
    mutationFn: async ({ habitId, date, nextStatus }: { habitId: number; date: string; nextStatus: DayStatus }) => {
      if (!token) throw new Error("AUTH_REQUIRED");
      if (nextStatus === "unknown") {
        return deleteHabitLog(token, habitId, date);
      }
      return logHabit(token, habitId, date, toCompletedValue(nextStatus));
    },
    onMutate: async ({ habitId, date, nextStatus }) => {
      const queryKey = ["habitWidgets", ...habitIds];
      await queryClient.cancelQueries({ queryKey });
      const previousWidgets = queryClient.getQueryData<WidgetData>(queryKey);

      queryClient.setQueryData<WidgetData>(queryKey, (current) => {
        const source = current || EMPTY_WIDGET_DATA;
        const nextDays = { ...source.lastFourDaysByHabitId };
        nextDays[habitId] = (nextDays[habitId] || []).map((day) =>
          day.date === date ? { ...day, status: nextStatus } : day
        );

        return {
          ...source,
          lastFourDaysByHabitId: nextDays,
        };
      });

      return { previousWidgets };
    },
    onError: (error, _variables, context) => {
      if (context?.previousWidgets) {
        queryClient.setQueryData(["habitWidgets", ...habitIds], context.previousWidgets);
      }

      const message = error instanceof Error ? error.message : "Failed to update habit";
      if (message === "AUTH_EXPIRED") {
        void signOut();
        return;
      }

      Alert.alert("Update failed", message);
    },
    onSuccess: async () => {
      void queryClient.invalidateQueries({ queryKey: ["habitWidgets"] });
      void queryClient.invalidateQueries({ queryKey: ["habitInsights"] });
      void queryClient.invalidateQueries({ queryKey: ["habitCalendar"] });
    },
  });

  const isAuthExpired =
    (habitsQuery.error instanceof Error && habitsQuery.error.message === "AUTH_EXPIRED") ||
    (widgetQuery.error instanceof Error && widgetQuery.error.message === "AUTH_EXPIRED");

  const widgets = widgetQuery.data || EMPTY_WIDGET_DATA;
  const isLoading = habitsQuery.isLoading || widgetQuery.isLoading;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.pageHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>{t("habits.title")}</Text>
            <Text style={styles.pageSubtitle}>Your frontend habit widgets, optimized for mobile.</Text>
          </View>
          <Pressable onPress={openCreateModal} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
            <Text style={styles.addButtonText}>+ New</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#16a34a" />
            <Text style={styles.loadingText}>{t("habits.loading")}</Text>
          </View>
        ) : null}

        {habitsQuery.isError || widgetQuery.isError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>{isAuthExpired ? t("settings.sessionExpired") : t("habits.loadingFailed")}</Text>
            <Text style={styles.errorText}>
              {isAuthExpired
                ? t("settings.sessionExpired")
                : (habitsQuery.error as Error)?.message || (widgetQuery.error as Error)?.message}
            </Text>
            <View style={styles.row}>
              {isAuthExpired ? (
                <Pressable onPress={signOut} style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}>
                  <Text style={styles.secondaryBtnText}>Sign in again</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => {
                  void habitsQuery.refetch();
                  void widgetQuery.refetch();
                }}
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              >
                <Text style={styles.primaryBtnText}>Retry</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {!isLoading && !habitsQuery.isError && habitsQuery.data?.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No habits yet</Text>
            <Text style={styles.emptyText}>Create your first habit to start tracking the same way as on the frontend.</Text>
            <Pressable onPress={openCreateModal} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
              <Text style={styles.primaryBtnText}>Create Habit</Text>
            </Pressable>
          </View>
        ) : null}

        {!isLoading && !habitsQuery.isError && habitsQuery.data?.length ? (
          <View style={styles.cardsColumn}>
            {habitsQuery.data.map((habit) => {
              const metrics = widgets.metricsByHabitId[habit.id];
              const recentDays = widgets.lastFourDaysByHabitId[habit.id] || [];
              const goalLabel = formatGoalLabel(habit.goal);

              return (
                <Pressable
                  key={habit.id}
                  onPress={() => navigation.navigate("HabitInsights", { habitId: habit.id, habitName: habit.habitName })}
                  style={({ pressed }) => [styles.habitCard, pressed && styles.pressed]}
                >
                  <View style={styles.habitTopRow}>
                    <View style={styles.habitMainColumn}>
                      <Text numberOfLines={1} ellipsizeMode="tail" style={styles.habitTitle}>{habit.habitName}</Text>
                      {goalLabel ? <Text numberOfLines={1} style={styles.goalText}>{goalLabel}</Text> : null}
                    </View>

                    <View style={styles.metricsCluster}>
                      <MetricPill label="Pts" value={metrics?.habitScore ?? 0} />
                      <MetricPill label="Mo" value={metrics?.monthlySuccess ?? 0} />
                      <MetricPill label="Yr" value={metrics?.yearlySuccess ?? 0} />
                    </View>
                  </View>

                  <View style={styles.recentInlineRow}>
                    {recentDays.map((day) => (
                      <DayStatusBadge
                        key={`${habit.id}-${day.date}`}
                        date={day.date}
                        status={day.status}
                        onPress={() => {
                          const nextStatus = getNextDayStatus(day.status);
                          dayToggleMutation.mutate({ habitId: habit.id, date: day.date, nextStatus });
                        }}
                      />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      <HabitFormModal
        visible={modalVisible}
        formState={formState}
        setFormState={setFormState}
        isSaving={saveMutation.isPending}
        onClose={closeModal}
        t={t}
        onSubmit={() => {
          saveMutation.mutate(undefined, {
            onError: (error) => {
              void handleMutationError(error, "Save failed");
            },
          });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fdfb" },
  scroll: { padding: 20, gap: 16, paddingBottom: Platform.OS === "web" ? 80 : 40 },
  row: { flexDirection: "row", gap: 8 },
  pressed: { opacity: 0.72 },

  pageHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  pageTitle: { fontSize: 24, fontWeight: "800", color: "#111827" },
  pageSubtitle: { marginTop: 2, fontSize: 13, color: "#6b7280" },
  addButton: {
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addButtonText: { color: "#fff", fontWeight: "700" },

  centerBox: { backgroundColor: "#f0fdf4", borderRadius: 16, padding: 24, alignItems: "center", gap: 10 },
  loadingText: { fontSize: 14, color: "#4b5563" },
  errorBox: { backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", borderRadius: 16, padding: 14, gap: 8 },
  errorTitle: { color: "#991b1b", fontWeight: "700" },
  errorText: { color: "#b91c1c", fontSize: 12 },
  primaryBtn: { backgroundColor: "#16a34a", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: { borderWidth: 1, borderColor: "#fecaca", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  secondaryBtnText: { color: "#991b1b", fontWeight: "700" },

  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#d1fae5",
    padding: 22,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: "#111827" },
  emptyText: { fontSize: 13, color: "#6b7280", textAlign: "center" },

  cardsColumn: { gap: 10 },
  habitCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#d1fae5",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    shadowColor: "#16a34a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  habitTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  habitMainColumn: { flex: 1, gap: 4, minWidth: 0 },
  habitTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },
  goalText: { fontSize: 11, fontWeight: "700", color: "#6b7280" },
  metricsCluster: { flexDirection: "row", gap: 4, alignSelf: "flex-start" },
  iconAction: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1fae5",
    backgroundColor: "#f8fdfb",
  },
  iconActionText: { color: "#166534", fontSize: 11, fontWeight: "700" },
  deleteAction: { borderColor: "#fecaca", backgroundColor: "#fff7f7" },
  deleteActionText: { color: "#b91c1c" },

  recentInlineRow: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  dayStatusWrap: { alignItems: "center", gap: 2, flex: 1 },
  dayStatusLabel: { fontSize: 9, fontWeight: "700", color: "#6b7280" },
  dayStatusDot: { width: 22, height: 22, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  dayStatusGlyph: { fontSize: 12, fontWeight: "800" },

  metricPill: {
    borderWidth: 1,
    minWidth: 42,
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 5,
    alignItems: "center",
    gap: 1,
  },
  metricValue: { fontSize: 14, fontWeight: "800" },
  metricLabel: { fontSize: 8, fontWeight: "700", color: "#374151", textTransform: "uppercase" },

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