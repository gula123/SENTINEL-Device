import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteRecipe, fetchMyRecipes, logRecipe } from "../services/food/recipesApi";
import { useAuth } from "../state/AuthContext";
import type { MealType } from "../services/food/foodLogsApi";
import dayjs from "dayjs";

export const useRecipes = () => {
  const { token } = useAuth();

  return useQuery({
    queryKey: ["recipes"],
    queryFn: async () => {
      if (!token) throw new Error("AUTH_REQUIRED");
      return fetchMyRecipes(token);
    },
    enabled: Boolean(token),
    staleTime: 60_000,
  });
};

export const useLogRecipe = (date: string) => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const yearMonth = dayjs(date).format("YYYY-MM");

  return useMutation({
    mutationFn: async ({ recipeId, grams, mealType }: { recipeId: number; grams: number; mealType: MealType }) => {
      if (!token) throw new Error("AUTH_REQUIRED");
      return logRecipe(token, { recipeId, grams, mealType, logDate: date });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["foodLogs", date] });
      queryClient.invalidateQueries({ queryKey: ["foodLogs", "month", yearMonth] });
    },
  });
};

export const useDeleteRecipe = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recipeId: number) => {
      if (!token) throw new Error("AUTH_REQUIRED");
      return deleteRecipe(token, recipeId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
};
