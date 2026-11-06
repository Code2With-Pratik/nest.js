import Link from "next/link";
import { CalendarDays, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate, initials } from "@/lib/format";
import type { Task } from "@/types/api";

export function TaskRow({ task }: { task: Task }) {
  return (
    <Link
      href={`/tasks/${task.id}`}
      className="group flex items-center justify-between gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-surface-secondary"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-surface text-muted">
          <span
            className={`size-2 rounded-full ${
              task.status === "DONE"
                ? "bg-success"
                : task.status === "IN_PROGRESS"
                  ? "bg-brand"
                  : "bg-slate-300"
            }`}
          />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground group-hover:text-brand">
            {task.title}
          </span>
          <span className="mt-1 block truncate text-xs text-muted">
            {task.project.name}
          </span>
        </span>
      </div>
      <span className="flex shrink-0 items-center gap-3">
        <span className="hidden items-center gap-1 text-xs text-muted sm:flex">
          <CalendarDays size={13} />
          {formatDate(task.dueDate)}
        </span>
        {task._count ? (
          <span className="hidden items-center gap-1 text-xs text-muted md:flex">
            <MessageSquare size={13} />
            {task._count.comments}
          </span>
        ) : null}
        <Badge>{task.priority}</Badge>
        {task.assignee ? (
          <span
            className="grid size-7 place-items-center rounded-full bg-brand/10 text-[10px] font-semibold text-brand"
            title={task.assignee.name}
          >
            {initials(task.assignee.name)}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
