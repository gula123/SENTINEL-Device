import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSavedMeal,
  deleteSavedMeal,
  fetchSavedMeals,
  logSavedMeal,
  reorderSavedMeals,
  updateSavedMeal,
  type SavedMealRequest,
} from "../services/food/savedMealsApi";
import { useAuth } from "../state/AuthContext";
import type { MealType } from "../services/food/foodLogsApi";
import dayjs from "dayjs";

export const useSavedMeals = () => {
  const { token } = useAuth();

  return useQuery({
    queryKey: ["savedMeals"],
    queryFn: async () => {
      if (!token) throw new Error("AUTH_REQUIRED");
      return fetchSavedMeals(token);
    },
    enabled: Boolean(token),
    staleTime: 60_000,
  });
};

export const useCreateSavedMeal = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: SavedMealRequest) => {
      if (!token) throw new Error("AUTH_REQUIRED");
      return createSavedMeal(token, request);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedMeals"] });
    },
  });
};

export const useUpdateSavedMeal = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mealId, request }: { mealId: number; request: SavedMealRequest }) => {
      if (!token) throw new Error("AUTH_REQUIRED");
      return updateSavedMeal(token, mealId, request);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedMeals"] });
    },
  });
};

export const useDeleteSavedMeal = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mealId: number) => {
      if (!token) throw new Error("AUTH_REQUIRED");
      return deleteSavedMeal(token, mealId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedMeals"] });
    },
  });
};

export const useLogSavedMeal = (date: string) => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const yearMonth = dayjs(date).format("YYYY-MM");

  return useMutation({
    mutationFn: async ({ mealId, mealType }: { mealId: number; mealType: MealType }) => {
      if (!token) throw new Error("AUTH_REQUIRED");
      return logSavedMeal(token, mealId, mealType, date);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["foodLogs", date] }),
        queryClient.invalidateQueries({ queryKey: ["nutritionSummary", date] }),
        queryClient.invalidateQueries({ queryKey: ["diaryDay", date] }),
        queryClient.invalidateQueries({ queryKey: ["calendarData", yearMonth] }),
      ]);
    },
  });
};

export const useReorderSavedMeals = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mealIds: number[]) => {
      if (!token) throw new Error("AUTH_REQUIRED");
      return reorderSavedMeals(token, mealIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedMeals"] });
    },
  });
};
