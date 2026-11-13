import { type ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { type AppUser, InitialSessionUserContext } from "./use-current-user";

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
  return (
    <InitialSessionUserContext.Provider value={initialSessionUser}>
      <QueryClientProvider client={client}>
        {children}
        <Toaster
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
      </QueryClientProvider>
    </InitialSessionUserContext.Provider>
  );
}
