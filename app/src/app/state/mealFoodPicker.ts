import type { FoodItem } from "../services/food/foodLogsApi";

interface PendingMealFood {
  food: FoodItem;
  grams: number;
}

let pendingMealFood: PendingMealFood | null = null;

export function setPendingMealFood(food: FoodItem, grams: number) {
  pendingMealFood = { food, grams };
}

export function consumePendingMealFood(): PendingMealFood | null {
  const data = pendingMealFood;
  pendingMealFood = null;
  return data;
}
