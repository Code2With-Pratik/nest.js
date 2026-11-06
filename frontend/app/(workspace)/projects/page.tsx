"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpRight, FolderKanban, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ErrorState, LoadingState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeading } from "@/components/ui/page-heading";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, getErrorMessage } from "@/lib/api";
import type { Project } from "@/types/api";

const projectSchema = z.object({
  name: z.string().trim().min(2, "Project name must have at least 2 characters").max(120),
  description: z.string().max(2000, "Description is too long"),
});
type ProjectValues = z.infer<typeof projectSchema>;

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data: projects, isLoading, error, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiFetch<Project[]>("/projects"),
  });
  const createProject = useMutation({
    mutationFn: (values: ProjectValues) =>
      apiFetch<Project>("/projects", {
        method: "POST",
        body: JSON.stringify({
          name: values.name,
          description: values.description.trim() || undefined,
        }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setDialogOpen(false);
      reset();
    },
    onError: (mutationError) => setActionError(getErrorMessage(mutationError)),
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProjectValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: "", description: "" },
  });

  if (isLoading) return <LoadingState label="Loading your projects…" />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <div>
      <PageHeading
        eyebrow="Workspace"
        title="Projects"
        description="Shared spaces for the goals your team is working toward."
        action={
          <Button
            onClick={() => {
              setActionError(null);
              setDialogOpen(true);
            }}
          >
            <Plus size={16} /> New project
          </Button>
        }
      />

      {projects?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="group"
            >
              <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md">
                <div className="flex items-start justify-between">
                  <span className="grid size-10 place-items-center rounded-xl bg-brand/10 text-brand">
                    <FolderKanban size={18} />
                  </span>
                  <ArrowUpRight
                    className="text-muted transition group-hover:text-brand"
                    size={17}
                  />
                </div>
                <h2 className="mt-4 truncate text-base font-semibold text-foreground">
                  {project.name}
                </h2>
                <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-muted">
                  {project.description || "A focused space for your team's work."}
                </p>
                <div className="mt-5 flex items-center gap-4 border-t border-border pt-4 text-xs text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <FolderKanban size={14} />
                    {project._count?.tasks ?? 0} tasks
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users size={14} />
                    {project._count?.members ?? 0} members
                  </span>
                  <span className="ml-auto rounded-full bg-surface-secondary px-2 py-1 text-[10px] font-medium">
                    {project.members?.[0]?.role ?? "MEMBER"}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create the first project to give your work a shared home."
          action={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus size={15} /> Create a project
            </Button>
          }
        />
      )}

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDialogOpen(false);
          }}
        >
          <section
            aria-labelledby="create-project-title"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl"
            role="dialog"
          >
            <h2
              className="text-lg font-semibold text-foreground"
              id="create-project-title"
            >
              Create a project
            </h2>
            <p className="mt-1 text-sm text-muted">
              Give your team a clear place to organize tasks and updates.
            </p>
            <form
              className="mt-6 space-y-4"
              onSubmit={handleSubmit((values) => createProject.mutate(values))}
            >
              <div>
                <label
                  className="mb-2 block text-sm font-medium text-foreground"
                  htmlFor="project-name"
                >
                  Project name
                </label>
                <Input
                  autoFocus
                  id="project-name"
                  placeholder="Website refresh"
                  aria-invalid={Boolean(errors.name)}
                  {...register("name")}
                />
                {errors.name ? (
                  <p className="mt-1 text-xs text-danger">{errors.name.message}</p>
                ) : null}
              </div>
              <div>
                <label
                  className="mb-2 block text-sm font-medium text-foreground"
                  htmlFor="project-description"
                >
                  Description <span className="font-normal text-muted">· optional</span>
                </label>
                <Textarea
                  id="project-description"
                  placeholder="What are you and your team working toward?"
                  rows={3}
                  aria-invalid={Boolean(errors.description)}
                  {...register("description")}
                />
                {errors.description ? (
                  <p className="mt-1 text-xs text-danger">
                    {errors.description.message}
                  </p>
                ) : null}
              </div>
              {actionError ? (
                <p className="text-sm text-danger" role="alert">
                  {actionError}
                </p>
              ) : null}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => setDialogOpen(false)}
                  disabled={createProject.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createProject.isPending}>
                  {createProject.isPending ? "Creating…" : "Create project"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
