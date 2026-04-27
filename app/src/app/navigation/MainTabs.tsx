import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Platform, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import HabitsScreen from "../screens/habits/HabitsScreen";
import HomeScreen from "../screens/home/HomeScreen";
import MetricsScreen from "../screens/metrics/MetricsScreen";
import ProgressScreen from "../screens/progress/ProgressScreen";
import SettingsScreen from "../screens/settings/SettingsScreen";
import WeightDiaryScreen from "../screens/weight/WeightDiaryScreen";
import { useLanguage } from "../state/LanguageContext";

export type MainTabParamList = {
  Diary: { date?: string; focusToken?: number } | undefined;
  Habits: undefined;
  Metrics: undefined;
  Progress: undefined;
  Weight: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<string, string> = {
  Diary: "📖",
  Habits: "✅",
  Metrics: "📈",
  Progress: "📅",
  Weight: "⚖️",
  Settings: "⚙️",
};

export default function MainTabs() {
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === "web" ? 10 : Math.max(insets.bottom, 10);
  const { t } = useLanguage();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#16a34a",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 20, lineHeight: 24, opacity: focused ? 1 : 0.6 }}>
            {TAB_ICONS[route.name]}
          </Text>
        ),
        tabBarStyle: {
          height: 56 + bottomInset,
          paddingTop: 6,
          paddingBottom: bottomInset,
          borderTopWidth: 1,
          borderTopColor: "#e5e7eb",
          backgroundColor: "#fff",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          marginTop: 1,
        },
      })}
    >
      <Tab.Screen name="Diary" component={HomeScreen} options={{ tabBarLabel: t("nav.diary") }} />
      <Tab.Screen name="Habits" component={HabitsScreen} options={{ tabBarLabel: t("nav.habits") }} />
      <Tab.Screen name="Metrics" component={MetricsScreen} options={{ tabBarLabel: t("nav.metrics") }} />
      <Tab.Screen name="Progress" component={ProgressScreen} options={{ tabBarLabel: t("nav.calendar") }} />
      <Tab.Screen name="Weight" component={WeightDiaryScreen} options={{ tabBarLabel: t("nav.weight") }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: t("nav.settings") }} />
    </Tab.Navigator>
  );
}
