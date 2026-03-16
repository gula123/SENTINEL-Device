import { authenticatedFetch } from "../api/client";

interface ApiResponse<T> {
  data?: T;
  message?: string;
}

export interface Goal {
  id: number;
  goalType: "DAILY" | "DAYS_PER_WEEK" | "DAYS_PER_MONTH";
  targetDays: number;
}

export interface Habit {
  id: number;
  userId: string;
  habitName: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  goal?: Goal;
}

export interface HabitLog {
  id: number;
  habitId: number;
  logDate: string;
  completed: boolean;
  createdAt?: string;
  notes?: string;
}

export interface HabitMetrics {
  habitScore: number;
  monthlySuccess: number;
  yearlySuccess: number;
  goalBasedSuccess: number;
}

export interface DailyHabitMetric {
  habitId: number;
  logDate: string;
  completed: boolean;
}

export interface HistoricalHabitScore {
  month: string;
  score: number;
}

export interface MonthlyHabitStat {
  month: string;
  completedDays: number;
}

const unwrapPayload = <T>(payload: ApiResponse<T> | T): T => {
  if (payload && typeof payload === "object" && "data" in (payload as ApiResponse<T>)) {
    return ((payload as ApiResponse<T>).data ?? payload) as T;
  }

  return payload as T;
};

const getErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as ApiResponse<unknown> & { error?: string };
    return payload.message || payload.error || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
};

const requestJson = async <T>(path: string, token: string, init?: RequestInit): Promise<T> => {
  const response = await authenticatedFetch(path, token, init);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("AUTH_EXPIRED");
    }
    throw new Error(await getErrorMessage(response));
  }

  return unwrapPayload<T>((await response.json()) as ApiResponse<T> | T);
};

const requestVoid = async (path: string, token: string, init?: RequestInit): Promise<void> => {
  const response = await authenticatedFetch(path, token, init);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("AUTH_EXPIRED");
    }
    throw new Error(await getErrorMessage(response));
  }
};

export const fetchHabits = async (token: string): Promise<Habit[]> =>
  requestJson<Habit[]>("/habits", token, { method: "GET" });

export const createHabit = async (
  token: string,
  habitName: string,
  description: string
): Promise<Habit> =>
  requestJson<Habit>("/habits", token, {
    method: "POST",
    body: JSON.stringify({ habitName, description }),
  });

export const updateHabit = async (
  token: string,
  habitId: number,
  habitName: string,
  description: string
): Promise<Habit> =>
  requestJson<Habit>(`/habits/${habitId}`, token, {
    method: "PUT",
    body: JSON.stringify({ habitName, description }),
  });

export const deleteHabit = async (token: string, habitId: number): Promise<void> =>
  requestVoid(`/habits/${habitId}`, token, { method: "DELETE" });

export const logHabit = async (
  token: string,
  habitId: number,
  logDate: string,
  completed: boolean
): Promise<HabitLog> =>
  requestJson<HabitLog>(`/habits/${habitId}/log`, token, {
    method: "POST",
    body: JSON.stringify({ logDate, completed }),
  });

export const getHabitLogs = async (
  token: string,
  habitId: number,
  startDate?: string,
  endDate?: string,
  limit?: number,
  offset?: number
): Promise<HabitLog[]> => {
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  if (limit != null) params.append("limit", String(limit));
  if (offset != null) params.append("offset", String(offset));
  const query = params.toString();

  return requestJson<HabitLog[]>(`/habits/${habitId}/logs${query ? `?${query}` : ""}`, token, {
    method: "GET",
  });
};

export const getHabitMetricsBatch = async (
  token: string,
  habitIds: number[]
): Promise<Record<number, HabitMetrics>> =>
  requestJson<Record<number, HabitMetrics>>("/v1/habits/metrics/batch", token, {
    method: "POST",
    body: JSON.stringify({ habitIds }),
  });

export const getHabitLogsBatch = async (
  token: string,
  habitIds: number[],
  startDate: string,
  endDate: string
): Promise<DailyHabitMetric[]> =>
  requestJson<DailyHabitMetric[]>("/v1/habits/logs/batch", token, {
    method: "POST",
    body: JSON.stringify({ habitIds, startDate, endDate }),
  });

export const getHabitMetrics = async (token: string, habitId: number): Promise<HabitMetrics> =>
  requestJson<HabitMetrics>(`/habits/${habitId}/metrics`, token, { method: "GET" });

export const setGoal = async (
  token: string,
  habitId: number,
  goalType: Goal["goalType"],
  targetDays: number
): Promise<Goal> =>
  requestJson<Goal>(`/habits/${habitId}/goal`, token, {
    method: "POST",
    body: JSON.stringify({ goalType, targetDays }),
  });

export const deleteGoal = async (token: string, habitId: number): Promise<void> =>
  requestVoid(`/habits/${habitId}/goal`, token, { method: "DELETE" });

export const getHabitHistoricalScores = async (
  token: string,
  habitId: number,
  months: number = 12
): Promise<HistoricalHabitScore[]> =>
  requestJson<HistoricalHabitScore[]>(`/habits/${habitId}/historical-scores?months=${months}`, token, {
    method: "GET",
  });

export const getHabitMonthlyStats = async (
  token: string,
  habitId: number,
  months: number = 12
): Promise<MonthlyHabitStat[]> =>
  requestJson<MonthlyHabitStat[]>(`/habits/${habitId}/monthly-stats?months=${months}`, token, {
    method: "GET",
  });