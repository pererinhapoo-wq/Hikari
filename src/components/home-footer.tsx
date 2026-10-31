export function HomeFooter() {
  return (
    <footer
      className="relative mt-8 sm:mt-10 w-full overflow-hidden rounded-xl sm:rounded-2xl border-t border-purple-500/15 bg-gradient-to-b from-purple-950/15 via-[#08070d] to-[#040308] px-4 py-6 sm:py-7 text-center shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
      aria-label="Rodapé Hikari"
    >
      {/* Linha de transição suave e brilho roxo sutil estático */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/25 to-transparent"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 h-24 w-2/3 max-w-lg rounded-full bg-purple-600/5 blur-2xl"
        aria-hidden="true"
      />

      <p className="relative z-10 text-xs sm:text-sm font-medium tracking-wide text-zinc-400">
        © 2026 Hikari. Todos os direitos reservados.
      </p>
    </footer>
  );
}
