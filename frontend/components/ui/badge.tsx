import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeColors: Record<string, string> = {
  TODO: "bg-surface-secondary text-muted",
  IN_PROGRESS: "bg-brand/10 text-brand",
  DONE: "bg-success/10 text-success",
  LOW: "bg-surface-secondary text-muted",
  MEDIUM: "bg-warning/10 text-warning",
  HIGH: "bg-danger/10 text-danger",
  OWNER: "bg-brand/10 text-brand",
  ADMIN: "bg-warning/10 text-warning",
  MEMBER: "bg-surface-secondary text-muted",
};

export function Badge({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  const key = typeof children === "string" ? children : "";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
        badgeColors[key] ?? "bg-surface-secondary text-muted",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
