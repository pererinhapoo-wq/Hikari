import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full bg-elevated px-2.5 text-xs font-medium text-muted",
        className,
      )}
      {...props}
    />
  );
}
