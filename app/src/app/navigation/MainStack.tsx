import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabs from "./MainTabs";
import LogFoodScreen from "../screens/log-food/LogFoodScreen";
import AddFoodScreen from "../screens/add-food/AddFoodScreen";
import SearchFoodScreen from "../screens/search-food/SearchFoodScreen";
import SearchMealFoodScreen from "../screens/search-meal-food/SearchMealFoodScreen";
import CreateFoodScreen from "../screens/create-food/CreateFoodScreen";
import MealDetailScreen from "../screens/meal-detail/MealDetailScreen";
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
      <Stack.Screen
        name="SearchMealFood"
        component={SearchMealFoodScreen}
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen
        name="AddFood"
        component={AddFoodScreen}
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen
        name="CreateFood"
        component={CreateFoodScreen}
        options={{ presentation: "modal", headerShown: false }}
      />
        <Stack.Screen
          name="MealDetail"
          component={MealDetailScreen}
          options={{ presentation: "modal", headerShown: false }}
        />
    </Stack.Navigator>
  );
}
