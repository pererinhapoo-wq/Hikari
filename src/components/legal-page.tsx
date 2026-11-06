import { Link } from "@tanstack/react-router";
import { ArrowLeft, Calendar, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

interface LegalPageProps {
  title: string;
  subtitle?: string;
  lastUpdated?: string;
  badge?: string;
  children: ReactNode;
}

export function LegalPage({
  title,
  subtitle,
  lastUpdated = "5 de novembro de 2026",
  badge,
  children,
}: LegalPageProps) {
  return (
    <article className="min-h-screen pb-24 pt-6 sm:pt-10">
      {/* Botão de retorno */}
      <div className="mb-6 sm:mb-8">
        <Link
          to="/"
          className="group inline-flex items-center gap-2 rounded-xl border border-white/10 bg-surface/80 px-3.5 py-2 text-xs sm:text-sm font-medium text-muted backdrop-blur-sm transition-all hover:border-[#a855f7]/40 hover:bg-elevated hover:text-fg"
          aria-label="Voltar para a página inicial"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5 text-[#c084fc]" />
          <span>Voltar ao início</span>
        </Link>
      </div>

      {/* Cabeçalho da página legal */}
      <header className="relative mb-10 overflow-hidden rounded-2xl border border-purple-500/15 bg-gradient-to-br from-surface via-elevated/80 to-[#08070d] p-6 sm:p-10 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        {/* Brilho decorativo sutil de fundo */}
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-purple-600/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-[#a855f7]/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-wrap items-center gap-3">
          {badge && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#a855f7]/30 bg-[#a855f7]/15 px-3 py-1 text-xs font-semibold text-[#c084fc]">
              <ShieldCheck className="size-3.5" />
              {badge}
            </span>
          )}

          <span className="inline-flex items-center gap-1.5 text-xs text-subtle">
            <Calendar className="size-3.5 text-muted" />
            <span>Última atualização: {lastUpdated}</span>
          </span>
        </div>

        <h1 className="relative z-10 mt-4 font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl md:text-4xl">
          {title}
        </h1>

        {subtitle && (
          <p className="relative z-10 mt-3 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
            {subtitle}
          </p>
        )}
      </header>

      {/* Conteúdo prose com layout padronizado e refinado */}
      <div className="prose prose-invert max-w-4xl text-sm sm:text-base leading-relaxed text-muted space-y-8 [&_h2]:font-display [&_h2]:text-xl sm:[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-fg [&_h2]:tracking-tight [&_h2]:pt-4 [&_h2]:border-t [&_h2]:border-white/5 [&_h3]:text-base sm:[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-fg [&_p]:leading-relaxed [&_p]:text-muted [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-2.5 [&_li]:text-muted [&_a]:text-[#c084fc] [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-[#d8b4fe] [&_strong]:text-fg [&_strong]:font-semibold">
        {children}
      </div>
    </article>
  );
}
