import type { MealType } from "../services/food/foodLogsApi";

export type MainStackParamList = {
  Tabs: undefined;
  LogFood: { meal: MealType; date: string };
  AddFood: { meal: MealType; date: string };
  SearchFood: { meal: MealType; date: string };
  SearchMealFood: { meal: MealType; date: string; editMealId?: number };
  CreateFood: { meal: MealType; date: string };
  MealDetail: { meal: MealType; date: string; editMealId?: number };
  HabitInsights: { habitId: number; habitName: string };
};
