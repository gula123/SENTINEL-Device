import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { searchFoods, type FoodItem } from "../../services/food/foodLogsApi";
import { useAuth } from "../../state/AuthContext";
import { setPendingMealFood } from "../../state/mealFoodPicker";

type Props = NativeStackScreenProps<MainStackParamList, "SearchMealFood">;

export default function SearchMealFoodScreen({ navigation }: Props) {
  const { token, signOut } = useAuth();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!token || debouncedQuery.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;

    const runSearch = async () => {
      try {
        setSearching(true);
        const foods = await searchFoods(token, debouncedQuery);
        if (!cancelled) {
          setResults(foods.slice(0, 12));
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Search failed";
        if (msg === "AUTH_EXPIRED") {
          signOut();
          return;
        }
        Alert.alert("Error", msg);
      } finally {
        if (!cancelled) setSearching(false);
      }
    };

    runSearch();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, token, signOut]);

  const onSelectFood = (food: FoodItem) => {
    setPendingMealFood(food);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={s.header}>
          <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [s.backBtn, pressed && s.pressed]}>
            <Ionicons name="chevron-back" size={20} color="#374151" />
          </Pressable>
          <Text style={s.headerText}>Search Food</Text>
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.card}>
            <View style={s.searchRow}>
              <Ionicons name="search-outline" size={16} color="#9ca3af" style={s.searchIcon} />
              <TextInput
                style={s.searchInput}
                placeholder="Search foods..."
                placeholderTextColor="#9ca3af"
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
              />
              {searching ? <ActivityIndicator size="small" color="#16a34a" /> : null}
            </View>

            {debouncedQuery.trim().length >= 2 && results.length === 0 && !searching ? (
              <Text style={s.emptyText}>No results found.</Text>
            ) : null}

            {results.length > 0 ? (
              <View style={s.searchResults}>
                {results.map((food) => (
                  <Pressable
                    key={food.id}
                    onPress={() => onSelectFood(food)}
                    style={({ pressed }) => [s.searchResultRow, pressed && s.pressed]}
                  >
                    <View style={s.searchResultLeft}>
                      <Text style={s.searchResultName} numberOfLines={1}>{food.name}</Text>
                      {food.brandOrPlace ? (
                        <Text style={s.searchResultBrand} numberOfLines={1}>{food.brandOrPlace}</Text>
                      ) : null}
                    </View>
                    <Text style={s.searchResultCal}>{Math.round(food.calories)} kcal/100g</Text>
                    <Ionicons name="add-circle" size={20} color="#16a34a" />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        </ScrollView>
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
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    gap: 8,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { fontSize: 16, fontWeight: "700", color: "#111827" },
  scroll: { padding: 16, gap: 10, paddingBottom: 32 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 10,
    backgroundColor: "#f9fafb",
    gap: 6,
  },
  searchIcon: { marginRight: 2 },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
  },
  emptyText: { fontSize: 12, color: "#9ca3af", textAlign: "center", paddingVertical: 8 },
  searchResults: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    overflow: "hidden",
  },
  searchResultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    backgroundColor: "#fff",
  },
  searchResultLeft: { flex: 1 },
  searchResultName: { fontSize: 13, color: "#111827", fontWeight: "600" },
  searchResultBrand: { fontSize: 11, color: "#6b7280", marginTop: 1 },
  searchResultCal: { fontSize: 11, color: "#9ca3af" },
  pressed: { opacity: 0.65 },
});
