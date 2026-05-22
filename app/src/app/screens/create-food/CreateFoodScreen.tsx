import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { MainStackParamList } from "../../navigation/navigationTypes";
import { useAddFoodLog } from "../../hooks/useFoodDiary";
import {
  createCustomFood,
  estimateFoodPer100gWithAi,
  analyzePhotoForCreateFood,
  type AiFoodEstimate,
  type MealType,
} from "../../services/food/foodLogsApi";
import { useAuth } from "../../state/AuthContext";
import { useLanguage } from "../../state/LanguageContext";
import { setPendingMealFood } from "../../state/mealFoodPicker";
import { setPendingRecipeFood } from "../../state/recipeFoodPicker";
import BarcodeScannerModal from "../../components/BarcodeScannerModal";

const MEAL_LABEL: Record<MealType, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACKS: "Snacks",
};
const MEAL_ICON: Record<MealType, string> = {
  BREAKFAST: "☀️",
  LUNCH: "🌤️",
  DINNER: "🌙",
  SNACKS: "🍎",
};

type Props = NativeStackScreenProps<MainStackParamList, "CreateFood">;

export default function CreateFoodScreen({ route, navigation }: Props) {
  const { meal, date, returnTo, barcode: initialBarcode } = route.params;

  const [customName, setCustomName] = useState("");
  const [customBrandOrPlace, setCustomBrandOrPlace] = useState("");
  const [customCalories, setCustomCalories] = useState("0");
  const [customProtein, setCustomProtein] = useState("0");
  const [customCarbs, setCustomCarbs] = useState("0");
  const [customFats, setCustomFats] = useState("0");
  const [customGrams, setCustomGrams] = useState("100");
  const [customBarcode, setCustomBarcode] = useState(initialBarcode ?? "");
  const [scannerVisible, setScannerVisible] = useState(false);
  const [aiNote, setAiNote] = useState("");
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [photoHint, setPhotoHint] = useState("");
  const [photoAnalyzing, setPhotoAnalyzing] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const { token, signOut } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const addMutation = useAddFoodLog(date);

  const toastAnim = useRef(new Animated.Value(0)).current;
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMessage(message);
    toastAnim.setValue(0);
    Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 350, useNativeDriver: true }).start(() =>
        setToastMessage(null)
      );
    }, 2200);
  };

  const _n = (v: string) => Number(v.replace(',', '.'));
  const customFoodPreview = {
    grams: _n(customGrams),
    calories: Math.round(_n(customCalories) * (_n(customGrams) / 100)),
    protein: Math.round((_n(customProtein) * (_n(customGrams) / 100)) * 10) / 10,
    carbs: Math.round((_n(customCarbs) * (_n(customGrams) / 100)) * 10) / 10,
    fats: Math.round((_n(customFats) * (_n(customGrams) / 100)) * 10) / 10,
  };

  const aiMutation = useMutation({
    mutationFn: async (name: string): Promise<AiFoodEstimate> => {
      if (!token) throw new Error("AUTH_REQUIRED");
      return estimateFoodPer100gWithAi(token, name, customBrandOrPlace.trim() || undefined);
    },
    onSuccess: (e) => {
      setCustomCalories(String(Math.round(e.caloriesPer100g)));
      setCustomProtein(String(Math.round(e.proteinPer100g * 10) / 10));
      setCustomCarbs(String(Math.round(e.carbsPer100g * 10) / 10));
      setCustomFats(String(Math.round(e.fatsPer100g * 10) / 10));
      setAiNote(e.assumption || "AI estimated typical nutrition for this food.");
    },
  });

  const createCustomMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("AUTH_REQUIRED");
      if (!customName.trim()) throw new Error("Enter a food name");
      const g = Number(customGrams.replace(',', '.'));
      if (!Number.isFinite(g) || g <= 0) throw new Error("Enter valid grams");

      const created = await createCustomFood(token, {
        name: customName.trim(),
        brandOrPlace: customBrandOrPlace.trim() || undefined,
        caloriesPer100g: Number(customCalories.replace(',', '.')) || 0,
        proteinPer100g: Number(customProtein.replace(',', '.')) || 0,
        carbsPer100g: Number(customCarbs.replace(',', '.')) || 0,
        fatsPer100g: Number(customFats.replace(',', '.')) || 0,
        barcode: customBarcode.trim() || undefined,
      });

      if (!returnTo || returnTo === "foodLog") {
        await addMutation.mutateAsync({
          foodName: created.name,
          foodId: created.id,
          grams: g,
          mealType: meal,
        });
      }

      return { created, g };
    },
    onSuccess: ({ created, g }) => {
      setCustomName("");
      setCustomCalories("0");
      setCustomProtein("0");
      setCustomCarbs("0");
      setCustomFats("0");
      setCustomGrams("100");
      setCustomBrandOrPlace("");
      setCustomBarcode("");
      setAiNote("");
      if (returnTo === "meal") {
        setPendingMealFood(created, g);
        navigation.pop(2);
      } else if (returnTo === "recipe") {
        setPendingRecipeFood(created, g);
        navigation.pop(2);
      } else {
        queryClient.invalidateQueries({ queryKey: ["foodLogs", date] });
        queryClient.invalidateQueries({ queryKey: ["nutritionSummary", date] });
        queryClient.invalidateQueries({ queryKey: ["diaryDay", date] });
        showToast(`${created.name} added to ${MEAL_LABEL[meal]}`);
        setTimeout(() => navigation.goBack(), 1500);
      }
    },
    onError: (err) => {
      handleError(err);
    },
  });

  const handleError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : "Something went wrong";
    if (msg === "AUTH_EXPIRED") {
      signOut();
      return;
    }
    Alert.alert("Error", msg);
  };

  const onAiEstimate = async () => {
    if (!customName.trim()) {
      Alert.alert(t("createFood.enterFoodNameFirst"));
      return;
    }
    try {
      await aiMutation.mutateAsync(customName.trim());
    } catch (err) {
      handleError(err);
    }
  };

  const onPhotoCapture = async () => {
    if (!cameraRef.current || !token) return;
    setPhotoAnalyzing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
      if (!photo?.base64) throw new Error("No image data");
      const result = await analyzePhotoForCreateFood(token, photo.base64, "image/jpeg", photoHint || undefined);
      setCustomName(result.name || customName);
      if (result.brandOrPlace) setCustomBrandOrPlace(result.brandOrPlace);
      setCustomCalories(String(Math.round(result.caloriesPer100g)));
      setCustomProtein(String(Math.round(result.proteinPer100g * 10) / 10));
      setCustomCarbs(String(Math.round(result.carbsPer100g * 10) / 10));
      setCustomFats(String(Math.round(result.fatsPer100g * 10) / 10));
      setAiNote(t("createFood.photoFilled"));
      setPhotoModalVisible(false);
      setPhotoHint("");
    } catch (err) {
      handleError(err);
    } finally {
      setPhotoAnalyzing(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={s.header}>
          <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [s.backBtn, pressed && s.pressed]}>
            <Ionicons name="chevron-back" size={20} color="#374151" />
          </Pressable>
          <View style={s.headerTitle}>
            <Text style={s.headerIcon}>{MEAL_ICON[meal]}</Text>
            <Text style={s.headerText}>{t("createFood.title")}</Text>
          </View>
          <Text style={s.headerDate}>{t(`home.${meal.toLowerCase()}`)}</Text>
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {/* ── Food Details ── */}
          <View style={s.card}>
            <Text style={s.cardTitle}>{t("createFood.cardTitle")}</Text>
            <Text style={s.helperText}>{t("createFood.helpText")}</Text>

            <Text style={s.inputLabel}>{t("createFood.foodName")}</Text>
            <TextInput
              value={customName}
              onChangeText={setCustomName}
              placeholder={t("createFood.foodName")}
              placeholderTextColor="#9ca3af"
              style={s.input}
            />
            <Text style={s.inputLabel}>{t("createFood.brandOrPlace")}</Text>
            <TextInput
              value={customBrandOrPlace}
              onChangeText={setCustomBrandOrPlace}
              placeholder={t("createFood.brandOrPlace")}
              placeholderTextColor="#9ca3af"
              style={s.input}
            />

            <Text style={s.inputLabel}>{t("createFood.barcode")}</Text>
            <View style={s.inputRow}>
              <TextInput
                value={customBarcode}
                onChangeText={setCustomBarcode}
                placeholder={t("createFood.barcodePlaceholder")}
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                style={[s.input, s.inputFlex]}
              />
              <Pressable
                onPress={() => setScannerVisible(true)}
                style={({ pressed }) => [s.scanIconBtn, pressed && s.pressed]}
                accessibilityLabel="Scan barcode"
              >
                <Ionicons name="barcode-outline" size={22} color="#16a34a" />
              </Pressable>
            </View>

            <Pressable
              onPress={() => setPhotoModalVisible(true)}
              style={({ pressed }) => [s.photoFillBtn, pressed && s.pressed]}
            >
              <Ionicons name="camera-outline" size={18} color="#7c3aed" />
              <Text style={s.photoFillBtnText}>{t("createFood.fillFromPhoto")}</Text>
            </Pressable>
          </View>

          {/* ── Nutrition per 100g ── */}
          <View style={s.card}>
            <Text style={s.cardTitle}>{t("createFood.nutritionTitle")}</Text>

            <Pressable onPress={onAiEstimate} style={({ pressed }) => [s.aiBtn, pressed && s.pressed]}>
              <Ionicons name="flash-outline" size={15} color="#166534" />
              <Text style={s.aiBtnText}>{aiMutation.isPending ? t("createFood.estimating") : t("createFood.aiEstimate")}</Text>
            </Pressable>
            {aiNote ? <Text style={s.aiNote}>{aiNote}</Text> : null}

            <Text style={s.inputLabel}>{t("createFood.caloriesLabel")}</Text>
            <TextInput
              value={customCalories}
              onChangeText={setCustomCalories}
              keyboardType="numeric"
              placeholder={t("createFood.caloriesPlaceholder")}
              placeholderTextColor="#9ca3af"
              style={s.input}
            />
            <Text style={s.inputLabel}>{t("createFood.proteinLabel")}</Text>
            <TextInput
              value={customProtein}
              onChangeText={setCustomProtein}
              keyboardType="numeric"
              placeholder={t("createFood.proteinPlaceholder")}
              placeholderTextColor="#9ca3af"
              style={s.input}
            />
            <Text style={s.inputLabel}>{t("createFood.carbsLabel")}</Text>
            <TextInput
              value={customCarbs}
              onChangeText={setCustomCarbs}
              keyboardType="numeric"
              placeholder={t("createFood.carbsPlaceholder")}
              placeholderTextColor="#9ca3af"
              style={s.input}
            />
            <Text style={s.inputLabel}>{t("createFood.fatsLabel")}</Text>
            <TextInput
              value={customFats}
              onChangeText={setCustomFats}
              keyboardType="numeric"
              placeholder={t("createFood.fatsPlaceholder")}
              placeholderTextColor="#9ca3af"
              style={s.input}
            />
          </View>

          {/* ── Log Amount ── */}
          <View style={s.card}>
            <Text style={s.cardTitle}>{t("createFood.logAmountTitle")}</Text>
            <Text style={s.inputLabel}>{returnTo === "meal" || returnTo === "recipe" ? "Grams" : t("createFood.eatenGrams")}</Text>
            <TextInput
              value={customGrams}
              onChangeText={setCustomGrams}
              keyboardType="numeric"
              placeholder={t("createFood.logGramsPlaceholder")}
              placeholderTextColor="#9ca3af"
              style={s.input}
            />

            {customFoodPreview ? (
              <View style={s.previewBox}>
                <Text style={s.previewTitle}>
                  {returnTo === "meal" || returnTo === "recipe"
                    ? `Will add ${customFoodPreview.grams}g as ingredient`
                    : t("createFood.willBeLogged").replace("{grams}", String(customFoodPreview.grams))}
                </Text>
                <View style={s.previewRow}>
                  <Text style={s.previewItem}>🔥 {customFoodPreview.calories} kcal</Text>
                  <Text style={s.previewItem}>🥩 {customFoodPreview.protein}g P</Text>
                  <Text style={s.previewItem}>🍚 {customFoodPreview.carbs}g C</Text>
                  <Text style={s.previewItem}>🥑 {customFoodPreview.fats}g F</Text>
                </View>
              </View>
            ) : null}

            <Pressable
              onPress={() => createCustomMutation.mutate()}
              disabled={createCustomMutation.isPending}
              style={({ pressed }) => [s.addBtn, pressed && s.pressed]}
            >
              <Text style={s.addBtnText}>
                {createCustomMutation.isPending
                  ? t("createFood.saving")
                  : returnTo === "meal" || returnTo === "recipe"
                  ? "Create & add as ingredient"
                  : t("createFood.createAndLog")}
              </Text>
            </Pressable>
          </View>
        </ScrollView>

        <View style={s.footer}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t("createFood.backToAddFood")}
            style={({ pressed }) => [s.doneBtn, pressed && s.pressed]}
          >
            <Text style={s.doneBtnText}>{t("createFood.backToAddFood")}</Text>
          </Pressable>
        </View>

        {toastMessage ? (
          <Animated.View
            style={[
              s.toast,
              {
                opacity: toastAnim,
                transform: [
                  {
                    translateY: toastAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}
            pointerEvents="none"
          >
            <Text style={s.toastText}>✓ {toastMessage}</Text>
          </Animated.View>
        ) : null}

        <BarcodeScannerModal
          visible={scannerVisible}
          onScanned={(code) => {
            setCustomBarcode(code);
            setScannerVisible(false);
          }}
          onClose={() => setScannerVisible(false)}
        />

        {/* Photo capture modal */}
        <Modal visible={photoModalVisible} animationType="slide" onRequestClose={() => setPhotoModalVisible(false)}>
          <View style={ps.container}>
            {cameraPermission?.granted ? (
              <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
            ) : (
              <View style={ps.permissionBox}>
                <Text style={ps.permissionText}>{t("barcodeScanner.permissionRequired")}</Text>
                <Pressable style={ps.grantBtn} onPress={requestCameraPermission}>
                  <Text style={ps.grantBtnText}>{t("barcodeScanner.grantPermission")}</Text>
                </Pressable>
              </View>
            )}
            <View style={ps.overlay} pointerEvents="none" />
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={ps.bottom}
            >
              {photoAnalyzing ? (
                <View style={ps.analyzingRow}>
                  <ActivityIndicator color="#16a34a" />
                  <Text style={ps.analyzingText}>{t("photoLog.analyzing")}</Text>
                </View>
              ) : (
                <Pressable style={ps.captureBtn} onPress={onPhotoCapture} disabled={!cameraPermission?.granted}>
                  <Ionicons name="camera" size={24} color="#fff" />
                  <Text style={ps.captureBtnText}>{t("createFood.analyzePhotoBtn")}</Text>
                </Pressable>
              )}
              <Pressable style={ps.cancelBtn} onPress={() => setPhotoModalVisible(false)}>
                <Text style={ps.cancelBtnText}>{t("common.cancel")}</Text>
              </Pressable>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fdfb" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  headerIcon: { fontSize: 20 },
  headerText: { fontSize: 18, fontWeight: "700", color: "#111827" },
  headerDate: { fontSize: 12, color: "#16a34a", fontWeight: "700" },

  scroll: { padding: 16, gap: 12, paddingBottom: 40 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardTitle: { fontSize: 11, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.8 },
  helperText: { fontSize: 12, color: "#6b7280", lineHeight: 17 },
  inputLabel: { fontSize: 12, fontWeight: "700", color: "#374151", marginTop: 2 },

  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#f9fafb",
  },

  previewBox: {
    borderWidth: 1,
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  previewTitle: { fontSize: 12, color: "#166534", fontWeight: "700" },
  previewRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  previewItem: { fontSize: 12, color: "#374151", fontWeight: "600" },

  aiBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 10,
    paddingVertical: 8,
  },
  aiBtnText: { fontSize: 13, fontWeight: "700", color: "#166534" },
  aiNote: { fontSize: 11, color: "#6b7280", fontStyle: "italic" },
  photoFillBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#faf5ff",
    borderWidth: 1,
    borderColor: "#c4b5fd",
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 2,
  },
  photoFillBtnText: { fontSize: 13, fontWeight: "700", color: "#7c3aed" },

  addBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 80,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: "#f8fdfb",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  doneBtn: {
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  doneBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  pressed: { opacity: 0.65 },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  inputFlex: {
    flex: 1,
    marginBottom: 0,
  },
  scanIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    alignItems: "center",
    justifyContent: "center",
  },

  toast: {
    position: "absolute",
    bottom: 86,
    left: 24,
    right: 24,
    backgroundColor: "#166534",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});

const ps = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.3)" },
  bottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.75)",
    padding: 20,
    paddingBottom: 40,
    gap: 10,
  },
  label: { color: "#d1fae5", fontSize: 13, fontWeight: "600" },
  hintInput: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#fff",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  captureBtn: {
    flexDirection: "row",
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  captureBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  analyzingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 14 },
  analyzingText: { color: "#d1fae5", fontWeight: "600" },
  cancelBtn: { alignItems: "center", paddingVertical: 10 },
  cancelBtnText: { color: "#d1fae5", fontWeight: "600", fontSize: 15 },
  permissionBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  permissionText: { color: "#fff", textAlign: "center", fontSize: 15 },
  grantBtn: { backgroundColor: "#16a34a", borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  grantBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
