const loadEnvModule = (os: "web" | "android") => {
  jest.resetModules();
  jest.doMock("react-native", () => ({
    Platform: { OS: os },
  }));
  return require("./env") as typeof import("./env");
};

describe("env config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("uses configured API url after trimming trailing slash", () => {
    process.env.EXPO_PUBLIC_API_URL = "https://custom.api/";
    process.env.NODE_ENV = "development";
    const env = loadEnvModule("android");

    expect(env.API_BASE_URL).toBe("https://custom.api");
  });

  it("uses web localhost fallback in development when not configured", () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    process.env.NODE_ENV = "development";
    const env = loadEnvModule("web");

    expect(env.API_BASE_URL).toBe("http://localhost:8080/api");
  });

  it("uses production API fallback and oauth defaults", () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    process.env.NODE_ENV = "production";
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = "web-id";
    const env = loadEnvModule("android");

    expect(env.API_BASE_URL).toBe("https://api.gulasensei.hu/api");
    expect(env.GOOGLE_OAUTH.webClientId).toBe("web-id");
    expect(env.GOOGLE_OAUTH.androidClientId).toBe("");
  });
});
