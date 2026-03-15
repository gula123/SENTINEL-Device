import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  fetchTodayWeight,
  fetchWeightHistory,
  fetchWeightStats,
  getWeightHistoryRange,
  saveWeight,
} from "../services/weight/weightApi";
import { useAuth } from "../state/AuthContext";

export const useWeightDiary = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const range = useMemo(() => getWeightHistoryRange(), []);

  const todayQuery = useQuery({
    queryKey: ["weightToday"],
    queryFn: async () => {
      if (!token) throw new Error("AUTH_REQUIRED");
      return fetchTodayWeight(token);
    },
    enabled: Boolean(token),
    staleTime: 30_000,
  });

  const historyQuery = useQuery({
    queryKey: ["weightHistory", range.startDate, range.endDate],
    queryFn: async () => {
      if (!token) throw new Error("AUTH_REQUIRED");
      return fetchWeightHistory(token, range.startDate, range.endDate);
    },
    enabled: Boolean(token),
    staleTime: 5 * 60_000,
  });

  const statsQuery = useQuery({
    queryKey: ["weightStats"],
    queryFn: async () => {
      if (!token) throw new Error("AUTH_REQUIRED");
      return fetchWeightStats(token);
    },
    enabled: Boolean(token),
    staleTime: 5 * 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: async (weight: number) => {
      if (!token) throw new Error("AUTH_REQUIRED");
      return saveWeight(token, weight);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["weightToday"] }),
        queryClient.invalidateQueries({ queryKey: ["weightHistory"] }),
        queryClient.invalidateQueries({ queryKey: ["weightStats"] }),
      ]);
    },
  });

  return {
    todayQuery,
    historyQuery,
    statsQuery,
    saveWeightMutation: saveMutation,
  };
};
