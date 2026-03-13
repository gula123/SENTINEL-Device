import { API_BASE_URL } from "../../config/env";

export const warmupBackend = (): void => {
  fetch(`${API_BASE_URL}/health`).catch(() => {
    // fire-and-forget: response and errors are intentionally ignored.
    // The sole purpose of this call is to trigger a Cloud Run cold-start
    // so the BE is ready by the time the user authenticates.
  });
};

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
  });
};
