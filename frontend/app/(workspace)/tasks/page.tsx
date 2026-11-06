"use client";

import { CheckCircle2, ListTodo, Search, SlidersHorizontal } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ErrorState, LoadingState } from "@/components/query-state";
import { TaskRow } from "@/components/task-row";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeading } from "@/components/ui/page-heading";
import { apiFetch } from "@/lib/api";
import type { PaginatedTasks, TaskStatus } from "@/types/api";

const statuses: Array<{ value: TaskStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All tasks" },
  { value: "TODO", label: "To do" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "DONE", label: "Done" },
];

export default function TasksPage() {
  const [status, setStatus] = useState<TaskStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const query = useQuery({
    queryKey: ["tasks", status, deferredSearch],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "100" });
      if (status !== "ALL") params.set("status", status);
      if (deferredSearch) params.set("search", deferredSearch);
      return apiFetch<PaginatedTasks>(`/tasks?${params.toString()}`);
    },
  });

  if (query.isLoading) return <LoadingState label="Loading your tasks…" />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const tasks = query.data?.data ?? [];

  return (
    <div>
      <PageHeading
        eyebrow="Your work"
        title="My tasks"
        description="A focused list of tasks from every project you belong to."
      />
      <section aria-label="Task filters" className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
          <Input
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search task titles and descriptions"
            aria-label="Search tasks"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1">
          <SlidersHorizontal className="ml-2 shrink-0 text-muted" size={15} />
          {statuses.map((item) => (
            <button
              key={item.value}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition ${
                status === item.value
                  ? "bg-brand text-white"
                  : "text-muted hover:bg-surface-secondary hover:text-foreground"
              }`}
              onClick={() => setStatus(item.value)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between px-3 pt-1">
            <p className="text-xs font-medium text-muted">
              {query.data?.total ?? 0} {query.data?.total === 1 ? "task" : "tasks"}
            </p>
            {query.isFetching ? <Badge>Updating</Badge> : null}
          </div>
          {tasks.length ? (
            <div className="divide-y divide-border">
              {tasks.map((task) => <TaskRow key={task.id} task={task} />)}
            </div>
          ) : (
            <EmptyState
              icon={search || status !== "ALL" ? CheckCircle2 : ListTodo}
              title={search || status !== "ALL" ? "No matching tasks" : "You’re all caught up"}
              description={
                search || status !== "ALL"
                  ? "Try a different search term or status filter."
                  : "Tasks from your projects will appear here."
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
