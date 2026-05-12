import { authenticatedFetch } from "../api/client";

export interface SavedMealItemDto {
  id: number;
  foodId: number;
  foodName: string;
  brandOrPlace?: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface SavedMealDto {
  id: number;
  name: string;
  items: SavedMealItemDto[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFats: number;
}

export interface SavedMealRequest {
  name: string;
  items: { foodId: number; grams: number }[];
}

export async function fetchSavedMeals(token: string): Promise<SavedMealDto[]> {
  const response = await authenticatedFetch("/meals", token, { method: "GET" });
  if (!response.ok) throw new Error("Failed to fetch saved meals");
  return response.json();
}

export async function createSavedMeal(token: string, request: SavedMealRequest): Promise<SavedMealDto> {
  const response = await authenticatedFetch("/meals", token, {
    method: "POST",
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error("Failed to create saved meal");
  return response.json();
}

export async function updateSavedMeal(
  token: string,
  mealId: number,
  request: SavedMealRequest
): Promise<SavedMealDto> {
  const response = await authenticatedFetch(`/meals/${mealId}`, token, {
    method: "PUT",
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error("Failed to update saved meal");
  return response.json();
}

export async function deleteSavedMeal(token: string, mealId: number): Promise<void> {
  const response = await authenticatedFetch(`/meals/${mealId}`, token, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete saved meal");
}

export async function logSavedMeal(
  token: string,
  mealId: number,
  mealType: string,
  logDate: string
): Promise<void> {
  const response = await authenticatedFetch(`/meals/${mealId}/log`, token, {
    method: "POST",
    body: JSON.stringify({ mealType, logDate }),
  });
  if (!response.ok) throw new Error("Failed to log saved meal");
}

export async function reorderSavedMeals(token: string, mealIds: number[]): Promise<void> {
  const response = await authenticatedFetch("/meals/reorder", token, {
    method: "POST",
    body: JSON.stringify(mealIds),
  });
  if (!response.ok) throw new Error("Failed to reorder saved meals");
}
