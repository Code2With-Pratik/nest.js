"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  FolderKanban,
  ListTodo,
  Plus,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ActivityRow } from "@/components/activity-row";
import { ErrorState, LoadingState } from "@/components/query-state";
import { TaskRow } from "@/components/task-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeading } from "@/components/ui/page-heading";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { DashboardSummary, Project } from "@/types/api";

const statCards = [
  {
    key: "totalProjects",
    label: "Active projects",
    icon: FolderKanban,
    iconClass: "bg-brand/10 text-brand",
  },
  {
    key: "totalTasks",
    label: "Total tasks",
    icon: ListTodo,
    iconClass: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  },
  {
    key: "completedTasks",
    label: "Completed",
    icon: CheckCircle2,
    iconClass: "bg-success/10 text-success",
  },
  {
    key: "overdueTasks",
    label: "Overdue",
    icon: CalendarClock,
    iconClass: "bg-warning/10 text-warning",
  },
] as const;

export default function DashboardPage() {
  const summary = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<DashboardSummary>("/dashboard/summary"),
  });
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiFetch<Project[]>("/projects"),
  });

  if (summary.isLoading || projects.isLoading) {
    return <LoadingState label="Preparing your workspace…" />;
  }
  if (summary.error || projects.error) {
    return (
      <ErrorState
        error={summary.error ?? projects.error}
        onRetry={() => {
          void summary.refetch();
          void projects.refetch();
        }}
      />
    );
  }

  const data = summary.data;
  if (!data) {
    return <ErrorState error={new Error("Dashboard data is missing.")} onRetry={() => void summary.refetch()} />;
  }

  return (
    <div className="space-y-7">
      <PageHeading
        eyebrow="Your workspace"
        title="A clear view of your work"
        description="Here’s what’s moving across your projects today."
        action={
          <Link href="/projects">
            <Button>
              <Plus size={16} />
              New project
            </Button>
          </Link>
        }
      />

      <section
        aria-label="Workspace statistics"
        className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4"
      >
        {statCards.map(({ key, label, icon: Icon, iconClass }) => (
          <Card key={key}>
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between">
                <p className="text-xs font-medium text-muted">{label}</p>
                <span className={`grid size-8 place-items-center rounded-xl ${iconClass}`}>
                  <Icon size={16} />
                </span>
              </div>
              <p className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
                {data.stats[key]}
              </p>
              <p className="mt-1 text-[11px] text-muted">
                {key === "totalTasks"
                  ? `${data.stats.pendingTasks} to do · ${data.stats.inProgressTasks} in progress`
                  : key === "completedTasks"
                    ? "Across your workspace"
                    : key === "overdueTasks"
                      ? "Need a little attention"
                      : "You’re a member of"}
                {key === "totalProjects" ? " your projects" : ""}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Upcoming deadlines
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Tasks due in the next seven days
                </p>
              </div>
              <Link
                href="/tasks"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
              >
                All tasks <ArrowRight size={13} />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            {data.upcomingDeadlines.length > 0 ? (
              <div className="divide-y divide-border">
                {data.upcomingDeadlines.map((task) => (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-0"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {task.title}
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted">
                        {task.project.name}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-muted">
                      {formatDate(task.dueDate)}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-7 text-center">
                <CircleDashed className="mx-auto text-muted" size={20} />
                <p className="mt-2 text-sm font-medium text-foreground">
                  Nothing due soon
                </p>
                <p className="mt-1 text-xs text-muted">
                  New deadlines will show up here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Recent activity
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Updates from your projects
                </p>
              </div>
              <span className="grid size-8 place-items-center rounded-xl bg-surface-secondary text-muted">
                <ArrowUpRight size={16} />
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {data.recentActivities.length > 0 ? (
              <div className="divide-y divide-border">
                {data.recentActivities.slice(0, 5).map((activity) => (
                  <ActivityRow key={activity.id} activity={activity} />
                ))}
              </div>
            ) : (
              <div className="py-7 text-center text-xs text-muted">
                Project updates will appear here.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Your projects
            </h2>
            <p className="mt-1 text-xs text-muted">
              Keep your team’s work within reach.
            </p>
          </div>
          <Link
            className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
            href="/projects"
          >
            View all <ArrowRight size={13} />
          </Link>
        </div>
        {projects.data?.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {projects.data.slice(0, 3).map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group rounded-2xl border border-border bg-surface p-5 shadow-sm shadow-slate-950/[0.025] transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <span className="grid size-9 place-items-center rounded-xl bg-brand/10 text-brand">
                    <FolderKanban size={17} />
                  </span>
                  <span className="text-muted transition group-hover:text-brand">
                    <ArrowUpRight size={16} />
                  </span>
                </div>
                <h3 className="mt-4 truncate text-sm font-semibold text-foreground">
                  {project.name}
                </h3>
                <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-muted">
                  {project.description || "A focused space for your team's work."}
                </p>
                <div className="mt-4 flex items-center gap-4 text-xs text-muted">
                  <span>{project._count?.tasks ?? 0} tasks</span>
                  <span>{project._count?.members ?? 0} members</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FolderKanban}
            title="Start with a project"
            description="Create a project to give your team's work a shared home."
            action={
              <Link href="/projects">
                <Button size="sm">
                  <Plus size={15} /> Create a project
                </Button>
              </Link>
            }
          />
        )}
      </section>
    </div>
  );
}
