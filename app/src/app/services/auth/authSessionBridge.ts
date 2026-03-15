type RefreshHandler = () => Promise<string | null>;

let refreshHandler: RefreshHandler | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export const setSessionRefreshHandler = (handler: RefreshHandler | null) => {
  refreshHandler = handler;
};

export const attemptSessionRefresh = (): Promise<string | null> => {
  if (!refreshHandler) {
    return Promise.resolve(null);
  }

  if (!refreshInFlight) {
    refreshInFlight = Promise.resolve(refreshHandler()).finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
};