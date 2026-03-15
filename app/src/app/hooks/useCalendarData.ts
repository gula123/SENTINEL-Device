import { useQuery } from "@tanstack/react-query";
import { fetchCalendarData } from "../services/dashboard/dashboardApi";
import { useAuth } from "../state/AuthContext";

export const useCalendarData = (yearMonth: string) => {
  const { token } = useAuth();

  return useQuery({
    queryKey: ["calendarData", yearMonth],
    queryFn: async () => {
      if (!token) {
        throw new Error("AUTH_REQUIRED");
      }
      return fetchCalendarData(token, yearMonth);
    },
    enabled: Boolean(token),
    staleTime: 5 * 60_000,
  });
};
