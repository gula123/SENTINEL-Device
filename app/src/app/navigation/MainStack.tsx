import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabs from "./MainTabs";
import LogFoodScreen from "../screens/log-food/LogFoodScreen";
import SearchFoodScreen from "../screens/search-food/SearchFoodScreen";
import HabitInsightsScreen from "../screens/habits/HabitInsightsScreen";
import type { MainStackParamList } from "./navigationTypes";

export type { MainStackParamList };

const Stack = createNativeStackNavigator<MainStackParamList>();

export default function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={MainTabs} />
      <Stack.Screen name="HabitInsights" component={HabitInsightsScreen} />
      <Stack.Screen
        name="LogFood"
        component={LogFoodScreen}
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen
        name="SearchFood"
        component={SearchFoodScreen}
        options={{ presentation: "modal", headerShown: false }}
      />
    </Stack.Navigator>
  );
}
