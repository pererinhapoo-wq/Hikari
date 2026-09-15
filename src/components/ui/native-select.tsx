import { type SelectHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const NativeSelect = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-11 w-full appearance-none rounded-md bg-elevated bg-[length:12px] bg-[right_0.75rem_center] bg-no-repeat px-3 pr-9 text-sm text-fg shadow-[var(--shadow-border)]",
      "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 fill=%22none%22 stroke=%22%239a9a96%22 stroke-width=%221.6%22><path d=%22M3 4.5 6 8l3-3.5%22/></svg>')]",
      "focus:outline-none focus:shadow-[var(--shadow-border-hover)]",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
NativeSelect.displayName = "NativeSelect";
