import { Platform } from "react-native";

const LOCAL_ANDROID_EMULATOR_API = "http://10.0.2.2:8080/api";
const LOCAL_WEB_API = "http://localhost:8080/api";
const PROD_API = "https://api.gulasensei.hu/api";

const configuredApi = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "") || "";

const fallbackApi =
  process.env.NODE_ENV === "development"
    ? (Platform.OS === "web" ? LOCAL_WEB_API : LOCAL_ANDROID_EMULATOR_API)
    : PROD_API;

export const API_BASE_URL =
  configuredApi || fallbackApi;

export const GOOGLE_OAUTH = {
  expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID || "",
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "",
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "",
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "",
};
