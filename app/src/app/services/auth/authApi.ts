import { apiUrl } from "../api/client";

export interface BackendLoginResponse {
  userId: number;
  email: string;
  name: string;
  profilePictureUrl: string;
  token: string;
  refreshToken?: string;
  accessTokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
  newUser: boolean;
}

export interface MobileSessionMetadata {
  clientType: "MOBILE";
  deviceId: string;
  deviceName: string;
}

export const loginWithGoogleToken = async (
  googleToken: string,
  sessionMetadata?: MobileSessionMetadata
): Promise<BackendLoginResponse> => {
  const loginUrl = apiUrl("/auth/google-login");
  const response = await fetch(loginUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ googleToken, ...sessionMetadata }),
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    if (contentType.includes("text/html")) {
      throw new Error(`Login endpoint returned HTML (not backend JSON): ${loginUrl}`);
    }
    throw new Error(text || "Google login failed");
  }

  return response.json();
};

export const refreshMobileSession = async (refreshToken: string, sessionMetadata: MobileSessionMetadata): Promise<BackendLoginResponse> => {
  const response = await fetch(apiUrl("/auth/refresh"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken, deviceId: sessionMetadata.deviceId, deviceName: sessionMetadata.deviceName }),
  });

  if (!response.ok) {
    throw new Error(response.status === 401 ? "AUTH_EXPIRED" : "REFRESH_FAILED");
  }

  return response.json();
};

export const logoutMobileSession = async (refreshToken: string): Promise<void> => {
  await fetch(apiUrl("/auth/logout"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken }),
  });
};
