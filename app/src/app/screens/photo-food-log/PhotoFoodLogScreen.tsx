import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import type { MainStackParamList } from "../../navigation/navigationTypes";
import { useAuth } from "../../state/AuthContext";
import { useLanguage } from "../../state/LanguageContext";
import {
  analyzePhotoForLog,
  addFoodLog,
  addAiPhotoFoodLog,
  type PhotoAnalyzedItem,
} from "../../services/food/foodLogsApi";
import { PhotoItemCard } from "../../components/PhotoItemCard";

type Props = NativeStackScreenProps<MainStackParamList, "PhotoFoodLog">;

type Stage = "capture" | "reviewing" | "logging";

export default function PhotoFoodLogScreen({ route, navigation }: Props) {
  const { meal, date } = route.params;
  const { token, signOut } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [stage, setStage] = useState<Stage>("capture");
  const [hint, setHint] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [items, setItems] = useState<(PhotoAnalyzedItem & { key: string; grams: number })[]>([]);
  const [logging, setLogging] = useState(false);
  const [capturedBase64, setCapturedBase64] = useState<string | null>(null);
  const [capturedMimeType] = useState("image/jpeg");

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    setAnalyzing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
      if (!photo?.base64) throw new Error("No image data");
      setCapturedBase64(photo.base64);
      await runAnalysis(photo.base64, capturedMimeType, hint);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (msg === "AUTH_EXPIRED") { signOut(); return; }
      Alert.alert(t("common.error"), msg);
      setAnalyzing(false);
    }
  };

  const handleReanalyze = async () => {
    if (!capturedBase64) return;
    setAnalyzing(true);
    setStage("reviewing");
    try {
      await runAnalysis(capturedBase64, capturedMimeType, hint);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (msg === "AUTH_EXPIRED") { signOut(); return; }
      Alert.alert(t("common.error"), msg);
      setAnalyzing(false);
    }
  };

  const runAnalysis = async (base64: string, mimeType: string, hintText: string) => {
    if (!token) return;
    const result = await analyzePhotoForLog(token, base64, mimeType, hintText || undefined);
    const mapped = result.map((item, i) => ({
      ...item,
      key: `${Date.now()}-${i}`,
      grams: item.estimatedGrams,
    }));
    setItems(mapped);
    setStage("reviewing");
    setAnalyzing(false);
  };

  const handleGramsChange = (key: string, grams: number) => {
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, grams } : it))
    );
  };

  const handleRemove = (key: string) => {
    setItems((prev) => prev.filter((it) => it.key !== key));
  };

  const handleLogAll = async () => {
    if (!token || items.length === 0) return;
    setLogging(true);
    try {
      for (const item of items) {
        if (item.foundInDb && item.suggestedFoodId) {
          await addFoodLog(token, {
            foodId: item.suggestedFoodId,
            foodName: item.suggestedFoodName,
            grams: item.grams,
            mealType: meal,
            logDate: date,
          });
        } else {
          const ratio = item.grams / 100;
          await addAiPhotoFoodLog(token, {
            aiEstimatedName: item.suggestedFoodName,
            grams: item.grams,
            mealType: meal,
            logDate: date,
            calories: Math.round(item.caloriesPer100g * ratio * 10) / 10,
            protein: Math.round(item.proteinPer100g * ratio * 10) / 10,
            carbs: Math.round(item.carbsPer100g * ratio * 10) / 10,
            fats: Math.round(item.fatsPer100g * ratio * 10) / 10,
          });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["foodLogs", date] });
      queryClient.invalidateQueries({ queryKey: ["nutritionSummary", date] });
      queryClient.invalidateQueries({ queryKey: ["diaryDay", date] });
      navigation.goBack();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (msg === "AUTH_EXPIRED") { signOut(); return; }
      Alert.alert(t("common.error"), msg);
    } finally {
      setLogging(false);
    }
  };

  // ── Permission states ──────────────────────────────────────────────────────
  if (!permission) {
    return (
      <View style={s.permCenter}>
        <ActivityIndicator color="#16a34a" />
        <Text style={s.permMsg}>{t("barcodeScanner.requestingPermission")}</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={s.permCenter}>
        <Ionicons name="camera-off-outline" size={48} color="#d1d5db" />
        <Text style={s.permMsg}>{t("barcodeScanner.permissionRequired")}</Text>
        <Pressable style={s.grantBtn} onPress={requestPermission}>
          <Text style={s.grantBtnText}>{t("barcodeScanner.grantPermission")}</Text>
        </Pressable>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={s.linkText}>{t("common.cancel")}</Text>
        </Pressable>
      </View>
    );
  }

  // ── Capture stage ──────────────────────────────────────────────────────────
  if (stage === "capture" || (stage === "reviewing" && analyzing && items.length === 0)) {
    return (
      <View style={s.container}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        <View style={s.captureOverlay} pointerEvents="none" />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={s.captureBottom}
        >
          <TextInput
            style={s.hintInputCapture}
            value={hint}
            onChangeText={setHint}
            placeholder={t("photoLog.hintPlaceholder")}
            placeholderTextColor="rgba(255,255,255,0.4)"
          />

          {analyzing ? (
            <View style={s.analyzingRowCapture}>
              <ActivityIndicator color="#16a34a" />
              <Text style={s.analyzingTextCapture}>{t("photoLog.analyzing")}</Text>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [s.captureBtn, pressed && s.pressed]}
              onPress={handleCapture}
            >
              <Ionicons name="camera" size={24} color="#fff" />
              <Text style={s.captureBtnText}>{t("photoLog.analyze")}</Text>
            </Pressable>
          )}

          <Pressable style={s.cancelBtnCapture} onPress={() => navigation.goBack()}>
            <Text style={s.cancelBtnCaptureText}>{t("common.cancel")}</Text>
          </Pressable>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── Review stage ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={["top"] as any}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={s.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [s.backBtn, pressed && s.pressed]}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={20} color="#374151" />
          </Pressable>
          <View style={s.headerTitle}>
            <Ionicons name="camera-outline" size={18} color="#16a34a" />
            <Text style={s.headerText}>{t("photoLog.reviewTitle")}</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Re-analyze bar */}
        <View style={s.reanalyzeBar}>
          <TextInput
            style={s.hintInput}
            value={hint}
            onChangeText={setHint}
            placeholder={t("photoLog.hintPlaceholder")}
            placeholderTextColor="#9ca3af"
          />
          <Pressable
            style={({ pressed }) => [s.reanalyzeBtn, pressed && s.pressed, analyzing && s.reanaBtnDisabled]}
            onPress={handleReanalyze}
            disabled={analyzing}
          >
            {analyzing ? (
              <ActivityIndicator size="small" color="#16a34a" />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={14} color="#16a34a" />
                <Text style={s.reanaBtnText}>{t("photoLog.reanalyze")}</Text>
              </>
            )}
          </Pressable>
        </View>

        <ScrollView
          style={s.list}
          contentContainerStyle={s.listContent}
          keyboardShouldPersistTaps="handled"
        >
          {items.length === 0 && !analyzing && (
            <View style={s.emptyBox}>
              <Ionicons name="search-outline" size={36} color="#d1d5db" />
              <Text style={s.emptyText}>{t("photoLog.noItemsFound")}</Text>
            </View>
          )}
          {analyzing && (
            <View style={s.emptyBox}>
              <ActivityIndicator color="#16a34a" size="large" />
              <Text style={s.analyzingText}>{t("photoLog.analyzing")}</Text>
            </View>
          )}
          {!analyzing && items.map((item) => (
            <PhotoItemCard
              key={item.key}
              item={item}
              onGramsChange={(g) => handleGramsChange(item.key, g)}
              onRemove={() => handleRemove(item.key)}
            />
          ))}
        </ScrollView>

        {/* Footer */}
        <View style={s.footer}>
          <Pressable
            style={({ pressed }) => [s.addManuallyBtn, pressed && s.pressed]}
            onPress={() => navigation.navigate("SearchFood", { meal, date })}
          >
            <Ionicons name="add" size={16} color="#16a34a" />
            <Text style={s.addManuallyText}>{t("photoLog.addManually")}</Text>
          </Pressable>

          {items.length > 0 && (
            <Pressable
              style={({ pressed }) => [s.logAllBtn, (logging || pressed) && s.logAllBtnPressed]}
              onPress={handleLogAll}
              disabled={logging}
            >
              {logging ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={s.logAllText}>
                    {t("photoLog.logAll")} ({items.length})
                  </Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  // Permission states
  permCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fdfb",
    padding: 32,
    gap: 16,
  },
  permMsg: { color: "#374151", textAlign: "center", fontSize: 15 },
  grantBtn: {
    backgroundColor: "#16a34a",
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  grantBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  linkText: { color: "#9ca3af", fontWeight: "600", fontSize: 14 },

  // Capture stage (dark — camera)
  container: { flex: 1, backgroundColor: "#000" },
  captureOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  captureBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingBottom: 40,
    gap: 12,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  hintInputCapture: {
    backgroundColor: "rgba(255,255,255,0.12)",
    color: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  analyzingRowCapture: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
  },
  analyzingTextCapture: { color: "#d1fae5", fontSize: 14, fontWeight: "600" },
  captureBtn: {
    backgroundColor: "#16a34a",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
  },
  captureBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  cancelBtnCapture: { alignItems: "center", paddingVertical: 8 },
  cancelBtnCaptureText: { color: "rgba(255,255,255,0.6)", fontWeight: "600", fontSize: 14 },

  // Review stage (light)
  safe: { flex: 1, backgroundColor: "#f8fdfb" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#f3f4f6",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerText: { fontSize: 17, fontWeight: "700", color: "#111827" },
  reanalyzeBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#f3f4f6",
  },
  hintInput: {
    flex: 1,
    backgroundColor: "#f9fafb",
    color: "#111827",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  reanalyzeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    minWidth: 90,
    justifyContent: "center",
  },
  reanaBtnDisabled: { opacity: 0.5 },
  reanaBtnText: { color: "#16a34a", fontWeight: "700", fontSize: 13 },
  list: { flex: 1 },
  listContent: {
    padding: 16,
    paddingBottom: 140,
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingTop: 60,
    paddingBottom: 20,
  },
  emptyText: {
    color: "#9ca3af",
    fontSize: 14,
    textAlign: "center",
    maxWidth: 240,
    lineHeight: 20,
  },
  analyzingText: { color: "#6b7280", fontSize: 14, fontWeight: "600" },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 32 : 16,
    paddingTop: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#f3f4f6",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 4,
  },
  addManuallyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
  },
  addManuallyText: { color: "#15803d", fontWeight: "600", fontSize: 14 },
  logAllBtn: {
    backgroundColor: "#16a34a",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  logAllBtnPressed: { opacity: 0.8 },
  logAllText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  pressed: { opacity: 0.7 },
});
