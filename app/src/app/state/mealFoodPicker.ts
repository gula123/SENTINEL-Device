import type { FoodItem } from "../services/food/foodLogsApi";

let pendingMealFood: FoodItem | null = null;

export function setPendingMealFood(food: FoodItem) {
  pendingMealFood = food;
}

export function consumePendingMealFood() {
  const food = pendingMealFood;
  pendingMealFood = null;
  return food;
}
