const loginWithGoogleToken = jest.fn();
const getMobileSessionMetadata = jest.fn();

const loadModule = (os: "web" | "android", nativeModule?: Record<string, unknown>) => {
  jest.resetModules();
  jest.doMock("react-native", () => ({
    Platform: { OS: os },
  }));
  jest.doMock("../../config/env", () => ({
    GOOGLE_OAUTH: {
      webClientId: "web-client-id",
    },
  }));
  jest.doMock("./authApi", () => ({
    loginWithGoogleToken,
  }));
  jest.doMock("./deviceSession", () => ({
    getMobileSessionMetadata,
  }));

  if (nativeModule) {
    jest.doMock("@react-native-google-signin/google-signin", () => nativeModule, { virtual: true });
  }

  return require("./nativeGoogleSession") as typeof import("./nativeGoogleSession");
};

describe("nativeGoogleSession", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("skips native configure on web", () => {
    const module = loadModule("web");
    expect(() => module.configureNativeGoogleSignIn()).not.toThrow();
    expect(module.getNativeGoogleSignIn()).toBeNull();
  });

  it("configures native google sign in only once", () => {
    const configure = jest.fn();
    const module = loadModule("android", {
      GoogleSignin: {
        configure,
      },
    });

    module.configureNativeGoogleSignIn();
    module.configureNativeGoogleSignIn();

    expect(configure).toHaveBeenCalledTimes(1);
    expect(configure).toHaveBeenCalledWith({
      webClientId: "web-client-id",
      offlineAccess: false,
    });
  });

  it("returns null when native module cannot be loaded", async () => {
    const module = loadModule("android");
    await expect(module.restoreBackendSessionSilently()).resolves.toBeNull();
  });

  it("returns null when previous sign-in is not available", async () => {
    const module = loadModule("android", {
      GoogleSignin: {
        configure: jest.fn(),
        hasPreviousSignIn: jest.fn().mockReturnValue(false),
      },
    });

    await expect(module.restoreBackendSessionSilently()).resolves.toBeNull();
  });

  it("restores backend session silently when native sign-in token exists", async () => {
    const nativeModule = {
      GoogleSignin: {
        configure: jest.fn(),
        hasPreviousSignIn: jest.fn().mockReturnValue(true),
        signInSilently: jest.fn().mockResolvedValue(undefined),
        getTokens: jest.fn().mockResolvedValue({ idToken: "google-token" }),
      },
    };
    const module = loadModule("android", nativeModule);
    getMobileSessionMetadata.mockResolvedValue({ clientType: "MOBILE", deviceId: "d1", deviceName: "phone" });
    loginWithGoogleToken.mockResolvedValue({ token: "backend-token" });

    const result = await module.restoreBackendSessionSilently();

    expect(loginWithGoogleToken).toHaveBeenCalledWith("google-token", {
      clientType: "MOBILE",
      deviceId: "d1",
      deviceName: "phone",
    });
    expect(result).toEqual({ token: "backend-token" });
  });

  it("returns null when silent sign-in does not yield id token", async () => {
    const module = loadModule("android", {
      GoogleSignin: {
        configure: jest.fn(),
        hasPreviousSignIn: jest.fn().mockReturnValue(true),
        signInSilently: jest.fn().mockResolvedValue(undefined),
        getTokens: jest.fn().mockResolvedValue({}),
      },
    });

    await expect(module.restoreBackendSessionSilently()).resolves.toBeNull();
  });

  it("returns null when native sign-in throws", async () => {
    const module = loadModule("android", {
      GoogleSignin: {
        configure: jest.fn(),
        hasPreviousSignIn: jest.fn().mockReturnValue(true),
        signInSilently: jest.fn().mockRejectedValue(new Error("failure")),
      },
    });

    await expect(module.restoreBackendSessionSilently()).resolves.toBeNull();
  });
});
