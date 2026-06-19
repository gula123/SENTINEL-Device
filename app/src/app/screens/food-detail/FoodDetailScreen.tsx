import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../../navigation/navigationTypes";
import { useAuth } from "../../state/AuthContext";
import {
  getFoodCandidates,
  submitCorrection,
  voteForCandidate,
  voteForOriginal,
  submitDuplicateReport,
  searchFoods,
  type FoodItem,
  type FoodValueCandidate,
} from "../../services/food/foodLogsApi";

type Props = NativeStackScreenProps<MainStackParamList, "FoodDetail">;

export default function FoodDetailScreen({ route, navigation }: Props) {
  const { food } = route.params;
  const { token, signOut } = useAuth();

  const [candidates, setCandidates] = useState<FoodValueCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [voting, setVoting] = useState(false);

  // Correction modal
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [corrCal, setCorrCal] = useState("");
  const [corrProt, setCorrProt] = useState("");
  const [corrCarbs, setCorrCarbs] = useState("");
  const [corrFats, setCorrFats] = useState("");
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  // Duplicate report modal
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [dupSearch, setDupSearch] = useState("");
  const [dupResults, setDupResults] = useState<FoodItem[]>([]);
  const [dupSearching, setDupSearching] = useState(false);
  const [selectedCanonical, setSelectedCanonical] = useState<FoodItem | null>(null);
  const [dupNotes, setDupNotes] = useState("");
  const [submittingDup, setSubmittingDup] = useState(false);
  const [dupSubmitted, setDupSubmitted] = useState(false);

  function handleError(err: unknown) {
    if (err instanceof Error && err.message === "AUTH_EXPIRED") {
      signOut();
    }
  }

  const loadCandidates = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getFoodCandidates(token, food.id);
      setCandidates(data);
    } catch (err) {
      handleError(err);
    } finally {
      setLoadingCandidates(false);
    }
  }, [token, food.id]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  // Duplicate search with debounce
  useEffect(() => {
    if (dupSearch.trim().length < 2) {
      setDupResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      if (!token) return;
      setDupSearching(true);
      try {
        const results = await searchFoods(token, dupSearch);
        setDupResults(results.filter((r) => r.id !== food.id));
      } catch (err) {
        handleError(err);
      } finally {
        setDupSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [dupSearch, token, food.id]);

  const openCorrectionModal = () => {
    setCorrCal(String(food.calories));
    setCorrProt(String(food.protein));
    setCorrCarbs(String(food.carbs));
    setCorrFats(String(food.fats));
    setShowCorrectionModal(true);
  };

  const handleSubmitCorrection = async () => {
    const cal = parseFloat(corrCal);
    const prot = parseFloat(corrProt);
    const carbs = parseFloat(corrCarbs);
    const fats = parseFloat(corrFats);
    if ([cal, prot, carbs, fats].some(isNaN) || [cal, prot, carbs, fats].some((v) => v < 0)) {
      Alert.alert("Invalid values", "All fields must be valid non-negative numbers.");
      return;
    }
    if (!token) return;
    setSubmittingCorrection(true);
    try {
      const updated = await submitCorrection(token, food.id, {
        caloriesPer100g: cal,
        proteinPer100g: prot,
        carbsPer100g: carbs,
        fatsPer100g: fats,
      });
      setCandidates(updated);
      setShowCorrectionModal(false);
    } catch (err) {
      handleError(err);
      Alert.alert("Error", "Failed to submit correction. Please try again.");
    } finally {
      setSubmittingCorrection(false);
    }
  };

  const handleVoteOriginal = async () => {
    if (!token) return;
    setVoting(true);
    try {
      const updated = await voteForOriginal(token, food.id);
      setCandidates(updated);
    } catch (err) {
      handleError(err);
    } finally {
      setVoting(false);
    }
  };

  const handleVoteCandidate = async (candidateId: number) => {
    if (!token) return;
    setVoting(true);
    try {
      const updated = await voteForCandidate(token, food.id, candidateId);
      setCandidates(updated);
    } catch (err) {
      handleError(err);
    } finally {
      setVoting(false);
    }
  };

  const handleSubmitDuplicateReport = async () => {
    if (!selectedCanonical || !token) return;
    setSubmittingDup(true);
    try {
      await submitDuplicateReport(token, food.id, selectedCanonical.id, dupNotes || undefined);
      setDupSubmitted(true);
    } catch (err) {
      handleError(err);
      Alert.alert("Error", "Failed to submit report. Please try again.");
    } finally {
      setSubmittingDup(false);
    }
  };

  const hasCandidates = candidates.length > 0;

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [s.backBtn, pressed && s.pressed]}
        >
          <Ionicons name="arrow-back" size={20} color="#374151" />
        </Pressable>
        <View style={s.headerContent}>
          <Text style={s.headerTitle} numberOfLines={1}>{food.name}</Text>
          {food.brandOrPlace ? (
            <Text style={s.headerSub} numberOfLines={1}>{food.brandOrPlace}</Text>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {/* Macro card */}
        <View style={s.card}>
          <View style={s.macroRow}>
            {[
              { label: "Calories", value: `${Math.round(food.calories)} kcal`, color: "#f97316" },
              { label: "Protein", value: `${food.protein}g`, color: "#ef4444" },
              { label: "Carbs", value: `${food.carbs}g`, color: "#16a34a" },
              { label: "Fats", value: `${food.fats}g`, color: "#eab308" },
            ].map((m) => (
              <View key={m.label} style={s.macroItem}>
                <Text style={[s.macroValue, { color: m.color }]}>{m.value}</Text>
                <Text style={s.macroLabel}>{m.label}</Text>
              </View>
            ))}
          </View>
          <Text style={s.per100g}>per 100g</Text>
        </View>

        {/* Community values */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Community Values</Text>

          {loadingCandidates ? (
            <ActivityIndicator size="small" color="#16a34a" />
          ) : !hasCandidates ? (
            <View style={s.noCandidates}>
              <Text style={s.noVotesText}>No one has verified these values yet.</Text>
              <View style={s.voteButtonRow}>
                <Pressable
                  onPress={handleVoteOriginal}
                  disabled={voting}
                  style={({ pressed }) => [s.voteBtn, s.voteBtnPrimary, pressed && s.pressed]}
                >
                  <Text style={s.voteBtnPrimaryText}>These look correct</Text>
                </Pressable>
                <Pressable
                  onPress={openCorrectionModal}
                  style={({ pressed }) => [s.voteBtn, s.voteBtnSecondary, pressed && s.pressed]}
                >
                  <Text style={s.voteBtnSecondaryText}>Suggest correction</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              {candidates.map((c) => (
                <View
                  key={c.id}
                  style={[s.candidateRow, c.currentUserVoted && s.candidateRowVoted]}
                >
                  <View style={s.candidateInfo}>
                    <Text style={s.candidateLabel}>
                      {c.isOriginal ? "Originally entered values" : "Suggested correction"}
                    </Text>
                    <Text style={s.candidateMacros}>
                      {c.caloriesPer100g} kcal • P:{c.proteinPer100g}g C:{c.carbsPer100g}g F:{c.fatsPer100g}g
                    </Text>
                    <Text style={s.candidateVotes}>
                      {c.voteCount} {c.voteCount === 1 ? "vote" : "votes"}
                      {c.currentUserVoted ? "  ✓ your vote" : ""}
                    </Text>
                  </View>
                  {!c.currentUserVoted && (
                    <Pressable
                      onPress={() => handleVoteCandidate(c.id)}
                      disabled={voting}
                      style={({ pressed }) => [s.smallVoteBtn, pressed && s.pressed]}
                    >
                      <Text style={s.smallVoteBtnText}>Correct</Text>
                    </Pressable>
                  )}
                </View>
              ))}
              <Pressable
                onPress={openCorrectionModal}
                style={({ pressed }) => [s.suggestBtn, pressed && s.pressed]}
              >
                <Ionicons name="add-circle-outline" size={14} color="#16a34a" />
                <Text style={s.suggestBtnText}>Suggest different values</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* Report duplicate */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Duplicate Entry</Text>
          <Text style={s.helperText}>Is this food a duplicate of another entry?</Text>
          <Pressable
            onPress={() => {
              setShowDuplicateModal(true);
              setDupSubmitted(false);
              setSelectedCanonical(null);
              setDupSearch("");
              setDupNotes("");
            }}
            style={({ pressed }) => [s.reportBtn, pressed && s.pressed]}
          >
            <Text style={s.reportBtnText}>Report duplicate</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Correction modal */}
      <Modal
        visible={showCorrectionModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCorrectionModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <SafeAreaView style={s.modalSafe}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Suggest correction</Text>
              <Pressable onPress={() => setShowCorrectionModal(false)}>
                <Ionicons name="close" size={22} color="#374151" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={s.modalScroll}>
              <Text style={s.modalSubtitle}>
                Enter correct values per 100g for <Text style={{ fontWeight: "700" }}>{food.name}</Text>
              </Text>
              {(
                [
                  { label: "Calories (kcal)", value: corrCal, setter: setCorrCal },
                  { label: "Protein (g)", value: corrProt, setter: setCorrProt },
                  { label: "Carbs (g)", value: corrCarbs, setter: setCorrCarbs },
                  { label: "Fats (g)", value: corrFats, setter: setCorrFats },
                ] as { label: string; value: string; setter: (v: string) => void }[]
              ).map(({ label, value, setter }) => (
                <View key={label} style={s.fieldGroup}>
                  <Text style={s.fieldLabel}>{label}</Text>
                  <TextInput
                    style={s.fieldInput}
                    value={value}
                    onChangeText={setter}
                    keyboardType="decimal-pad"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              ))}
            </ScrollView>
            <View style={s.modalFooter}>
              <Pressable
                onPress={() => setShowCorrectionModal(false)}
                style={({ pressed }) => [s.modalCancelBtn, pressed && s.pressed]}
              >
                <Text style={s.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmitCorrection}
                disabled={submittingCorrection}
                style={({ pressed }) => [s.modalSubmitBtn, pressed && s.pressed, submittingCorrection && s.disabled]}
              >
                <Text style={s.modalSubmitText}>
                  {submittingCorrection ? "Submitting..." : "Submit"}
                </Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Duplicate report modal */}
      <Modal
        visible={showDuplicateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDuplicateModal(false)}
      >
        <SafeAreaView style={s.modalSafe}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Report duplicate</Text>
            <Pressable onPress={() => setShowDuplicateModal(false)}>
              <Ionicons name="close" size={22} color="#374151" />
            </Pressable>
          </View>

          {dupSubmitted ? (
            <View style={s.dupSuccess}>
              <Ionicons name="checkmark-circle" size={48} color="#16a34a" />
              <Text style={s.dupSuccessTitle}>Report submitted</Text>
              <Text style={s.dupSuccessText}>Your report has been submitted for admin review.</Text>
              <Pressable
                onPress={() => setShowDuplicateModal(false)}
                style={({ pressed }) => [s.reportBtn, pressed && s.pressed, { alignSelf: "center", marginTop: 16 }]}
              >
                <Text style={s.reportBtnText}>Close</Text>
              </Pressable>
            </View>
          ) : (
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={{ flex: 1 }}
            >
              <ScrollView contentContainerStyle={s.modalScroll}>
                <Text style={s.modalSubtitle}>
                  Search for the correct canonical entry this food should be merged into.
                </Text>

                {!selectedCanonical ? (
                  <>
                    <TextInput
                      style={s.fieldInput}
                      placeholder="Search for the correct food..."
                      placeholderTextColor="#9ca3af"
                      value={dupSearch}
                      onChangeText={setDupSearch}
                    />
                    {dupSearching && (
                      <ActivityIndicator size="small" color="#16a34a" style={{ marginTop: 8 }} />
                    )}
                    {dupResults.length > 0 && (
                      <View style={s.results}>
                        {dupResults.map((r) => (
                          <Pressable
                            key={r.id}
                            onPress={() => setSelectedCanonical(r)}
                            style={({ pressed }) => [s.resultRow, pressed && s.pressed]}
                          >
                            <View style={s.resultTextCol}>
                              <Text style={s.resultName}>{r.name}</Text>
                              {r.brandOrPlace ? (
                                <Text style={s.resultSubmeta}>{r.brandOrPlace}</Text>
                              ) : null}
                            </View>
                            <Text style={s.resultMeta}>{Math.round(r.calories)} kcal/100g</Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    {/* Side-by-side comparison */}
                    <View style={s.compareRow}>
                      {[
                        { label: "Duplicate (this)", item: food, accent: "#f97316" },
                        { label: "Canonical (keep)", item: selectedCanonical, accent: "#16a34a" },
                      ].map(({ label, item, accent }) => (
                        <View key={label} style={s.compareCard}>
                          <Text style={[s.compareCardLabel, { color: accent }]}>{label}</Text>
                          <Text style={s.compareCardName} numberOfLines={2}>{item.name}</Text>
                          {item.brandOrPlace ? (
                            <Text style={s.compareCardBrand}>{item.brandOrPlace}</Text>
                          ) : null}
                          <Text style={s.compareCardMacros}>
                            {Math.round(item.calories)} kcal{"\n"}
                            P:{item.protein}g C:{item.carbs}g F:{item.fats}g
                          </Text>
                        </View>
                      ))}
                    </View>
                    <Pressable
                      onPress={() => setSelectedCanonical(null)}
                      style={{ marginBottom: 8 }}
                    >
                      <Text style={s.searchAgain}>← Search again</Text>
                    </Pressable>
                    <View style={s.fieldGroup}>
                      <Text style={s.fieldLabel}>Notes (optional)</Text>
                      <TextInput
                        style={[s.fieldInput, { height: 72, textAlignVertical: "top" }]}
                        value={dupNotes}
                        onChangeText={setDupNotes}
                        placeholder="Why do you think this is a duplicate?"
                        placeholderTextColor="#9ca3af"
                        multiline
                      />
                    </View>
                  </>
                )}
              </ScrollView>

              {selectedCanonical && (
                <View style={s.modalFooter}>
                  <Pressable
                    onPress={() => setShowDuplicateModal(false)}
                    style={({ pressed }) => [s.modalCancelBtn, pressed && s.pressed]}
                  >
                    <Text style={s.modalCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSubmitDuplicateReport}
                    disabled={submittingDup}
                    style={({ pressed }) => [s.modalSubmitBtnOrange, pressed && s.pressed, submittingDup && s.disabled]}
                  >
                    <Text style={s.modalSubmitText}>
                      {submittingDup ? "Submitting..." : "Submit report"}
                    </Text>
                  </Pressable>
                </View>
              )}
            </KeyboardAvoidingView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fdfb" },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },

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
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },
  headerSub: { fontSize: 12, color: "#6b7280", marginTop: 1 },

  scroll: { padding: 16, gap: 12, paddingBottom: 40 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.8 },
  helperText: { fontSize: 13, color: "#6b7280" },

  macroRow: { flexDirection: "row", justifyContent: "space-between" },
  macroItem: { alignItems: "center", flex: 1 },
  macroValue: { fontSize: 15, fontWeight: "700" },
  macroLabel: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  per100g: { fontSize: 11, color: "#9ca3af", textAlign: "center" },

  noCandidates: { gap: 10 },
  noVotesText: { fontSize: 13, color: "#6b7280" },
  voteButtonRow: { flexDirection: "row", gap: 8 },
  voteBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  voteBtnPrimary: { backgroundColor: "#dcfce7", borderWidth: 1, borderColor: "#bbf7d0" },
  voteBtnPrimaryText: { fontSize: 13, fontWeight: "600", color: "#166534" },
  voteBtnSecondary: { backgroundColor: "#f3f4f6", borderWidth: 1, borderColor: "#e5e7eb" },
  voteBtnSecondaryText: { fontSize: 13, fontWeight: "600", color: "#374151" },

  candidateRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 8,
  },
  candidateRowVoted: {
    backgroundColor: "#f0fdf4",
    borderColor: "#86efac",
  },
  candidateInfo: { flex: 1, gap: 2 },
  candidateLabel: { fontSize: 11, color: "#6b7280", fontWeight: "600" },
  candidateMacros: { fontSize: 13, color: "#111827" },
  candidateVotes: { fontSize: 11, color: "#16a34a", fontWeight: "600" },
  smallVoteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#dcfce7",
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  smallVoteBtnText: { fontSize: 12, color: "#166534", fontWeight: "600" },

  suggestBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 2,
    paddingVertical: 4,
  },
  suggestBtnText: { fontSize: 13, color: "#16a34a", fontWeight: "600" },

  reportBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  reportBtnText: { fontSize: 13, fontWeight: "600", color: "#374151" },

  // Modal
  modalSafe: { flex: 1, backgroundColor: "#fff" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },
  modalScroll: { padding: 16, gap: 14, paddingBottom: 24 },
  modalSubtitle: { fontSize: 13, color: "#6b7280", lineHeight: 19 },
  fieldGroup: { gap: 4 },
  fieldLabel: { fontSize: 12, color: "#6b7280", fontWeight: "600" },
  fieldInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#f9fafb",
  },
  modalFooter: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
  },
  modalCancelText: { fontSize: 14, fontWeight: "600", color: "#374151" },
  modalSubmitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#16a34a",
    alignItems: "center",
  },
  modalSubmitBtnOrange: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#ea580c",
    alignItems: "center",
  },
  modalSubmitText: { fontSize: 14, fontWeight: "700", color: "#fff" },

  // Duplicate search
  results: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    overflow: "hidden",
    marginTop: 6,
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    backgroundColor: "#fff",
  },
  resultTextCol: { flex: 1, marginRight: 8 },
  resultName: { fontSize: 13, color: "#111827" },
  resultSubmeta: { fontSize: 11, color: "#6b7280", marginTop: 2, fontWeight: "500" },
  resultMeta: { fontSize: 12, color: "#9ca3af" },

  compareRow: { flexDirection: "row", gap: 10 },
  compareCard: {
    flex: 1,
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 3,
  },
  compareCardLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  compareCardName: { fontSize: 13, fontWeight: "600", color: "#111827" },
  compareCardBrand: { fontSize: 11, color: "#6b7280" },
  compareCardMacros: { fontSize: 11, color: "#6b7280", marginTop: 2, lineHeight: 16 },

  searchAgain: { fontSize: 13, color: "#16a34a", fontWeight: "600" },

  // Duplicate success
  dupSuccess: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8 },
  dupSuccessTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  dupSuccessText: { fontSize: 14, color: "#6b7280", textAlign: "center" },
});
