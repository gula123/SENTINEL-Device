import { jwtDecode } from "jwt-decode";

interface JwtPayload {
  exp?: number;
}

const EXPIRY_BUFFER_SECONDS = 60;

const decodeToken = (token: string): JwtPayload | null => {
  try {
    return jwtDecode<JwtPayload>(token);
  } catch {
    return null;
  }
};

export const getTokenRemainingTime = (token: string | null): number => {
  if (!token) {
    return 0;
  }

  const payload = decodeToken(token);
  if (!payload?.exp) {
    return 0;
  }

  return Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
};

export const isTokenExpired = (token: string | null, bufferSeconds: number = EXPIRY_BUFFER_SECONDS): boolean => {
  if (!token) {
    return true;
  }

  const payload = decodeToken(token);
  if (!payload?.exp) {
    return true;
  }

  return Math.floor(Date.now() / 1000) + bufferSeconds >= payload.exp;
};