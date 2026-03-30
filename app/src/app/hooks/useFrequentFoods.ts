import { useQuery } from "@tanstack/react-query";
import { fetchFrequentFoods, type FoodItem } from "../services/food/foodLogsApi";
import { useAuth } from "../state/AuthContext";

export const useFrequentFoods = (limit: number = 10, options?: { enabled?: boolean }) => {
  const { token } = useAuth();
  const enabled = (options?.enabled ?? true) && Boolean(token);

  return useQuery({
    queryKey: ["frequentFoods", limit],
    queryFn: async () => {
      if (!token) {
        throw new Error("AUTH_REQUIRED");
      }
      return fetchFrequentFoods(token, limit);
    },
    enabled,
    staleTime: 60_000, // 1 minute
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
};
