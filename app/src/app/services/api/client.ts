import { API_BASE_URL } from "../../config/env";
import { attemptSessionRefresh } from "../auth/authSessionBridge";
import { notifyAuthExpired } from "../auth/authEvents";

export const getAuthHeaders = (token?: string): Record<string, string> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

export const apiUrl = (path: string): string => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
};

export const authenticatedFetch = (
  path: string,
  token?: string,
  init?: RequestInit
): Promise<Response> => {
  const headers = {
    ...getAuthHeaders(token),
    ...(init?.headers || {}),
  };

  return fetch(apiUrl(path), {
    ...init,
    headers,
  }).then(async (response) => {
    if (response.status !== 401 || !token || (init?.headers && (init.headers as Record<string, string>)["x-auth-retried"] === "true")) {
      if (response.status === 401) {
        void notifyAuthExpired();
      }
      return response;
    }

    const refreshedToken = await attemptSessionRefresh();
    if (!refreshedToken) {
      void notifyAuthExpired();
      return response;
    }

    return fetch(apiUrl(path), {
      ...init,
      headers: {
        ...getAuthHeaders(refreshedToken),
        ...(init?.headers || {}),
        "x-auth-retried": "true",
      },
    });
  });
};
