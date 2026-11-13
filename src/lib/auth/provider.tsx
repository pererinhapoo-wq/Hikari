import { type ReactNode, lazy, Suspense, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type AppUser, InitialSessionUserContext } from "./use-current-user";

const LazyToaster = lazy(() =>
  import("sonner").then((mod) => ({ default: mod.Toaster })),
);

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 },
    },
  });
}

export function AuthProvider({
  children,
  initialSessionUser = null,
}: {
  children: ReactNode;
  initialSessionUser?: AppUser | null;
}) {
  const [client] = useState(makeQueryClient);
  const [toasterReady, setToasterReady] = useState(false);

  useEffect(() => {
    setToasterReady(true);
  }, []);

  return (
    <InitialSessionUserContext.Provider value={initialSessionUser}>
      <QueryClientProvider client={client}>
        {children}
        {toasterReady && (
          <Suspense fallback={null}>
            <LazyToaster
              theme="dark"
              position="bottom-center"
              toastOptions={{
                className: "font-sans",
                style: {
                  background: "var(--color-elevated)",
                  color: "var(--color-fg)",
                  border: "1px solid var(--color-border)",
                },
              }}
            />
          </Suspense>
        )}
      </QueryClientProvider>
    </InitialSessionUserContext.Provider>
  );
}
