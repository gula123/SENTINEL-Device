const LOCAL_ANDROID_EMULATOR_API = "http://10.0.2.2:8080/api";
const LOCAL_DEVICE_API = "http://localhost:8080/api";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "development" ? LOCAL_ANDROID_EMULATOR_API : LOCAL_DEVICE_API);

export const GOOGLE_OAUTH = {
  expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID || "",
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "",
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "",
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "",
};
