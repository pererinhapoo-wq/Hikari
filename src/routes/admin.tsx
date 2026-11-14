import { Navigate, Outlet, createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { useAdminAccess } from "@/lib/auth/use-admin-access";
import { flushOutbox, hasPendingWrites } from "@/lib/episode-writer";

import { HikariStudioLayout } from "@/components/admin/studio-layout";

export const Route = createFileRoute("/admin")({ component: AdminGuard });

function AdminGuard() {
  const { user, isAuthenticated, isAdmin, isPending } = useAdminAccess();

  useEffect(() => {
    if (!user || !isAuthenticated || !isAdmin) return;

    // Executa sincronização do Outbox ao entrar no ambiente administrativo
    const runSync = async () => {
      if (!hasPendingWrites()) return;
      try {
        const res = await flushOutbox();
        if (res.processed > 0) {
          toast.success(
            `${res.processed} operação(ões) de episódio sincronizada(s) com o servidor!`,
          );
        }
        if (res.error) {
          toast.error(res.error);
        }
      } catch (err) {
        console.warn("[admin-layout] Falha ao sincronizar outbox:", err);
      }
    };

    void runSync();

    // Sincroniza automaticamente assim que a conexão de rede for restabelecida
    const handleOnline = () => {
      void runSync();
    };

    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [user, isAuthenticated, isAdmin]);

  if (isPending) return null;
  if (!user || !isAuthenticated) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/account" />;

  return (
    <HikariStudioLayout>
      <Outlet />
    </HikariStudioLayout>
  );
}
