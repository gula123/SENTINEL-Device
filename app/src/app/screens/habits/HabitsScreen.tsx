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
  deleteGoal,
  deleteHabit,
  fetchHabits,
  getHabitLogsBatch,
  getHabitMetricsBatch,
  setGoal,
  updateHabit,
  type Goal,
  type Habit,
  type HabitMetrics,
} from "../../services/habits/habitApi";
import { useAuth } from "../../state/AuthContext";

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

const createFormState = (habit?: Habit): FormState => ({
  habitName: habit?.habitName ?? "",
  description: habit?.description ?? "",
  goalEnabled: Boolean(habit?.goal),
  goalType: habit?.goal?.goalType === "DAYS_PER_MONTH" ? "DAYS_PER_MONTH" : "DAYS_PER_WEEK",
  targetDays: habit?.goal?.targetDays ? String(habit.goal.targetDays) : "4",
});

const formatGoalLabel = (goal?: Goal): string | null => {
  if (!goal) return null;
  if (goal.goalType === "DAILY") return "Every day";
  return `${goal.targetDays} days per ${goal.goalType === "DAYS_PER_WEEK" ? "week" : "month"}`;
};

const metricTone = (value: number) => {
  if (value >= 85) return { bg: "#dcfce7", text: "#166534", border: "#86efac" };
  if (value >= 65) return { bg: "#fef9c3", text: "#854d0e", border: "#fde047" };
  return { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" };
};

function MetricPill({ label, value }: { label: string; value: number }) {
  const tone = metricTone(value);

  return (
    <View style={[styles.metricPill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <Text style={[styles.metricValue, { color: tone.text }]}>{value.toFixed(0)}%</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function DayStatusBadge({ date, status }: { date: string; status: DayStatus }) {
  const meta =
    status === "success"
      ? { bg: "#dcfce7", text: "#166534", glyph: "✓" }
      : status === "no-success"
        ? { bg: "#fee2e2", text: "#991b1b", glyph: "✕" }
        : { bg: "#f3f4f6", text: "#9ca3af", glyph: "•" };

  return (
    <View style={styles.dayStatusWrap}>
      <Text style={styles.dayStatusLabel}>{dayjs(date).format("dd")}</Text>
      <View style={[styles.dayStatusDot, { backgroundColor: meta.bg }]}>
        <Text style={[styles.dayStatusGlyph, { color: meta.text }]}>{meta.glyph}</Text>
      </View>
    </View>
  );
}

function HabitFormModal({
  visible,
  editingHabit,
  formState,
  setFormState,
  isSaving,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  editingHabit?: Habit;
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
          <Text style={styles.modalTitle}>{editingHabit ? "Edit Habit" : "New Habit"}</Text>
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

export default function HabitsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const queryClient = useQueryClient();
  const { token, signOut } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | undefined>();
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
    setEditingHabit(undefined);
    setFormState(createFormState());
  };

  const openCreateModal = () => {
    setEditingHabit(undefined);
    setFormState(createFormState());
    setModalVisible(true);
  };

  const openEditModal = (habit: Habit) => {
    setEditingHabit(habit);
    setFormState(createFormState(habit));
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

      const savedHabit = editingHabit
        ? await updateHabit(token, editingHabit.id, habitName, description)
        : await createHabit(token, habitName, description);

      if (formState.goalEnabled) {
        const goal = await setGoal(token, savedHabit.id, formState.goalType, parsedTargetDays);
        savedHabit.goal = goal;
      } else if (editingHabit?.goal) {
        await deleteGoal(token, editingHabit.id);
        delete savedHabit.goal;
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

  const deleteMutation = useMutation({
    mutationFn: async (habitId: number) => {
      if (!token) throw new Error("AUTH_REQUIRED");
      await deleteHabit(token, habitId);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["habits"] }),
        queryClient.invalidateQueries({ queryKey: ["habitWidgets"] }),
        queryClient.invalidateQueries({ queryKey: ["habitInsights"] }),
        queryClient.invalidateQueries({ queryKey: ["habitCalendar"] }),
      ]);
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
            <Text style={styles.pageTitle}>Habits</Text>
            <Text style={styles.pageSubtitle}>Your frontend habit widgets, optimized for mobile.</Text>
          </View>
          <Pressable onPress={openCreateModal} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
            <Text style={styles.addButtonText}>+ New</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#16a34a" />
            <Text style={styles.loadingText}>Loading habits...</Text>
          </View>
        ) : null}

        {habitsQuery.isError || widgetQuery.isError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>{isAuthExpired ? "Session expired" : "Failed to load habits"}</Text>
            <Text style={styles.errorText}>
              {isAuthExpired
                ? "Please sign in again."
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
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.habitTitle}>{habit.habitName}</Text>
                      {habit.description ? <Text style={styles.habitDescription}>{habit.description}</Text> : null}
                      {goalLabel ? <Text style={styles.goalText}>{goalLabel}</Text> : null}
                    </View>

                    <View style={styles.cardActions}>
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation();
                          openEditModal(habit);
                        }}
                        style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}
                      >
                        <Text style={styles.iconActionText}>Edit</Text>
                      </Pressable>
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation();
                          Alert.alert(
                            "Delete habit?",
                            `Remove \"${habit.habitName}\"?`,
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Delete",
                                style: "destructive",
                                onPress: () => {
                                  deleteMutation.mutate(habit.id, {
                                    onError: (error) => {
                                      void handleMutationError(error, "Delete failed");
                                    },
                                  });
                                },
                              },
                            ]
                          );
                        }}
                        style={({ pressed }) => [styles.iconAction, styles.deleteAction, pressed && styles.pressed]}
                      >
                        <Text style={[styles.iconActionText, styles.deleteActionText]}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.recentStrip}>
                    {recentDays.map((day) => (
                      <DayStatusBadge key={`${habit.id}-${day.date}`} date={day.date} status={day.status} />
                    ))}
                  </View>

                  <View style={styles.metricsRow}>
                    <MetricPill label="Points" value={metrics?.habitScore ?? 0} />
                    <MetricPill label="Month" value={metrics?.monthlySuccess ?? 0} />
                    <MetricPill label="Year" value={metrics?.yearlySuccess ?? 0} />
                  </View>

                  <View style={styles.insightHintRow}>
                    <Text style={styles.insightHint}>Tap to open habit insights</Text>
                    <Text style={styles.insightArrow}>›</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      <HabitFormModal
        visible={modalVisible}
        editingHabit={editingHabit}
        formState={formState}
        setFormState={setFormState}
        isSaving={saveMutation.isPending}
        onClose={closeModal}
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

  cardsColumn: { gap: 14 },
  habitCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d1fae5",
    padding: 16,
    gap: 14,
    shadowColor: "#16a34a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  habitTopRow: { flexDirection: "row", gap: 12 },
  habitTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },
  habitDescription: { fontSize: 13, color: "#4b5563" },
  goalText: { fontSize: 12, color: "#16a34a", fontWeight: "700" },
  cardActions: { gap: 8 },
  iconAction: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1fae5",
    backgroundColor: "#f8fdfb",
  },
  iconActionText: { color: "#166534", fontSize: 12, fontWeight: "700" },
  deleteAction: { borderColor: "#fecaca", backgroundColor: "#fff7f7" },
  deleteActionText: { color: "#b91c1c" },

  recentStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 10,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  dayStatusWrap: { alignItems: "center", gap: 5, flex: 1 },
  dayStatusLabel: { fontSize: 11, fontWeight: "700", color: "#6b7280" },
  dayStatusDot: { width: 28, height: 28, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  dayStatusGlyph: { fontSize: 15, fontWeight: "800" },

  metricsRow: { flexDirection: "row", gap: 10 },
  metricPill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 2,
  },
  metricValue: { fontSize: 18, fontWeight: "800" },
  metricLabel: { fontSize: 11, fontWeight: "700", color: "#374151", textTransform: "uppercase" },

  insightHintRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  insightHint: { fontSize: 12, fontWeight: "700", color: "#166534" },
  insightArrow: { fontSize: 22, fontWeight: "800", color: "#16a34a", lineHeight: 24 },

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