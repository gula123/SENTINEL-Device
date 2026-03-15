import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { MainTabParamList } from "../../navigation/MainTabs";
import { useCalendarData } from "../../hooks/useCalendarData";
import { useAuth } from "../../state/AuthContext";

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

const LEGEND_ITEMS: { cat: ColorCategory; label: string }[] = [
  { cat: "perfect",  label: "< 100% — Perfect" },
  { cat: "good",     label: "100–108% — Good" },
  { cat: "warning",  label: "108–115% — Warning" },
  { cat: "caution",  label: "115–125% — Caution" },
  { cat: "exceeded", label: "> 125% — Exceeded" },
  { cat: "vacation", label: "Vacation day" },
];

// ─── Screen ─────────────────────────────────────────────────────────────────
export default function ProgressScreen() {
  const [month, setMonth] = useState(dayjs().startOf("month"));
  const { signOut } = useAuth();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList, "Progress">>();
  const yearMonth = month.format("YYYY-MM");
  const { data, isLoading, isError, error, refetch } = useCalendarData(yearMonth);
  const isAuthExpired = error instanceof Error && error.message === "AUTH_EXPIRED";

  // ── Calendar grid cells chunked into weeks for perfect column alignment ───
  const daysInMonth = month.daysInMonth();
  const startOffset = (month.startOf("month").day() + 6) % 7; // Monday = 0
  const cells = useMemo(() => {
    const pre  = Array.from({ length: startOffset }, (_, i) => ({ key: `e${i}`,     day: 0     }));
    const days = Array.from({ length: daysInMonth }, (_, i) => ({ key: `d${i + 1}`, day: i + 1 }));
    return [...pre, ...days];
  }, [startOffset, daysInMonth]);

  const weeks = useMemo(() => {
    const w: (typeof cells)[] = [];
    for (let i = 0; i < cells.length; i += 7) w.push(cells.slice(i, i + 7));
    return w;
  }, [cells]);

  const vacationSet = useMemo(() => new Set(data?.vacationDays ?? []), [data]);

  const categoryForDay = (day: number): ColorCategory => {
    if (!day || !data) return "none";
    if (vacationSet.has(day)) return "vacation";
    const dc = data.dailyCalories?.[day];
    if (dc) return getColorCategory(dc.consumed, dc.limit);
    if (data.activeDays?.includes(day)) return "active";
    return "none";
  };

  // ── Monthly stats (replacing desktop tooltips) ───────────────────────────
  const stats = useMemo(() => {
    const base = { streak: data?.streak ?? 0, green: 0, yellow: 0, red: 0, vacation: vacationSet.size };
    if (!data?.dailyCalories) return base;
    const entries = Object.entries(data.dailyCalories).filter(([d]) => !vacationSet.has(Number(d)));
    return {
      ...base,
      green:  entries.filter(([, { consumed, limit }]) => limit > 0 && consumed / limit <= 1.08).length,
      yellow: entries.filter(([, { consumed, limit }]) => limit > 0 && consumed / limit > 1.08 && consumed / limit <= 1.25).length,
      red:    entries.filter(([, { consumed, limit }]) => limit > 0 && consumed / limit > 1.25).length,
    };
  }, [data, vacationSet]);

  const isThisMonth = dayjs().isSame(month, "month");

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Page title */}
        <Text style={styles.pageTitle}>Progress</Text>

        {/* Month navigator */}
        <View style={styles.monthCard}>
          <Pressable
            onPress={() => { setMonth(m => m.subtract(1, "month")); }}
            style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
            accessibilityLabel="Previous month"
          >
            <Text style={styles.navBtnText}>‹</Text>
          </Pressable>
          <Text style={styles.monthLabel}>{month.format("MMMM YYYY")}</Text>
          <Pressable
            onPress={() => { setMonth(m => m.add(1, "month")); }}
            style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
            accessibilityLabel="Next month"
          >
            <Text style={styles.navBtnText}>›</Text>
          </Pressable>
        </View>

        {/* Loading */}
        {isLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#16a34a" />
            <Text style={styles.loadingText}>Loading monthly data…</Text>
          </View>
        ) : null}

        {/* Error */}
        {isError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Failed to load progress</Text>
            <Text style={styles.errorText}>
              {isAuthExpired ? "Session expired. Please sign in again." : (error as Error).message}
            </Text>
            <View style={styles.row}>
              {isAuthExpired ? (
                <Pressable onPress={signOut} style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}>
                  <Text style={styles.secondaryBtnText}>Sign in again</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => refetch()} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
                <Text style={styles.primaryBtnText}>Retry</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {data ? (
          <>
            {/* ── Stats strip ─────────────────────────────────────────── */}
            <View style={styles.statsCard}>
              <View style={styles.statItem}>
                <Text style={styles.statEmoji}>🔥</Text>
                <Text style={styles.statValue}>{stats.streak}</Text>
                <Text style={styles.statLabel}>Streak</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statGlyph, { color: "#16a34a" }]}>✓</Text>
                <Text style={styles.statValue}>{stats.green}</Text>
                <Text style={styles.statLabel}>Green</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statGlyph, { color: "#d97706" }]}>!</Text>
                <Text style={styles.statValue}>{stats.yellow}</Text>
                <Text style={styles.statLabel}>Yellow</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statGlyph, { color: "#dc2626" }]}>✕</Text>
                <Text style={styles.statValue}>{stats.red}</Text>
                <Text style={styles.statLabel}>Red</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statEmoji}>🏖️</Text>
                <Text style={styles.statValue}>{stats.vacation}</Text>
                <Text style={styles.statLabel}>Vacation</Text>
              </View>
            </View>

            {/* ── Calendar card ────────────────────────────────────────── */}
            <View style={styles.calendarCard}>
              {/* Weekday header */}
              <View style={styles.weekRow}>
                {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                  <Text key={d} style={styles.weekLabel}>{d}</Text>
                ))}
              </View>

              {/* Week rows — each cell flex:1 ensures perfect column alignment */}
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

              <Text style={styles.tapHint}>Tap a day to open diary</Text>
            </View>

            {/* ── Color legend ─────────────────────────────────────────── */}
            <View style={styles.legendCard}>
              <Text style={styles.sectionTitle}>Color Guide</Text>
              <View style={styles.legendGrid}>
                {LEGEND_ITEMS.map(({ cat, label }) => (
                  <View key={cat} style={styles.legendRow}>
                    <View style={[styles.legendSwatch, {
                      backgroundColor: CAT[cat].bg,
                      borderColor: CAT[cat].border,
                    }]} />
                    <Text style={styles.legendText}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fdfb" },
  scroll: { padding: 20, gap: 16, paddingBottom: Platform.OS === "web" ? 80 : 40 },

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
  statLabel: { fontSize: 9, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.4 },

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

  // Legend
  legendCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: "#e5e7eb", gap: 12,
  },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: "#9ca3af", letterSpacing: 0.8, textTransform: "uppercase" },
  legendGrid: { gap: 8 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  legendSwatch: { width: 22, height: 22, borderRadius: 6, borderWidth: 1 },
  legendText: { fontSize: 12, color: "#374151", fontWeight: "500" },
});
