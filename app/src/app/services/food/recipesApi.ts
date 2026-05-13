import { authenticatedFetch } from "../api/client";
import type { MealType } from "./foodLogsApi";

export interface RecipeIngredientDto {
  id?: number;
  foodId: number;
  foodName?: string;
  rawGrams: number;
  caloriesPer100g?: number;
  proteinPer100g?: number;
  carbsPer100g?: number;
  fatsPer100g?: number;
}

export interface RecipeDto {
  id: number;
  userId: number;
  ownerName: string;
  name: string;
  description?: string;
  isPublic: boolean;
  finalCookedWeightG?: number;
  portionSizeGrams?: number;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatsPer100g: number;
  originRecipeId?: number;
  ingredients: RecipeIngredientDto[];
  createdAt: string;
}

export interface CreateRecipeRequest {
  name: string;
  description?: string;
  isPublic?: boolean;
  finalCookedWeightG?: number;
  ingredients: { foodId: number; rawGrams: number }[];
  // Manual nutrition per 100g (used when ingredients list is empty)
  caloriesPer100g?: number;
  proteinPer100g?: number;
  carbsPer100g?: number;
  fatsPer100g?: number;
}

export async function fetchMyRecipes(token: string): Promise<RecipeDto[]> {
  const response = await authenticatedFetch("/recipes/mine", token, { method: "GET" });
  if (!response.ok) {
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    throw new Error(`Failed to fetch recipes (${response.status})`);
  }
  return response.json();
}

export async function fetchRecipe(token: string, recipeId: number): Promise<RecipeDto> {
  const response = await authenticatedFetch(`/recipes/${recipeId}`, token, { method: "GET" });
  if (!response.ok) {
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    throw new Error(`Failed to fetch recipe (${response.status})`);
  }
  return response.json();
}

export async function createRecipe(token: string, request: CreateRecipeRequest): Promise<RecipeDto> {
  const response = await authenticatedFetch("/recipes", token, {
    method: "POST",
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    const text = await response.text();
    throw new Error(text || `Failed to create recipe (${response.status})`);
  }
  return response.json();
}

export async function updateRecipe(token: string, recipeId: number, request: CreateRecipeRequest): Promise<RecipeDto> {
  const response = await authenticatedFetch(`/recipes/${recipeId}`, token, {
    method: "PUT",
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    const text = await response.text();
    throw new Error(text || `Failed to update recipe (${response.status})`);
  }
  return response.json();
}

export async function deleteRecipe(token: string, recipeId: number): Promise<void> {
  const response = await authenticatedFetch(`/recipes/${recipeId}`, token, { method: "DELETE" });
  if (!response.ok) {
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    throw new Error(`Failed to delete recipe (${response.status})`);
  }
}

export async function logRecipe(
  token: string,
  payload: {
    recipeId: number;
    grams: number;
    mealType: MealType;
    logDate: string;
  }
): Promise<void> {
  const response = await authenticatedFetch("/food/logs", token, {
    method: "POST",
    body: JSON.stringify({
      recipeId: payload.recipeId,
      grams: payload.grams,
      mealType: payload.mealType,
      logDate: payload.logDate,
    }),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    const text = await response.text();
    throw new Error(text || `Failed to log recipe (${response.status})`);
  }
}
