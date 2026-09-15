import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("flex items-baseline gap-2", className)} aria-label="Hikari">
      <span className="font-display text-2xl leading-none tracking-tight text-fg">光</span>
      <span className="text-[11px] font-medium tracking-[0.32em] text-muted uppercase">
        Hikari
      </span>
    </Link>
  );
}
