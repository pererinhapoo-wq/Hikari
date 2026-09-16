import { Link, createFileRoute } from "@tanstack/react-router";
import { LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isHikariAdmin } from "@/lib/auth/admin";
import { signOut } from "@/lib/auth/client";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/account")({ component: Account });

function Account() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return null;
  if (!user) return <RedirectToSignIn to="/login" />;

  const admin = isHikariAdmin(user.primaryEmail);

  return (
    <main className="mx-auto max-w-xl py-8">
      <div className="rounded-xl bg-surface p-6 shadow-[var(--shadow-border)]">
        <p className="text-[11px] tracking-[0.28em] text-muted uppercase">Conta</p>
        <h1 className="mt-2 font-display text-3xl tracking-tight">Minha conta</h1>
        <div className="mt-6 flex items-center gap-4">
          {user.profileImageUrl ? (
            <img src={user.profileImageUrl} alt="" className="size-14 rounded-full object-cover" />
          ) : (
            <div className="grid size-14 place-items-center rounded-full bg-elevated text-xl font-medium">
              {(user.displayName ?? user.primaryEmail ?? "C").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium">{user.displayName ?? "Usuário"}</p>
            <p className="truncate text-sm text-muted">{user.primaryEmail ?? ""}</p>
          </div>
        </div>
        {admin && (
          <div className="mt-6 rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 font-medium">
              <ShieldCheck className="size-4" />
              Administrador HIKARI
            </div>
            <p className="mt-1 text-sm text-muted">Seu acesso ao painel de administração está liberado.</p>
            <Button asChild className="mt-4"><Link to="/admin">Abrir Admin</Link></Button>
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void signOut("/")}>
            <LogOut className="size-4" />
            Sair da conta
          </Button>
          <Button asChild variant="ghost"><Link to="/">Voltar ao início</Link></Button>
        </div>
      </div>
    </main>
  );
}
