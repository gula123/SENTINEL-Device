import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { fetchDiaryDay } from "../services/food/nutritionApi";
import { useAuth } from "../state/AuthContext";

export const useDiaryDay = (date?: string, options?: { enabled?: boolean }) => {
  const { token } = useAuth();
  const resolvedDate = date || dayjs().format("YYYY-MM-DD");
  const enabled = options?.enabled ?? true;

  return useQuery({
    queryKey: ["diaryDay", resolvedDate],
    queryFn: async () => {
      if (!token) {
        throw new Error("AUTH_REQUIRED");
      }
      return fetchDiaryDay(token, resolvedDate);
    },
    enabled: Boolean(token) && enabled,
    staleTime: 30_000,
  });
};