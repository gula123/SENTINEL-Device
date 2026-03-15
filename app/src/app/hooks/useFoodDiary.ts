import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addFoodLog, deleteFoodLog, fetchFoodLogs, MealType, updateFoodLogGrams } from "../services/food/foodLogsApi";
import { useAuth } from "../state/AuthContext";

export const useFoodLogs = (date: string, options?: { enabled?: boolean }) => {
  const { token } = useAuth();
  const enabled = options?.enabled ?? true;

  return useQuery({
    queryKey: ["foodLogs", date],
    queryFn: async () => {
      if (!token) {
        throw new Error("AUTH_REQUIRED");
      }
      return fetchFoodLogs(token, date);
    },
    enabled: Boolean(token) && enabled,
  });
};

export const useAddFoodLog = (date: string) => {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      foodName: string;
      foodId?: number;
      grams: number;
      mealType: MealType;
      calories?: number;
      protein?: number;
      carbs?: number;
      fats?: number;
    }) => {
      if (!token) {
        throw new Error("AUTH_REQUIRED");
      }
      return addFoodLog(token, { ...payload, logDate: date });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["foodLogs", date] }),
        queryClient.invalidateQueries({ queryKey: ["nutritionSummary", date] }),
      ]);
    },
  });
};

export const useUpdateFoodLog = (date: string) => {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ logId, grams }: { logId: number; grams: number }) => {
      if (!token) {
        throw new Error("AUTH_REQUIRED");
      }
      return updateFoodLogGrams(token, logId, grams);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["foodLogs", date] }),
        queryClient.invalidateQueries({ queryKey: ["nutritionSummary", date] }),
      ]);
    },
  });
};

export const useDeleteFoodLog = (date: string) => {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (logId: number) => {
      if (!token) {
        throw new Error("AUTH_REQUIRED");
      }
      return deleteFoodLog(token, logId);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["foodLogs", date] }),
        queryClient.invalidateQueries({ queryKey: ["nutritionSummary", date] }),
      ]);
    },
  });
};
