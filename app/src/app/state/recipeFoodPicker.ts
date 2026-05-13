import type { FoodItem } from "../services/food/foodLogsApi";

let pendingRecipeFood: FoodItem | null = null;

export function setPendingRecipeFood(food: FoodItem) {
  pendingRecipeFood = food;
}

export function consumePendingRecipeFood() {
  const food = pendingRecipeFood;
  pendingRecipeFood = null;
  return food;
}
