import type { MealType } from "../services/food/foodLogsApi";

export type MainStackParamList = {
  Tabs: undefined;
  LogFood: { meal: MealType; date: string };
  SearchFood: { meal: MealType; date: string };
  HabitInsights: { habitId: number; habitName: string };
};
