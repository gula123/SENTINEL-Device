import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";
import LoginScreen from "./LoginScreen";

const mockPromptAsync = jest.fn();
const mockSaveSession = jest.fn();
const mockConfigureNativeGoogleSignIn = jest.fn();
const mockGetNativeGoogleSignIn = jest.fn();

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock("expo-auth-session", () => ({
  ResponseType: {
    IdToken: "id_token",
  },
  makeRedirectUri: jest.fn().mockReturnValue("http://redirect"),
}));

jest.mock("expo-auth-session/providers/google", () => ({
  useAuthRequest: jest.fn(() => [{}, null, mockPromptAsync]),
}));

jest.mock("../../state/AuthContext", () => ({
  useAuth: () => ({
    saveSession: mockSaveSession,
  }),
}));

jest.mock("../../state/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("../../services/auth/authApi", () => ({
  loginWithGoogleToken: jest.fn(),
}));

jest.mock("../../services/auth/deviceSession", () => ({
  getMobileSessionMetadata: jest.fn(),
}));

jest.mock("../../services/auth/nativeGoogleSession", () => ({
  configureNativeGoogleSignIn: () => mockConfigureNativeGoogleSignIn(),
  getNativeGoogleSignIn: () => mockGetNativeGoogleSignIn(),
}));

describe("LoginScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, "OS", { value: "android" });
  });

  it("shows translated error when native Google module is unavailable", async () => {
    mockGetNativeGoogleSignIn.mockReturnValue(null);

    const { getByText } = render(<LoginScreen />);
    fireEvent.press(getByText("login.signInButton"));

    await waitFor(() => {
      expect(getByText("login.error")).toBeTruthy();
    });
    expect(mockSaveSession).not.toHaveBeenCalled();
  });
});
