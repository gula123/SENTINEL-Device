import dayjs from "dayjs";
import { authenticatedFetch } from "../api/client";

export interface DashboardFoodLog {
  logDate: string;
  calories: number;
  carbs: number;
  protein: number;
  fats: number;
  mealType?: string;
}

export interface DashboardHabitLog {
  logDate: string;
  completed: boolean;
}

interface RawWeightLog {
  weight: number;
  measurementDate: string | [number, number, number];
}

export interface DashboardWeightLog {
  weight: number;
  measurementDate: string;
}

export interface DashboardUserSettings {
  dailyCalorieLimit?: number;
  dailyCarbsLimit?: number;
  dailyProteinLimit?: number;
  dailyFatsLimit?: number;
  perDayCalorieLimits?: string;
}

export interface DashboardMetricsPayload {
  foodLogs: DashboardFoodLog[];
  habitLogs: DashboardHabitLog[];
  weightLogs: DashboardWeightLog[];
  userSettings?: DashboardUserSettings;
}

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
}

const normalizeMeasurementDate = (value: RawWeightLog["measurementDate"]): string => {
  if (Array.isArray(value) && value.length === 3) {
    const [year, month, day] = value;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return String(value);
};

export const getDashboardDateRange = () => {
  const endDate = dayjs().format("YYYY-MM-DD");
  const startDate = dayjs().subtract(365, "days").format("YYYY-MM-DD");
  return { startDate, endDate };
};

export const fetchDashboardMetrics = async (
  token: string,
  startDate: string,
  endDate: string,
  limit: number = 5000,
  offset: number = 0
): Promise<DashboardMetricsPayload> => {
  const response = await authenticatedFetch(
    `/v1/dashboard/metrics?startDate=${startDate}&endDate=${endDate}&limit=${limit}&offset=${offset}`,
    token,
    { method: "GET" }
  );

  if (!response.ok) {
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    throw new Error(`Failed to fetch dashboard metrics (${response.status})`);
  }

  const raw = (await response.json()) as ApiResponse<DashboardMetricsPayload> | DashboardMetricsPayload;
  const payload = (raw as ApiResponse<DashboardMetricsPayload>).data ?? (raw as DashboardMetricsPayload);

  const normalizedWeightLogs = (payload.weightLogs || []).map((log) => ({
    weight: Number(log.weight) || 0,
    measurementDate: normalizeMeasurementDate((log as RawWeightLog).measurementDate),
  }));

  return {
    foodLogs: (payload.foodLogs || []).map((log) => ({
      logDate: log.logDate,
      calories: Number(log.calories) || 0,
      carbs: Number(log.carbs) || 0,
      protein: Number(log.protein) || 0,
      fats: Number(log.fats) || 0,
      mealType: log.mealType,
    })),
    habitLogs: (payload.habitLogs || []).map((log) => ({
      logDate: log.logDate,
      completed: Boolean(log.completed),
    })),
    weightLogs: normalizedWeightLogs,
    userSettings: payload.userSettings,
  };
};
