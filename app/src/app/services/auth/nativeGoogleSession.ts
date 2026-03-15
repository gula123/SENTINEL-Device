import { Platform } from "react-native";
import { GOOGLE_OAUTH } from "../../config/env";
import { getMobileSessionMetadata } from "./deviceSession";
import { loginWithGoogleToken, type BackendLoginResponse } from "./authApi";

let isConfigured = false;

const getNativeGoogleSigninModule = () => {
  if (Platform.OS === "web") {
    return null;
  }

  return require("@react-native-google-signin/google-signin");
};

export const configureNativeGoogleSignIn = () => {
  if (Platform.OS === "web" || isConfigured) {
    return;
  }

  const nativeModule = getNativeGoogleSigninModule();
  if (!nativeModule) {
    return;
  }

  nativeModule.GoogleSignin.configure({
    webClientId: GOOGLE_OAUTH.webClientId,
    offlineAccess: false,
  });
  isConfigured = true;
};

export const getNativeGoogleSignIn = () => getNativeGoogleSigninModule();

export const restoreBackendSessionSilently = async (): Promise<BackendLoginResponse | null> => {
  if (Platform.OS === "web") {
    return null;
  }

  configureNativeGoogleSignIn();

  const nativeModule = getNativeGoogleSigninModule();
  if (!nativeModule) {
    return null;
  }

  const { GoogleSignin } = nativeModule;

  try {
    const hasPreviousSignIn =
      typeof GoogleSignin.hasPreviousSignIn === "function"
        ? GoogleSignin.hasPreviousSignIn()
        : true;

    if (!hasPreviousSignIn) {
      return null;
    }

    await GoogleSignin.signInSilently();
    const tokens = await GoogleSignin.getTokens();
    if (!tokens.idToken) {
      return null;
    }

    return loginWithGoogleToken(tokens.idToken, await getMobileSessionMetadata());
  } catch {
    return null;
  }
};