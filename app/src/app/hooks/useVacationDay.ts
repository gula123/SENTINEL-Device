import dayjs from "dayjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchVacationDayStatus, toggleVacationDay } from "../services/vacation/vacationApi";
import { useAuth } from "../state/AuthContext";

export const useVacationDay = (date: string, options?: { enabled?: boolean }) => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const enabled = options?.enabled ?? true;
  const yearMonth = dayjs(date).format("YYYY-MM");

  const statusQuery = useQuery({
    queryKey: ["vacationDay", date],
    queryFn: async () => {
      if (!token) {
        throw new Error("AUTH_REQUIRED");
      }
      return fetchVacationDayStatus(token, date);
    },
    enabled: Boolean(token) && enabled,
  });

  const toggleMutation = useMutation({
    mutationFn: async () => {
      if (!token) {
        throw new Error("AUTH_REQUIRED");
      }
      return toggleVacationDay(token, date);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["vacationDay", date] }),
        queryClient.invalidateQueries({ queryKey: ["nutritionSummary", date] }),
        queryClient.invalidateQueries({ queryKey: ["foodLogs", date] }),
        queryClient.invalidateQueries({ queryKey: ["diaryDay", date] }),
        queryClient.invalidateQueries({ queryKey: ["calendarData", yearMonth] }),
      ]);
    },
  });

  return {
    isVacationDay: statusQuery.data ?? false,
    isLoading: statusQuery.isLoading,
    isToggling: toggleMutation.isPending,
    toggle: toggleMutation.mutateAsync,
    refetch: statusQuery.refetch,
  };
};
