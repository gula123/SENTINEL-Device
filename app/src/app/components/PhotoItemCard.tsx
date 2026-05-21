import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { PhotoAnalyzedItem } from "../services/food/foodLogsApi";
import { useLanguage } from "../state/LanguageContext";

interface Props {
  item: PhotoAnalyzedItem;
  onGramsChange: (grams: number) => void;
  onRemove: () => void;
}

export function PhotoItemCard({ item, onGramsChange, onRemove }: Props) {
  const { t } = useLanguage();
  const [gramsText, setGramsText] = useState(String(Math.round(item.estimatedGrams)));

  const grams = parseFloat(gramsText.replace(",", ".")) || item.estimatedGrams;
  const ratio = grams / 100;
  const cal  = Math.round(item.caloriesPer100g * ratio * 10) / 10;
  const pro  = Math.round(item.proteinPer100g  * ratio * 10) / 10;
  const carb = Math.round(item.carbsPer100g    * ratio * 10) / 10;
  const fat  = Math.round(item.fatsPer100g     * ratio * 10) / 10;

  const handleGramsBlur = () => {
    const v = parseFloat(gramsText.replace(",", "."));
    if (!isNaN(v) && v > 0) onGramsChange(v);
  };

  return (
    <View style={s.card}>
      {/* Top row: name + badge + remove */}
      <View style={s.topRow}>
        <View style={s.nameBlock}>
          <Text style={s.name} numberOfLines={2}>{item.suggestedFoodName}</Text>
          <View style={[s.badge, item.foundInDb ? s.badgeDb : s.badgeAi]}>
            <Ionicons
              name={item.foundInDb ? "server-outline" : "sparkles-outline"}
              size={10}
              color={item.foundInDb ? "#15803d" : "#7c3aed"}
            />
            <Text style={[s.badgeText, item.foundInDb ? s.badgeTextDb : s.badgeTextAi]}>
              {item.foundInDb ? t("photoLog.inDatabase") : t("photoLog.aiEstimate")}
            </Text>
          </View>
        </View>

        <Pressable onPress={onRemove} hitSlop={10} style={s.removeBtn}>
          <Ionicons name="close-circle" size={22} color="#d1d5db" />
        </Pressable>
      </View>

      <View style={s.divider} />

      {/* Bottom row: nutrition pills + grams input */}
      <View style={s.bottomRow}>
        <View style={s.nutrRow}>
          <NutrPill label="kcal" value={cal} accent />
          <NutrPill label="P" value={pro} />
          <NutrPill label="C" value={carb} />
          <NutrPill label="F" value={fat} />
        </View>

        <View style={s.gramsBox}>
          <TextInput
            style={s.gramsInput}
            value={gramsText}
            onChangeText={setGramsText}
            onBlur={handleGramsBlur}
            keyboardType="numeric"
            selectTextOnFocus
          />
          <Text style={s.gramsUnit}>g</Text>
        </View>
      </View>
    </View>
  );
}

function NutrPill({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <View style={[s.pill, accent && s.pillAccent]}>
      <Text style={[s.pillValue, accent && s.pillValueAccent]}>{value}</Text>
      <Text style={[s.pillLabel, accent && s.pillLabelAccent]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  nameBlock: {
    flex: 1,
    gap: 5,
  },
  name: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    lineHeight: 20,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeDb:  { backgroundColor: "#dcfce7" },
  badgeAi:  { backgroundColor: "#ede9fe" },
  badgeText: { fontSize: 11, fontWeight: "600" },
  badgeTextDb: { color: "#15803d" },
  badgeTextAi: { color: "#7c3aed" },
  removeBtn: { paddingTop: 2 },
  divider: {
    height: 1,
    backgroundColor: "#f3f4f6",
    marginVertical: 10,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  nutrRow: {
    flex: 1,
    flexDirection: "row",
    gap: 5,
  },
  pill: {
    flex: 1,
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    paddingVertical: 6,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  pillAccent: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  pillValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },
  pillValueAccent: { color: "#15803d" },
  pillLabel: {
    fontSize: 10,
    color: "#9ca3af",
    marginTop: 1,
    fontWeight: "600",
  },
  pillLabelAccent: { color: "#16a34a" },
  gramsBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f0fdf4",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  gramsInput: {
    fontSize: 15,
    fontWeight: "700",
    color: "#166534",
    width: 52,
    textAlign: "center",
    padding: 0,
  },
  gramsUnit: {
    fontSize: 13,
    color: "#16a34a",
    fontWeight: "600",
  },
});
