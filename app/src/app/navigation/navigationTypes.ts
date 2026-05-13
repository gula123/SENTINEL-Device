import type { MealType } from "../services/food/foodLogsApi";
import type { RecipeDto } from "../services/food/recipesApi";

export type MainStackParamList = {
  Tabs: undefined;
  LogFood: { meal: MealType; date: string };
  AddFood: { meal: MealType; date: string };
  SearchFood: { meal: MealType; date: string };
  SearchMealFood: { meal: MealType; date: string; editMealId?: number };
  SearchRecipeFood: { meal: MealType; date: string };
  CreateFood: { meal: MealType; date: string };
  MealDetail: { meal: MealType; date: string; editMealId?: number };
  HabitInsights: { habitId: number; habitName: string };
  CreateRecipe: { meal: MealType; date: string; recipe?: RecipeDto; isCopy?: boolean };
  RecipeDetail: { meal: MealType; date: string; recipe: RecipeDto };
};
