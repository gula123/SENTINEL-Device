import type { FoodItem } from "../services/food/foodLogsApi";

interface PendingRecipeFood {
  food: FoodItem;
  grams: number;
}

let pendingRecipeFood: PendingRecipeFood | null = null;

export function setPendingRecipeFood(food: FoodItem, grams: number) {
  pendingRecipeFood = { food, grams };
}

export function consumePendingRecipeFood(): PendingRecipeFood | null {
  const data = pendingRecipeFood;
  pendingRecipeFood = null;
  return data;
}
