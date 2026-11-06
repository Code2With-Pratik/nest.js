import { ArrowUpRight, CircleCheck, MessageCircle, Plus, RefreshCw } from "lucide-react";
import { formatDate, initials } from "@/lib/format";
import type { Activity } from "@/types/api";

const actionIcons: Record<string, typeof Plus> = {
  "task.created": Plus,
  "task.status_updated": CircleCheck,
  "task.comment_added": MessageCircle,
  "project.created": ArrowUpRight,
  "project.updated": RefreshCw,
};

export function ActivityRow({ activity }: { activity: Activity }) {
  const Icon = actionIcons[activity.action] ?? RefreshCw;
  return (
    <div className="flex gap-3 py-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-secondary text-muted">
        <Icon size={15} strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-5 text-foreground">
          <span className="font-medium">{activity.user.name}</span>{" "}
          <span className="text-muted">{activity.description}</span>
        </p>
        <p className="mt-1 text-xs text-muted">
          {activity.project?.name ? `${activity.project.name} · ` : ""}
          {formatDate(activity.createdAt, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>
      <span className="hidden size-7 shrink-0 place-items-center rounded-full bg-surface-secondary text-[9px] font-semibold text-muted sm:grid">
        {initials(activity.user.name)}
      </span>
    </div>
  );
}
