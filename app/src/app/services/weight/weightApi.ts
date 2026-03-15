import dayjs from "dayjs";
import { authenticatedFetch } from "../api/client";

export interface WeightLogDto {
  id?: number;
  userId?: number;
  weight: number;
  measurementDate: string;
}

export interface WeightStats {
  totalWeightLost: number;
  averageMonthlyLoss: number;
  targetWeight: number | null;
  currentWeight: number | null;
  estimatedMonthsToTarget: number | null;
  estimatedTargetDate: string | null;
}

interface RawWeightLog {
  id?: number;
  userId?: number;
  weight: number;
  measurementDate: string | [number, number, number];
}

const normalizeMeasurementDate = (value: RawWeightLog["measurementDate"]): string => {
  if (Array.isArray(value) && value.length === 3) {
    const [year, month, day] = value;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return String(value);
};

const normalizeWeightLog = (raw: RawWeightLog): WeightLogDto => ({
  id: raw.id,
  userId: raw.userId,
  weight: raw.weight,
  measurementDate: normalizeMeasurementDate(raw.measurementDate),
});

export const fetchTodayWeight = async (token: string): Promise<WeightLogDto | null> => {
  const response = await authenticatedFetch("/weight/today", token, { method: "GET" });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    throw new Error(`Failed to fetch today's weight (${response.status})`);
  }

  const raw = (await response.json()) as RawWeightLog;
  return normalizeWeightLog(raw);
};

export const fetchWeightHistory = async (
  token: string,
  startDate: string,
  endDate: string
): Promise<WeightLogDto[]> => {
  const response = await authenticatedFetch(
    `/weight/history?startDate=${startDate}&endDate=${endDate}`,
    token,
    { method: "GET" }
  );

  if (!response.ok) {
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    throw new Error(`Failed to fetch weight history (${response.status})`);
  }

  const raw = (await response.json()) as RawWeightLog[];
  return (raw || []).map(normalizeWeightLog);
};

export const fetchWeightStats = async (token: string): Promise<WeightStats> => {
  const response = await authenticatedFetch("/weight/stats", token, { method: "GET" });

  if (!response.ok) {
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    throw new Error(`Failed to fetch weight stats (${response.status})`);
  }

  return response.json();
};

export const saveWeight = async (token: string, weight: number): Promise<WeightLogDto> => {
  const response = await authenticatedFetch("/weight", token, {
    method: "POST",
    body: JSON.stringify({ weight }),
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    throw new Error(`Failed to save weight (${response.status})`);
  }

  const raw = (await response.json()) as RawWeightLog;
  return normalizeWeightLog(raw);
};

export const getWeightHistoryRange = () => {
  const endDate = dayjs().format("YYYY-MM-DD");
  const startDate = dayjs().subtract(2, "years").format("YYYY-MM-DD");
  return { startDate, endDate };
};
