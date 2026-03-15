import { MutationCache, QueryCache, QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { PropsWithChildren, useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setSessionRefreshHandler } from "../services/auth/authSessionBridge";
import { isAuthExpiredError, notifyAuthExpired, setAuthExpiredHandler } from "../services/auth/authEvents";
import { AuthProvider, useAuth } from "../state/AuthContext";

function AuthSessionBridge({ children }: PropsWithChildren) {
  const { refreshSession, signOut, token } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleAuthExpired = async () => {
      await signOut();
    };

    setAuthExpiredHandler(handleAuthExpired);

    return () => {
      setAuthExpiredHandler(null);
    };
  }, [signOut]);

  useEffect(() => {
    setSessionRefreshHandler(refreshSession);

    return () => {
      setSessionRefreshHandler(null);
    };
  }, [refreshSession]);

  useEffect(() => {
    if (!token) {
      queryClient.clear();
    }
  }, [queryClient, token]);

  return <>{children}</>;
}

export default function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => {
            if (isAuthExpiredError(error)) {
              void notifyAuthExpired();
            }
          },
        }),
        mutationCache: new MutationCache({
          onError: (error) => {
            if (isAuthExpiredError(error)) {
              void notifyAuthExpired();
            }
          },
        }),
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,
          },
        },
      })
  );

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <AuthSessionBridge>{children}</AuthSessionBridge>
        </QueryClientProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
