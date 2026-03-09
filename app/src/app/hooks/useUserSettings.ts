import { useQuery } from "@tanstack/react-query";
import { fetchUserSettings } from "../services/settings/userSettingsApi";
import { useAuth } from "../state/AuthContext";

export const useUserSettings = () => {
  const { token } = useAuth();

  return useQuery({
    queryKey: ["userSettings"],
    queryFn: async () => {
      if (!token) {
        throw new Error("AUTH_REQUIRED");
      }
      return fetchUserSettings(token);
    },
    enabled: Boolean(token),
    staleTime: 60_000,
  });
};
