import { authenticatedFetch } from "../api/client";

export type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACKS";

export interface FoodLogDto {
  id: number;
  foodName: string;
  brandOrPlace?: string;
  foodId?: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  grams: number;
  mealType?: MealType;
  logDate?: string;
}

export interface FoodItem {
  id: number;
  name: string;
  brandOrPlace?: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  source: "CUSTOM" | "SEED";
}

export interface AiFoodEstimate {
  foodName: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatsPer100g: number;
  assumption?: string;
  source?: string;
}

export interface PortionDto {
  id: number;
  portionName: string;
  grams: number;
  portionTypeId?: number;
  portionTypeCode?: string;
  portionTypeLabel?: string;
}

export interface PortionTypeDto {
  id: number;
  code: string;
  label: string;
  sortOrder: number;
}

interface BackendFoodItem {
  id: number;
  name: string;
  brandOrPlace?: string | null;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatsPer100g: number;
  source: "CUSTOM" | "SEED";
}

export const fetchFoodLogs = async (token: string, date: string): Promise<FoodLogDto[]> => {
  const response = await authenticatedFetch(`/food/logs?date=${date}`, token, { method: "GET" });
  if (!response.ok) {
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    throw new Error(`Failed to fetch food logs (${response.status})`);
  }
  return response.json();
};

export const searchFoods = async (token: string, query: string): Promise<FoodItem[]> => {
  if (query.trim().length < 2) {
    return [];
  }

  const response = await authenticatedFetch(`/food/search?q=${encodeURIComponent(query)}`, token, {
    method: "GET",
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    throw new Error(`Food search failed (${response.status})`);
  }

  const items: BackendFoodItem[] = await response.json();
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    brandOrPlace: item.brandOrPlace || undefined,
    calories: item.caloriesPer100g,
    protein: item.proteinPer100g,
    carbs: item.carbsPer100g,
    fats: item.fatsPer100g,
    source: item.source,
  }));
};

export const createCustomFood = async (
  token: string,
  payload: {
    name: string;
    brandOrPlace?: string;
    caloriesPer100g: number;
    proteinPer100g: number;
    carbsPer100g: number;
    fatsPer100g: number;
  }
): Promise<FoodItem> => {
  const response = await authenticatedFetch("/food/custom", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    throw new Error(`Failed to create custom food (${response.status})`);
  }

  const item: BackendFoodItem = await response.json();
  return {
    id: item.id,
    name: item.name,
    brandOrPlace: item.brandOrPlace || undefined,
    calories: item.caloriesPer100g,
    protein: item.proteinPer100g,
    carbs: item.carbsPer100g,
    fats: item.fatsPer100g,
    source: item.source,
  };
};

export const estimateFoodPer100gWithAi = async (token: string, foodName: string, brandOrPlace?: string): Promise<AiFoodEstimate> => {
  const response = await authenticatedFetch("/food/ai-estimate", token, {
    method: "POST",
    body: JSON.stringify({ foodName, brandOrPlace }),
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401) throw new Error("AUTH_EXPIRED");

    try {
      const parsed = JSON.parse(text) as { error?: string };
      throw new Error(parsed.error || `AI estimate failed (${response.status})`);
    } catch {
      throw new Error(text || `AI estimate failed (${response.status})`);
    }
  }

  return response.json();
};

export const addFoodLog = async (
  token: string,
  payload: {
    foodName: string;
    foodId?: number;
    grams: number;
    mealType: MealType;
    calories?: number;
    protein?: number;
    carbs?: number;
    fats?: number;
    logDate: string;
  }
): Promise<FoodLogDto> => {
  const response = await authenticatedFetch("/food/logs", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    const text = await response.text();
    throw new Error(text || `Failed to add food log (${response.status})`);
  }

  return response.json();
};

export const updateFoodLogGrams = async (token: string, logId: number, grams: number): Promise<FoodLogDto> => {
  const response = await authenticatedFetch(`/food/logs/${logId}`, token, {
    method: "PUT",
    body: JSON.stringify({ grams }),
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    throw new Error(`Failed to update food log (${response.status})`);
  }

  return response.json();
};

export const deleteFoodLog = async (token: string, logId: number): Promise<void> => {
  const response = await authenticatedFetch(`/food/logs/${logId}`, token, {
    method: "DELETE",
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    throw new Error(`Failed to delete food log (${response.status})`);
  }
};

export const fetchFoodPortions = async (token: string, foodId: number): Promise<PortionDto[]> => {
  const response = await authenticatedFetch(`/food/portions?foodId=${foodId}`, token, { method: "GET" });
  if (!response.ok) {
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    throw new Error(`Failed to fetch portions (${response.status})`);
  }
  return response.json();
};

export const fetchPortionTypes = async (token: string): Promise<PortionTypeDto[]> => {
  const response = await authenticatedFetch("/food/portion-types", token, { method: "GET" });
  if (!response.ok) {
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    throw new Error(`Failed to fetch portion types (${response.status})`);
  }
  return response.json();
};

export const createFoodPortion = async (
  token: string,
  payload: { foodId: number; portionTypeCode: string; grams: number }
): Promise<PortionDto> => {
  const response = await authenticatedFetch("/food/portions", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    const text = await response.text();
    try {
      const parsed = JSON.parse(text) as { error?: string };
      throw new Error(parsed.error || `Failed to create portion (${response.status})`);
    } catch {
      throw new Error(text || `Failed to create portion (${response.status})`);
    }
  }

  return response.json();
};

export const fetchFrequentFoods = async (token: string, limit: number = 10): Promise<FoodItem[]> => {
  const response = await authenticatedFetch(`/food/frequent?limit=${limit}`, token, {
    method: "GET",
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    throw new Error(`Failed to fetch frequent foods (${response.status})`);
  }

  const items: BackendFoodItem[] = await response.json();
  return items
    .filter((item) => !item.name.toLowerCase().startsWith("quick fill "))
    .map((item) => ({
      id: item.id,
      name: item.name,
      brandOrPlace: item.brandOrPlace || undefined,
      calories: item.caloriesPer100g,
      protein: item.proteinPer100g,
      carbs: item.carbsPer100g,
      fats: item.fatsPer100g,
      source: item.source,
    }));
};

export const fetchFavoriteFoods = async (token: string, limit: number = 20): Promise<FoodItem[]> => {
  const response = await authenticatedFetch(`/food/favorites?limit=${limit}`, token, {
    method: "GET",
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    throw new Error(`Failed to fetch favorite foods (${response.status})`);
  }

  const items: BackendFoodItem[] = await response.json();
  return items
    .filter((item) => !item.name.toLowerCase().startsWith("quick fill "))
    .map((item) => ({
      id: item.id,
      name: item.name,
      brandOrPlace: item.brandOrPlace || undefined,
      calories: item.caloriesPer100g,
      protein: item.proteinPer100g,
      carbs: item.carbsPer100g,
      fats: item.fatsPer100g,
      source: item.source,
    }));
};

export const addFavoriteFood = async (token: string, foodId: number): Promise<void> => {
  const response = await authenticatedFetch(`/food/favorites/${foodId}`, token, {
    method: "POST",
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    throw new Error(`Failed to add favorite food (${response.status})`);
  }
};

export const removeFavoriteFood = async (token: string, foodId: number): Promise<void> => {
  const response = await authenticatedFetch(`/food/favorites/${foodId}`, token, {
    method: "DELETE",
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    throw new Error(`Failed to remove favorite food (${response.status})`);
  }
};
