import { Platform } from "react-native";
import type { MobileSessionMetadata } from "./authApi";
import { storage } from "../storage/secureStorage";

const INSTALLATION_ID_KEY = "deviceInstallationId";

const createInstallationId = () => {
  const randomPart = Math.random().toString(36).slice(2);
  return `mobile-${Date.now().toString(36)}-${randomPart}`;
};

export const getInstallationId = async (): Promise<string> => {
  const existing = await storage.getItem(INSTALLATION_ID_KEY);
  if (existing) {
    return existing;
  }

  const created = createInstallationId();
  await storage.setItem(INSTALLATION_ID_KEY, created);
  return created;
};

export const getMobileSessionMetadata = async (): Promise<MobileSessionMetadata> => ({
  clientType: "MOBILE",
  deviceId: await getInstallationId(),
  deviceName: `${Platform.OS}-app`,
});