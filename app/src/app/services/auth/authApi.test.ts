import { apiUrl } from "../api/client";
import { loginWithGoogleToken, logoutMobileSession, refreshMobileSession } from "./authApi";

jest.mock("../api/client", () => ({
  apiUrl: jest.fn((path: string) => `https://api.test.local${path}`),
}));

describe("authApi", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("logs in with Google token and session metadata", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ token: "token", userId: 1 }),
    });

    const response = await loginWithGoogleToken("google-id-token", {
      clientType: "MOBILE",
      deviceId: "device-a",
      deviceName: "Pixel",
    });

    expect(apiUrl).toHaveBeenCalledWith("/auth/google-login");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test.local/auth/google-login",
      expect.objectContaining({
        method: "POST",
      })
    );
    expect(response.token).toBe("token");
  });

  it("throws helpful error when login endpoint returns html", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      headers: {
        get: jest.fn().mockReturnValue("text/html"),
      },
      text: jest.fn().mockResolvedValue("<html>error</html>"),
    });

    await expect(loginWithGoogleToken("google-id-token")).rejects.toThrow(
      "Login endpoint returned HTML (not backend JSON): https://api.test.local/auth/google-login"
    );
  });

  it("throws default login failure when backend returns empty non-html response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      headers: {
        get: jest.fn().mockReturnValue("application/json"),
      },
      text: jest.fn().mockResolvedValue(""),
    });

    await expect(loginWithGoogleToken("google-id-token")).rejects.toThrow("Google login failed");
  });

  it("throws explicit auth-expired on refresh 401", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
    });

    await expect(
      refreshMobileSession("refresh", {
        clientType: "MOBILE",
        deviceId: "device-a",
        deviceName: "Pixel",
      })
    ).rejects.toThrow("AUTH_EXPIRED");
  });

  it("returns refreshed session payload when refresh succeeds", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ token: "refreshed" }),
    });

    const result = await refreshMobileSession("refresh", {
      clientType: "MOBILE",
      deviceId: "device-a",
      deviceName: "Pixel",
    });

    expect(result).toEqual({ token: "refreshed" });
  });

  it("sends logout refresh token payload", async () => {
    fetchMock.mockResolvedValue({ ok: true });

    await logoutMobileSession("refresh-a");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test.local/auth/logout",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refreshToken: "refresh-a" }),
      })
    );
  });
});
