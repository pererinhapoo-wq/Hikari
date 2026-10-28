import { Navigate, Outlet, createFileRoute } from "@tanstack/react-router";
import { isHikariAdmin } from "@/lib/auth/admin";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/admin")({ component: AdminGuard });

function AdminGuard() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return null;
  if (!user) return <Navigate to="/login" />;
  if (!isHikariAdmin(user.primaryEmail)) return <Navigate to="/account" />;
  return <Outlet />;
}
