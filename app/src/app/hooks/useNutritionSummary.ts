import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { fetchNutritionSummary } from "../services/food/nutritionApi";
import { useAuth } from "../state/AuthContext";

export const useNutritionSummary = (date?: string) => {
  const { token } = useAuth();
  const resolvedDate = date || dayjs().format("YYYY-MM-DD");

  return useQuery({
    queryKey: ["nutritionSummary", resolvedDate],
    queryFn: async () => {
      if (!token) {
        throw new Error("AUTH_REQUIRED");
      }
      return fetchNutritionSummary(token, resolvedDate);
    },
    enabled: Boolean(token),
  });
};
