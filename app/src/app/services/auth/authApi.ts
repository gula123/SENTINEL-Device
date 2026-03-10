import { apiUrl } from "../api/client";

export interface BackendLoginResponse {
  userId: number;
  email: string;
  name: string;
  profilePictureUrl: string;
  token: string;
  newUser: boolean;
}

export const loginWithGoogleToken = async (googleToken: string): Promise<BackendLoginResponse> => {
  const loginUrl = apiUrl("/auth/google-login");
  const response = await fetch(loginUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ googleToken }),
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
