import { cn } from "@/lib/utils";

export interface TypingIndicatorProps {
  active: boolean;
  typingCount?: number;
  className?: string;
}

export function TypingIndicator({
  active,
  typingCount = 1,
  className,
}: TypingIndicatorProps) {
  if (!active) return null;

  const label =
    typingCount > 1
      ? "Pessoas estão digitando..."
      : "Alguém está digitando...";

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="comment-typing-indicator"
      className={cn(
        "inline-flex items-center gap-2 text-xs text-purple-300/90 select-none transition-opacity duration-150",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="inline-flex items-center gap-1 rounded-full border border-purple-500/25 bg-purple-500/10 px-2 py-1"
      >
        <span className="size-1.5 rounded-full bg-purple-400 hikari-typing-dot hikari-typing-dot-1" />
        <span className="size-1.5 rounded-full bg-purple-400 hikari-typing-dot hikari-typing-dot-2" />
        <span className="size-1.5 rounded-full bg-purple-400 hikari-typing-dot hikari-typing-dot-3" />
      </span>
      <span className="font-medium tracking-tight text-purple-200/90 truncate">
        {label}
      </span>
    </div>
  );
}
