import { useQuery } from "@tanstack/react-query";
import { fetchFavoriteFoods, type FoodItem } from "../services/food/foodLogsApi";
import { useAuth } from "../state/AuthContext";

export const useFavoriteFoods = (limit: number = 20, options?: { enabled?: boolean }) => {
  const { token } = useAuth();
  const enabled = (options?.enabled ?? true) && Boolean(token);

  return useQuery<FoodItem[]>({
    queryKey: ["favoriteFoods", limit],
    queryFn: async () => {
      if (!token) {
        throw new Error("AUTH_REQUIRED");
      }
      return fetchFavoriteFoods(token, limit);
    },
    enabled,
    staleTime: 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
};
