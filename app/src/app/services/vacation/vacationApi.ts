import { authenticatedFetch } from "../api/client";

interface VacationStatusResponse {
  date: string;
  vacation: boolean;
  vacationDays?: string[];
}

export const fetchVacationDayStatus = async (token: string, date: string): Promise<boolean> => {
  const response = await authenticatedFetch(`/vacation-day?date=${date}`, token, { method: "GET" });
  if (!response.ok) {
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    throw new Error(`Failed to fetch vacation day (${response.status})`);
  }

  const data: VacationStatusResponse = await response.json();
  return data.vacation;
};

export const toggleVacationDay = async (token: string, date: string): Promise<boolean> => {
  const response = await authenticatedFetch("/vacation-day/toggle", token, {
    method: "POST",
    body: JSON.stringify({ date }),
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    throw new Error(`Failed to toggle vacation day (${response.status})`);
  }

  const data: VacationStatusResponse = await response.json();
  return data.vacation;
};
