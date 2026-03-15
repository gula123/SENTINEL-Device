import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchDashboardMetrics,
  getDashboardDateRange,
} from "../services/dashboard/metricsApi";
import { useAuth } from "../state/AuthContext";

export const useMetrics = () => {
  const { token } = useAuth();
  const range = useMemo(() => getDashboardDateRange(), []);

  return useQuery({
    queryKey: ["dashboardMetrics", range.startDate, range.endDate],
    queryFn: async () => {
      if (!token) throw new Error("AUTH_REQUIRED");
      return fetchDashboardMetrics(token, range.startDate, range.endDate);
    },
    enabled: Boolean(token),
    staleTime: 5 * 60_000,
  });
};
