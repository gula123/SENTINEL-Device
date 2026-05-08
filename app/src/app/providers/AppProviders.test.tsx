import { PropsWithChildren } from "react";
import { Text } from "react-native";
import { render, waitFor } from "@testing-library/react-native";
import AppProviders from "./AppProviders";
import { setSessionRefreshHandler } from "../services/auth/authSessionBridge";
import { setAuthExpiredHandler } from "../services/auth/authEvents";
import { warmupBackend } from "../services/api/client";

const mockAuthState = {
  token: "token",
  refreshSession: jest.fn().mockResolvedValue("fresh"),
  signOut: jest.fn().mockResolvedValue(undefined),
};

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: PropsWithChildren) => <>{children}</>,
}));

jest.mock("../state/AuthContext", () => ({
  AuthProvider: ({ children }: PropsWithChildren) => <>{children}</>,
  useAuth: () => mockAuthState,
}));

jest.mock("../state/LanguageContext", () => ({
  LanguageProvider: ({ children }: PropsWithChildren) => <>{children}</>,
}));

jest.mock("../services/auth/authSessionBridge", () => ({
  setSessionRefreshHandler: jest.fn(),
}));

jest.mock("../services/auth/authEvents", () => ({
  isAuthExpiredError: jest.fn().mockReturnValue(false),
  notifyAuthExpired: jest.fn().mockResolvedValue(undefined),
  setAuthExpiredHandler: jest.fn(),
}));

jest.mock("../services/api/client", () => ({
  warmupBackend: jest.fn(),
}));

describe("AppProviders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("warms backend and registers auth/session bridge handlers", async () => {
    const { getByText, unmount } = render(
      <AppProviders>
        <Text>child</Text>
      </AppProviders>
    );

    expect(getByText("child")).toBeTruthy();

    await waitFor(() => {
      expect(warmupBackend).toHaveBeenCalledTimes(1);
      expect(setAuthExpiredHandler).toHaveBeenCalledWith(expect.any(Function));
      expect(setSessionRefreshHandler).toHaveBeenCalledWith(mockAuthState.refreshSession);
    });

    unmount();

    expect(setAuthExpiredHandler).toHaveBeenLastCalledWith(null);
    expect(setSessionRefreshHandler).toHaveBeenLastCalledWith(null);
  });
});
