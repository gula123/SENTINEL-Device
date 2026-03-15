type AuthExpiredHandler = () => Promise<void> | void;

let authExpiredHandler: AuthExpiredHandler | null = null;
let authExpiryInFlight: Promise<void> | null = null;

export const AUTH_EXPIRED_ERROR = "AUTH_EXPIRED";

export const isAuthExpiredError = (error: unknown): boolean =>
  error instanceof Error && error.message === AUTH_EXPIRED_ERROR;

export const setAuthExpiredHandler = (handler: AuthExpiredHandler | null) => {
  authExpiredHandler = handler;
};

export const notifyAuthExpired = (): Promise<void> => {
  if (!authExpiredHandler) {
    return Promise.resolve();
  }

  if (!authExpiryInFlight) {
    authExpiryInFlight = Promise.resolve(authExpiredHandler()).finally(() => {
      authExpiryInFlight = null;
    });
  }

  return authExpiryInFlight;
};