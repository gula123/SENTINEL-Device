import { PropsWithChildren, useEffect } from "react";
import { act, render, waitFor } from "@testing-library/react-native";
import { AuthProvider, useAuth } from "./AuthContext";
import { storage } from "../services/storage/secureStorage";
import { getMobileSessionMetadata } from "../services/auth/deviceSession";
import { logoutMobileSession, refreshMobileSession } from "../services/auth/authApi";
import { restoreBackendSessionSilently } from "../services/auth/nativeGoogleSession";
import { getTokenRemainingTime, isTokenExpired } from "../utils/tokenUtils";

jest.mock("../services/storage/secureStorage", () => ({
  storage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock("../services/auth/deviceSession", () => ({
  getMobileSessionMetadata: jest.fn(),
}));

jest.mock("../services/auth/authApi", () => ({
  refreshMobileSession: jest.fn(),
  logoutMobileSession: jest.fn(),
}));

jest.mock("../services/auth/nativeGoogleSession", () => ({
  restoreBackendSessionSilently: jest.fn(),
}));

jest.mock("../utils/tokenUtils", () => ({
  getTokenRemainingTime: jest.fn(),
  isTokenExpired: jest.fn(),
}));

type AuthSnapshot = ReturnType<typeof useAuth>;

function AuthProbe({ onState }: PropsWithChildren<{ onState: (state: AuthSnapshot) => void }>) {
  const state = useAuth();

  useEffect(() => {
    onState(state);
  }, [onState, state]);

  return null;
}

describe("AuthContext", () => {
  const storageMock = storage as jest.Mocked<typeof storage>;
  const metadataMock = getMobileSessionMetadata as jest.MockedFunction<typeof getMobileSessionMetadata>;
  const refreshMock = refreshMobileSession as jest.MockedFunction<typeof refreshMobileSession>;
  const logoutMock = logoutMobileSession as jest.MockedFunction<typeof logoutMobileSession>;
  const restoreMock = restoreBackendSessionSilently as jest.MockedFunction<typeof restoreBackendSessionSilently>;
  const isExpiredMock = isTokenExpired as jest.MockedFunction<typeof isTokenExpired>;
  const tokenRemainingMock = getTokenRemainingTime as jest.MockedFunction<typeof getTokenRemainingTime>;

  beforeEach(() => {
    jest.clearAllMocks();
    tokenRemainingMock.mockReturnValue(999);
    isExpiredMock.mockReturnValue(false);
    storageMock.getItem.mockResolvedValue(null);
    storageMock.setItem.mockResolvedValue();
    storageMock.removeItem.mockResolvedValue();
    restoreMock.mockResolvedValue(null);
    metadataMock.mockResolvedValue({ clientType: "MOBILE", deviceId: "device-1", deviceName: "Pixel" });
  });

  it("hydrates from secure storage when token is valid", async () => {
    const token = "token-a";
    const user = { userId: 10, email: "user@example.com", name: "User", profilePictureUrl: "avatar" };
    storageMock.getItem.mockImplementation(async (key: string) => {
      if (key === "authToken") return token;
      if (key === "authUser") return JSON.stringify(user);
      return null;
    });

    let latest: AuthSnapshot | null = null;
    render(
      <AuthProvider>
        <AuthProbe onState={(state) => (latest = state)} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(latest?.isHydrating).toBe(false);
      expect(latest?.isAuthenticated).toBe(true);
      expect(latest?.token).toBe(token);
      expect(latest?.user?.email).toBe(user.email);
    });
  });

  it("refreshes expired sessions with refresh token metadata", async () => {
    storageMock.getItem.mockImplementation(async (key: string) => {
      if (key === "authToken") return "expired-token";
      if (key === "authRefreshToken") return "refresh-token";
      return null;
    });
    isExpiredMock.mockReturnValue(true);
    refreshMock.mockResolvedValue({
      userId: 1,
      email: "new@example.com",
      name: "New",
      profilePictureUrl: "avatar",
      token: "fresh-token",
      refreshToken: "refresh-token-2",
      newUser: false,
    });

    let latest: AuthSnapshot | null = null;
    render(
      <AuthProvider>
        <AuthProbe onState={(state) => (latest = state)} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalledWith("refresh-token", { clientType: "MOBILE", deviceId: "device-1", deviceName: "Pixel" });
      expect(latest?.token).toBe("fresh-token");
      expect(latest?.user?.email).toBe("new@example.com");
      expect(latest?.isHydrating).toBe(false);
    });
  });

  it("signs out locally even if backend logout fails", async () => {
    storageMock.getItem.mockImplementation(async (key: string) => {
      if (key === "authToken") return "active-token";
      if (key === "authRefreshToken") return "refresh-token";
      return null;
    });
    logoutMock.mockRejectedValue(new Error("network down"));

    let latest: AuthSnapshot | null = null;
    render(
      <AuthProvider>
        <AuthProbe onState={(state) => (latest = state)} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(latest?.isHydrating).toBe(false);
    });

    await act(async () => {
      await latest?.signOut();
    });

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalledWith("refresh-token");
      expect(storageMock.removeItem).toHaveBeenCalledWith("authToken");
      expect(storageMock.removeItem).toHaveBeenCalledWith("authUser");
      expect(storageMock.removeItem).toHaveBeenCalledWith("authRefreshToken");
      expect(latest?.token).toBeNull();
      expect(latest?.isAuthenticated).toBe(false);
    });
  });
});
