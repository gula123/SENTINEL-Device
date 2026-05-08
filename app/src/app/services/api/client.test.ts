import { API_BASE_URL } from "../../config/env";
import { attemptSessionRefresh } from "../auth/authSessionBridge";
import { notifyAuthExpired } from "../auth/authEvents";
import { apiUrl, authenticatedFetch, getAuthHeaders, warmupBackend } from "./client";

jest.mock("../../config/env", () => ({
  API_BASE_URL: "https://api.test.local/api",
}));

jest.mock("../auth/authSessionBridge", () => ({
  attemptSessionRefresh: jest.fn(),
}));

jest.mock("../auth/authEvents", () => ({
  notifyAuthExpired: jest.fn().mockResolvedValue(undefined),
}));

describe("api client", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("builds auth headers and urls", () => {
    expect(getAuthHeaders()).toEqual({ "Content-Type": "application/json" });
    expect(getAuthHeaders("abc")).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer abc",
    });
    expect(apiUrl("health")).toBe(`${API_BASE_URL}/health`);
    expect(apiUrl("/health")).toBe(`${API_BASE_URL}/health`);
  });

  it("warmups backend health endpoint without throwing on failure", async () => {
    fetchMock.mockRejectedValue(new Error("cold-start"));

    expect(() => warmupBackend()).not.toThrow();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/health`);
  });

  it("retries once with refreshed token after 401", async () => {
    (attemptSessionRefresh as jest.Mock).mockResolvedValue("fresh-token");
    fetchMock
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const response = await authenticatedFetch("/secure", "old-token");

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${API_BASE_URL}/secure`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer fresh-token",
          "x-auth-retried": "true",
        }),
      })
    );
  });

  it("notifies auth expiry when refresh is unavailable", async () => {
    (attemptSessionRefresh as jest.Mock).mockResolvedValue(null);
    fetchMock.mockResolvedValue(new Response("unauthorized", { status: 401 }));

    const response = await authenticatedFetch("/secure", "old-token");

    expect(response.status).toBe(401);
    expect(notifyAuthExpired).toHaveBeenCalledTimes(1);
  });

  it("notifies auth expiry when unauthorized response has no retry path", async () => {
    fetchMock.mockResolvedValue(new Response("unauthorized", { status: 401 }));

    const response = await authenticatedFetch("/secure");

    expect(response.status).toBe(401);
    expect(attemptSessionRefresh).not.toHaveBeenCalled();
    expect(notifyAuthExpired).toHaveBeenCalledTimes(1);
  });
});
