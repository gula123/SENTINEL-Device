import dayjs from "dayjs";
import { useMemo, useRef, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { MainTabParamList } from "../../navigation/MainTabs";
import { useCalendarData } from "../../hooks/useCalendarData";
import { fetchWeightHistory } from "../../services/weight/weightApi";
import { useAuth } from "../../state/AuthContext";
import { useLanguage } from "../../state/LanguageContext";

// ─── 5-tier color system (matches desktop Calendar.tsx) ─────────────────────
type ColorCategory =
  | "perfect"   // < 100%
  | "good"      // 100–108%
  | "warning"   // 108–115%
  | "caution"   // 115–125%
  | "exceeded"  // > 125%
  | "vacation"
  | "active"    // logged but no calorie limit set
  | "none";

function getColorCategory(consumed: number, limit: number): ColorCategory {
  if (limit <= 0) return "active";
  const r = consumed / limit;
  if (r < 1.0)  return "perfect";
  if (r < 1.08) return "good";
  if (r < 1.15) return "warning";
  if (r < 1.25) return "caution";
  return "exceeded";
}

type CatStyle = { bg: string; border: string; text: string; icon: string };

const CAT: Record<ColorCategory, CatStyle> = {
  perfect:  { bg: "#bbf7d0", border: "#4ade80", text: "#166534", icon: "✓" },
  good:     { bg: "#dcfce7", border: "#86efac", text: "#166534", icon: "✓" },
  warning:  { bg: "#fef9c3", border: "#fde047", text: "#854d0e", icon: "!" },
  caution:  { bg: "#ffedd5", border: "#fb923c", text: "#9a3412", icon: "!" },
  exceeded: { bg: "#fee2e2", border: "#fca5a5", text: "#991b1b", icon: "✕" },
  vacation: { bg: "#dbeafe", border: "#93c5fd", text: "#1e40af", icon: "🏖" },
  active:   { bg: "#f3f4f6", border: "#d1d5db", text: "#374151", icon: "" },
  none:     { bg: "#f9fafb", border: "#e5e7eb", text: "#d1d5db", icon: "" },
};

const STATUS_LABEL: Record<ColorCategory, string> = {
  perfect:  "Within limit",
  good:     "Slightly over (≤108%)",
  warning:  "Warning (108–115%)",
  caution:  "Caution (115–125%)",
  exceeded: "Exceeded (>125%)",
  vacation: "Vacation day",
  active:   "Logged (no limit set)",
  none:     "No data",
};

const MONTHS_RANGE = 24;

function MonthPage({
  month,
  width,
  onPrevMonth,
  onNextMonth,
  navigation,
  token,
  signOut,
  t,
}: {
  month: dayjs.Dayjs;
  width: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  navigation: BottomTabNavigationProp<MainTabParamList, "Progress">;
  token: string | null;
  signOut: () => void;
  t: (key: string) => string;
}) {
  const yearMonth = month.format("YYYY-MM");
  const { data, isLoading, isError, error, refetch } = useCalendarData(yearMonth);
  const isAuthExpired = error instanceof Error && error.message === "AUTH_EXPIRED";

  const daysInMonth = month.daysInMonth();
  const startOffset = (month.startOf("month").day() + 6) % 7;
  const cells = useMemo(() => {
    const pre = Array.from({ length: startOffset }, (_, i) => ({ key: `e${i}`, day: 0 }));
    const days = Array.from({ length: daysInMonth }, (_, i) => ({ key: `d${i + 1}`, day: i + 1 }));
    return [...pre, ...days];
  }, [startOffset, daysInMonth]);

  const weeks = useMemo(() => {
    const w: (typeof cells)[] = [];
    for (let i = 0; i < cells.length; i += 7) w.push(cells.slice(i, i + 7));
    return w;
  }, [cells]);

  const vacationSet = useMemo(() => new Set(data?.vacationDays ?? []), [data]);

  const monthStart = month.startOf("month").format("YYYY-MM-DD");
  const monthEnd = month.endOf("month").format("YYYY-MM-DD");
  const weightLookbackStart = month.subtract(1, "year").startOf("month").format("YYYY-MM-DD");
  const monthWeightQuery = useQuery({
    queryKey: ["weightHistory", weightLookbackStart, monthEnd],
    queryFn: async () => {
      if (!token) throw new Error("AUTH_REQUIRED");
      return fetchWeightHistory(token, weightLookbackStart, monthEnd);
    },
    enabled: Boolean(token),
    staleTime: 5 * 60_000,
  });

  const categoryForDay = (day: number): ColorCategory => {
    if (!day || !data) return "none";
    if (vacationSet.has(day)) return "vacation";
    const dc = data.dailyCalories?.[day];
    if (dc) return getColorCategory(dc.consumed, dc.limit);
    if (data.activeDays?.includes(day)) return "active";
    return "none";
  };

  const stats = useMemo(() => {
    const base = { green: 0, yellow: 0, orange: 0, red: 0, vacation: vacationSet.size };
    if (!data?.dailyCalories) return base;
    const entries = Object.entries(data.dailyCalories).filter(([d]) => !vacationSet.has(Number(d)));
    return {
      ...base,
      green: entries.filter(([, { consumed, limit }]) => limit > 0 && consumed / limit <= 1.08).length,
      yellow: entries.filter(([, { consumed, limit }]) => limit > 0 && consumed / limit > 1.08 && consumed / limit <= 1.15).length,
      orange: entries.filter(([, { consumed, limit }]) => limit > 0 && consumed / limit > 1.15 && consumed / limit <= 1.25).length,
      red: entries.filter(([, { consumed, limit }]) => limit > 0 && consumed / limit > 1.25).length,
    };
  }, [data, vacationSet]);

  const monthlyWeightDelta = useMemo(() => {
    const allLogs = (monthWeightQuery.data || []).slice().sort((a, b) =>
      a.measurementDate.localeCompare(b.measurementDate)
    );

    const inMonthLogs = allLogs.filter((l) => l.measurementDate >= monthStart);
    const preMonthLogs = allLogs.filter((l) => l.measurementDate < monthStart);

    if (inMonthLogs.length === 0) return null;

    const endWeight = inMonthLogs[inMonthLogs.length - 1].weight;

    // Baseline: always prefer last known pre-month weight.
    // Only fall back to first in-month log if no prior data exists at all.
    let startWeight: number;
    if (preMonthLogs.length > 0) {
      startWeight = preMonthLogs[preMonthLogs.length - 1].weight;
    } else if (inMonthLogs.length > 1) {
      startWeight = inMonthLogs[0].weight;
    } else {
      // Single log this month, no prior data — can't determine change
      return null;
    }

    return Number((endWeight - startWeight).toFixed(1));
  }, [monthWeightQuery.data, monthStart]);

  const weightChangeLabel = useMemo(() => {
    if (monthlyWeightDelta == null) {
      return t("progress.noData");
    }

    const sign = monthlyWeightDelta > 0 ? "+" : "";
    return `${sign}${monthlyWeightDelta.toFixed(1)} kg`;
  }, [monthlyWeightDelta]);

  const weightChangeColor =
    monthlyWeightDelta == null ? "#9ca3af" : monthlyWeightDelta > 0 ? "#b91c1c" : monthlyWeightDelta < 0 ? "#166534" : "#92400e";

  const isThisMonth = dayjs().isSame(month, "month");

  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={styles.pageScroll}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      <Text style={styles.pageTitle}>{t("progress.title")}</Text>

      <View style={styles.monthCard}>
        <Pressable
          onPress={onPrevMonth}
          style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
          accessibilityLabel={t("progress.prevMonth")}
        >
          <Text style={styles.navBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{month.format("MMMM YYYY")}</Text>
        <Pressable
          onPress={onNextMonth}
          style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
          accessibilityLabel={t("progress.nextMonth")}
        >
          <Text style={styles.navBtnText}>›</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.loadingText}>{t("progress.loading")}</Text>
        </View>
      ) : null}

      {isError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>{t("progress.loadFailed")}</Text>
          <Text style={styles.errorText}>
            {isAuthExpired ? t("progress.sessionExpired") : (error as Error).message}
          </Text>
          <View style={styles.row}>
            {isAuthExpired ? (
              <Pressable onPress={signOut} style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}>
                <Text style={styles.secondaryBtnText}>{t("progress.signInAgain")}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => refetch()} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
              <Text style={styles.primaryBtnText}>{t("progress.retry")}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {data ? (
        <>
          <View style={styles.streakCard}>
            <Text style={styles.streakEmoji}>⚖️</Text>
            <Text style={[styles.streakValue, { color: weightChangeColor }]}>{weightChangeLabel}</Text>
          </View>

          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={[styles.statGlyph, { color: "#16a34a" }]}>✓</Text>
              <Text style={styles.statValue}>{stats.green}</Text>
              <View style={[styles.statLabelPill, { backgroundColor: "#dcfce7" }]}> 
                <Text style={[styles.statLabelText, { color: "#166534" }]}>{t("progress.green")}</Text>
              </View>
              <Text style={styles.statRange}>≤108%</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statGlyph, { color: "#d97706" }]}>!</Text>
              <Text style={styles.statValue}>{stats.yellow}</Text>
              <View style={[styles.statLabelPill, { backgroundColor: "#fef9c3" }]}> 
                <Text style={[styles.statLabelText, { color: "#854d0e" }]}>{t("progress.yellow")}</Text>
              </View>
              <Text style={styles.statRange}>108–115%</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statGlyph, { color: "#ea580c" }]}>!</Text>
              <Text style={styles.statValue}>{stats.orange}</Text>
              <View style={[styles.statLabelPill, { backgroundColor: "#ffedd5" }]}> 
                <Text style={[styles.statLabelText, { color: "#9a3412" }]}>{t("progress.orange")}</Text>
              </View>
              <Text style={styles.statRange}>115–125%</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statGlyph, { color: "#dc2626" }]}>✕</Text>
              <Text style={styles.statValue}>{stats.red}</Text>
              <View style={[styles.statLabelPill, { backgroundColor: "#fee2e2" }]}> 
                <Text style={[styles.statLabelText, { color: "#991b1b" }]}>{t("progress.red")}</Text>
              </View>
              <Text style={styles.statRange}>{">125%"}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statEmoji}>🏖️</Text>
              <Text style={styles.statValue}>{stats.vacation}</Text>
              <View style={[styles.statLabelPill, { backgroundColor: "#dbeafe" }]}> 
                <Text style={[styles.statLabelText, { color: "#1e40af" }]}>{t("progress.vacation")}</Text>
              </View>
              <Text style={styles.statRange}>{t("progress.dayOff")}</Text>
            </View>
          </View>

          <View style={styles.calendarCard}>
            <View style={styles.weekRow}>
              {[t("habitInsights.weekMon"), t("habitInsights.weekTue"), t("habitInsights.weekWed"), t("habitInsights.weekThu"), t("habitInsights.weekFri"), t("habitInsights.weekSat"), t("habitInsights.weekSun")].map((d) => (
                <Text key={d} style={styles.weekLabel}>{d}</Text>
              ))}
            </View>

            {weeks.map((week, wi) => (
              <View key={wi} style={styles.weekRow}>
                {(week.length < 7
                  ? [...week, ...Array.from({ length: 7 - week.length }, (_, i) => ({ key: `p${wi}-${i}`, day: 0 }))]
                  : week
                ).map((cell) => {
                  if (cell.day === 0) {
                    return <View key={cell.key} style={styles.dayEmpty} />;
                  }
                  const cat = categoryForDay(cell.day);
                  const cs = CAT[cat];
                  const todayCell = isThisMonth && dayjs().date() === cell.day;
                  return (
                    <Pressable
                      key={cell.key}
                      onPress={() => {
                        const targetDate = month.date(cell.day).format("YYYY-MM-DD");
                        navigation.navigate("Diary", { date: targetDate, focusToken: Date.now() });
                      }}
                      style={({ pressed }) => [
                        styles.dayCell,
                        { backgroundColor: cs.bg, borderColor: cs.border },
                        todayCell && styles.dayCellToday,
                        pressed && styles.pressed,
                      ]}
                      accessibilityLabel={`Open diary for day ${cell.day}, ${STATUS_LABEL[cat]}`}
                    >
                      <Text style={[styles.dayNum, { color: cs.text }]}>{cell.day}</Text>
                      {cs.icon ? <Text style={[styles.dayIcon, { color: cs.text }]}>{cs.icon}</Text> : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}

            <Text style={styles.tapHint}>{t("progress.calendarHint")}</Text>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────
export default function ProgressScreen() {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<string>>(null);
  const initialIndex = MONTHS_RANGE;
  const months = useMemo(() => {
    const base = dayjs().startOf("month");
    const arr: string[] = [];
    for (let i = -MONTHS_RANGE; i <= MONTHS_RANGE; i++) {
      arr.push(base.add(i, "month").format("YYYY-MM-01"));
    }
    return arr;
  }, []);
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  const { token, signOut } = useAuth();
  const { t } = useLanguage();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList, "Progress">>();

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setActiveIndex(viewableItems[0].index);
    }
  });

  const getItemLayout = (_: unknown, index: number) => ({
    length: width,
    offset: width * index,
    index,
  });

  const goPrevMonth = () => {
    if (activeIndex <= 0) return;
    listRef.current?.scrollToIndex({ index: activeIndex - 1, animated: true });
  };

  const goNextMonth = () => {
    if (activeIndex >= months.length - 1) return;
    listRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <FlatList
        ref={listRef}
        data={months}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={getItemLayout}
        keyExtractor={(item) => item}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfig.current}
        renderItem={({ item }) => {
          const monthValue = dayjs(item);
          return (
            <MonthPage
              month={monthValue}
              width={width}
              onPrevMonth={goPrevMonth}
              onNextMonth={goNextMonth}
              navigation={navigation}
              token={token}
              signOut={signOut}
              t={t}
            />
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fdfb" },
  pageScroll: { padding: 20, gap: 16, paddingBottom: Platform.OS === "web" ? 80 : 40 },

  pageTitle: { fontSize: 24, fontWeight: "800", color: "#111827" },

  // Month nav
  monthCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: "#bbf7d0",
    shadowColor: "#16a34a", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  navBtn: {
    width: 36, height: 36, alignItems: "center", justifyContent: "center",
    borderRadius: 10, borderWidth: 1, borderColor: "#bbf7d0", backgroundColor: "#f0fdf4",
  },
  navBtnText: { fontSize: 22, fontWeight: "700", color: "#16a34a", lineHeight: 28 },
  monthLabel: { fontSize: 17, fontWeight: "700", color: "#111827" },

  // Loading / error
  centerBox: { backgroundColor: "#f0fdf4", borderRadius: 16, padding: 24, alignItems: "center", gap: 10 },
  loadingText: { fontSize: 14, color: "#4b5563" },
  errorBox: { backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", borderRadius: 16, padding: 14, gap: 8 },
  errorTitle: { color: "#991b1b", fontWeight: "700" },
  errorText: { color: "#b91c1c", fontSize: 12 },
  row: { flexDirection: "row", gap: 8 },
  primaryBtn: { backgroundColor: "#16a34a", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  primaryBtnText: { color: "#fff", fontWeight: "600" },
  secondaryBtn: { borderWidth: 1, borderColor: "#fecaca", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  secondaryBtnText: { color: "#991b1b", fontWeight: "600" },
  pressed: { opacity: 0.7 },

  streakCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#fde68a",
    shadowColor: "#f59e0b",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  streakEmoji: { fontSize: 22, lineHeight: 24 },
  streakValue: { fontSize: 22, fontWeight: "800", color: "#92400e", lineHeight: 24 },
  streakLabel: { fontSize: 11, fontWeight: "700", color: "#b45309", textTransform: "uppercase", letterSpacing: 0.5 },

  // Stats strip
  statsCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: "#bbf7d0",
    shadowColor: "#16a34a", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  statItem: { flex: 1, alignItems: "center", gap: 2 },
  statDivider: { width: 1, height: 36, backgroundColor: "#f3f4f6" },
  statEmoji: { fontSize: 16, lineHeight: 20 },
  statGlyph: { fontSize: 15, fontWeight: "800", lineHeight: 20 },
  statValue: { fontSize: 20, fontWeight: "800", color: "#111827", lineHeight: 24 },
  statRange: { fontSize: 9, fontWeight: "700", color: "#6b7280", lineHeight: 12 },
  statLabelPill: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 50,
    alignItems: "center",
  },
  statLabelText: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },

  // Calendar
  calendarCard: {
    backgroundColor: "#fff", borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: "#bbf7d0",
    shadowColor: "#16a34a", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
    gap: 4,
  },
  weekRow: { flexDirection: "row", gap: 3 },
  weekLabel: { flex: 1, textAlign: "center", fontSize: 10, fontWeight: "700", color: "#9ca3af", paddingVertical: 4 },
  dayEmpty: { flex: 1, aspectRatio: 1 },
  dayCell: {
    flex: 1, aspectRatio: 1,
    borderRadius: 8, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  dayCellToday: { borderWidth: 2, borderColor: "#16a34a" },
  dayCellSelected: { borderWidth: 2, borderColor: "#111827" },
  dayNum: { fontSize: 12, fontWeight: "700", lineHeight: 14 },
  dayIcon: { fontSize: 8, fontWeight: "800", lineHeight: 10 },
  tapHint: { textAlign: "center", fontSize: 10, color: "#d1d5db", marginTop: 6 },
});
