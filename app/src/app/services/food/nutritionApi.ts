import dayjs from "dayjs";
import { authenticatedFetch } from "../api/client";
import type { FoodLogDto } from "./foodLogsApi";

export interface NutritionSummary {
  caloriesConsumed: number;
  caloriesRemaining: number;
  carbs: number;
  protein: number;
  fats: number;
  carbsLimit: number;
  proteinLimit: number;
  fatsLimit: number;
}

export interface DiaryDayResponse {
  logs: FoodLogDto[];
  summary: NutritionSummary;
  vacation: boolean;
}

export const fetchNutritionSummary = async (
  token: string,
  date: string = dayjs().format("YYYY-MM-DD")
): Promise<NutritionSummary> => {
  const response = await authenticatedFetch(
    `/food/nutrition-summary?date=${date}`,
    token,
    {
      method: "GET",
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("AUTH_EXPIRED");
    }
    throw new Error(`Failed to fetch nutrition summary (${response.status})`);
  }

  return response.json();
};

export const fetchDiaryDay = async (
  token: string,
  date: string = dayjs().format("YYYY-MM-DD")
): Promise<DiaryDayResponse> => {
  const response = await authenticatedFetch(
    `/food/diary-day?date=${date}`,
    token,
    {
      method: "GET",
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("AUTH_EXPIRED");
    }
    throw new Error(`Failed to fetch diary day (${response.status})`);
  }

  return response.json();
};
