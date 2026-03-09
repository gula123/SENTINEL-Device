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
  const response = await fetch(apiUrl("/auth/google-login"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ googleToken }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Google login failed");
  }

  return response.json();
};
