import { authenticatedFetch } from "../api/client";

export interface CalendarData {
  activeDays: number[];
  greenDays: number[];
  redDays: number[];
  vacationDays?: number[];
  daysMissedTarget: number;
  streak: number;
  dailyCalories?: Record<number, { consumed: number; limit: number }>;
}

export const fetchCalendarData = async (token: string, yearMonth: string): Promise<CalendarData> => {
  const response = await authenticatedFetch(`/calendar-data?yearMonth=${yearMonth}`, token, {
    method: "GET",
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    throw new Error(`Failed to fetch calendar data (${response.status})`);
  }

  return response.json();
};
