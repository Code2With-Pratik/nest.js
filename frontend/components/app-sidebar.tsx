"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CheckSquare,
  FolderKanban,
  LayoutDashboard,
  Settings2,
  Users,
  Workflow,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/api";

const navigation = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "My tasks", href: "/tasks", icon: CheckSquare },
];

export function AppSidebar({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const {
    data: projects,
    isLoading: projectsLoading,
    error: projectsError,
    refetch: refetchProjects,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiFetch<Project[]>("/projects"),
  });

  return (
    <aside className="flex h-full w-[252px] shrink-0 flex-col border-r border-border bg-surface">
      <Link
        className="flex h-[76px] items-center gap-3 px-6"
        href="/dashboard"
        onClick={onNavigate}
      >
        <span className="grid size-9 place-items-center rounded-xl bg-brand text-white shadow-sm">
          <Workflow size={19} strokeWidth={2.2} />
        </span>
        <span className="text-[17px] font-semibold tracking-tight text-foreground">
          TaskFlow
        </span>
      </Link>

      <div className="px-3 pt-5">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
          Workspace
        </p>
        <nav aria-label="Main navigation" className="space-y-1">
          {navigation.map(({ label, href, icon: Icon }) => {
            const active =
              pathname === href ||
              (href !== "/dashboard" && pathname.startsWith(`${href}/`));
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand/10 text-brand"
                    : "text-muted hover:bg-surface-secondary hover:text-foreground",
                )}
              >
                <Icon size={17} strokeWidth={1.8} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-8 flex-1 overflow-y-auto px-3">
        <div className="mb-2 flex items-center justify-between px-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            Your projects
          </p>
          <Link
            href="/projects"
            className="rounded-md p-1 text-muted hover:bg-surface-secondary hover:text-foreground"
            aria-label="View all projects"
            onClick={onNavigate}
          >
            <FolderKanban size={15} />
          </Link>
        </div>
        <nav aria-label="Projects" className="space-y-1">
          {projects?.slice(0, 7).map((project) => {
            const active = pathname.startsWith(`/projects/${project.id}`);
            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                onClick={onNavigate}
                className={cn(
                  "flex h-9 items-center gap-3 rounded-xl px-3 text-[13px] transition-colors",
                  active
                    ? "bg-surface-secondary font-medium text-foreground"
                    : "text-muted hover:bg-surface-secondary hover:text-foreground",
                )}
              >
                <span className="size-2 rounded-full bg-brand/70" />
                <span className="truncate">{project.name}</span>
              </Link>
            );
          })}
          {projectsLoading ? (
            <p className="px-3 py-2 text-xs text-muted">Loading projects…</p>
          ) : projectsError ? (
            <button
              className="px-3 py-2 text-left text-xs text-danger hover:underline"
              onClick={() => void refetchProjects()}
            >
              Could not load projects. Retry
            </button>
          ) : projects?.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted">No projects yet</p>
          ) : null}
        </nav>
      </div>

      <div className="space-y-1 border-t border-border p-3">
        <Link
          href="/notifications"
          onClick={onNavigate}
          className={cn(
            "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
            pathname.startsWith("/notifications")
              ? "bg-brand/10 text-brand"
              : "text-muted hover:bg-surface-secondary hover:text-foreground",
          )}
        >
          <Bell size={17} strokeWidth={1.8} />
          Notifications
        </Link>
        <Link
          href="/settings"
          onClick={onNavigate}
          className={cn(
            "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
            pathname.startsWith("/settings")
              ? "bg-brand/10 text-brand"
              : "text-muted hover:bg-surface-secondary hover:text-foreground",
          )}
        >
          <Settings2 size={17} strokeWidth={1.8} />
          Settings
        </Link>
        <Link
          href="/profile"
          onClick={onNavigate}
          className={cn(
            "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
            pathname.startsWith("/profile")
              ? "bg-brand/10 text-brand"
              : "text-muted hover:bg-surface-secondary hover:text-foreground",
          )}
        >
          <Users size={17} strokeWidth={1.8} />
          Profile
        </Link>
      </div>
    </aside>
  );
}
