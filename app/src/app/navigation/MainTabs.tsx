import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import HomeScreen from "../screens/home/HomeScreen";
import DiaryScreen from "../screens/diary/DiaryScreen";
import QuickActionsScreen from "../screens/quick-actions/QuickActionsScreen";
import ProgressScreen from "../screens/progress/ProgressScreen";
import SettingsScreen from "../screens/settings/SettingsScreen";

export type MainTabParamList = {
  Home: undefined;
  Diary: undefined;
  Actions: undefined;
  Progress: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#ef4444",
        tabBarInactiveTintColor: "#9ca3af",
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: "Home" }} />
      <Tab.Screen name="Diary" component={DiaryScreen} options={{ tabBarLabel: "Diary" }} />
      <Tab.Screen name="Actions" component={QuickActionsScreen} options={{ tabBarLabel: "+" }} />
      <Tab.Screen name="Progress" component={ProgressScreen} options={{ tabBarLabel: "Progress" }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: "Settings" }} />
    </Tab.Navigator>
  );
}
