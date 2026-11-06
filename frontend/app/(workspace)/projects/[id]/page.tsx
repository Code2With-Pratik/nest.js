"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FolderKanban,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActivityRow } from "@/components/activity-row";
import { ErrorState, LoadingState } from "@/components/query-state";
import { TaskRow } from "@/components/task-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeading } from "@/components/ui/page-heading";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/app/auth-provider";
import { apiFetch, getErrorMessage } from "@/lib/api";
import { formatDate, initials } from "@/lib/format";
import type { Activity, PaginatedTasks, Project, ProjectMember, ProjectRole } from "@/types/api";

const editProjectSchema = z.object({
  name: z.string().trim().min(2, "Project name must have at least 2 characters").max(120),
  description: z.string().max(2000, "Description is too long"),
});
type EditProjectValues = z.infer<typeof editProjectSchema>;

export default function ProjectDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const projectQuery = useQuery({
    queryKey: ["project", id],
    queryFn: () => apiFetch<Project>(`/projects/${id}`),
  });
  const membersQuery = useQuery({
    queryKey: ["project-members", id],
    queryFn: () => apiFetch<ProjectMember[]>(`/projects/${id}/members`),
  });
  const tasksQuery = useQuery({
    queryKey: ["project-tasks", id],
    queryFn: () =>
      apiFetch<PaginatedTasks>(`/tasks?projectId=${encodeURIComponent(id)}&limit=100`),
  });
  const activitiesQuery = useQuery({
    queryKey: ["project-activities", id],
    queryFn: () =>
      apiFetch<Activity[]>(`/projects/${id}/activities?limit=8`),
  });
  const project = projectQuery.data;
  const members = membersQuery.data ?? [];
  const currentMembership = members.find((member) => member.user.id === user?.id);
  const isOwner = project?.ownerId === user?.id;
  const canManage = currentMembership?.role === "OWNER" || currentMembership?.role === "ADMIN";

  const {
    register: registerProject,
    handleSubmit: handleProjectSubmit,
    reset: resetProject,
    formState: { errors: projectErrors },
  } = useForm<EditProjectValues>({
    resolver: zodResolver(editProjectSchema),
    values: {
      name: project?.name ?? "",
      description: project?.description ?? "",
    },
  });

  const updateProject = useMutation({
    mutationFn: (values: EditProjectValues) =>
      apiFetch<Project>(`/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: values.name,
          description: values.description.trim() || null,
        }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", id] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      setEditing(false);
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  });
  const addMember = useMutation({
    mutationFn: (email: string) =>
      apiFetch<ProjectMember>(`/projects/${id}/members`, {
        method: "POST",
        body: JSON.stringify({ email, role: "MEMBER" satisfies ProjectRole }),
      }),
    onSuccess: async () => {
      setActionError(null);
      resetMember();
      await queryClient.invalidateQueries({ queryKey: ["project-members", id] });
      await queryClient.invalidateQueries({ queryKey: ["project", id] });
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  });
  const removeMember = useMutation({
    mutationFn: (userId: string) =>
      apiFetch<void>(`/projects/${id}/members/${userId}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["project-members", id] });
      await queryClient.invalidateQueries({ queryKey: ["project", id] });
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  });
  const {
    register: registerMember,
    handleSubmit: handleMemberSubmit,
    reset: resetMember,
    formState: { errors: memberErrors },
  } = useForm<{ email: string }>({
    resolver: zodResolver(z.object({ email: z.string().trim().email("Enter a valid email address").max(254) })),
  });

  if (projectQuery.isLoading || membersQuery.isLoading || tasksQuery.isLoading || activitiesQuery.isLoading) {
    return <LoadingState label="Loading project…" />;
  }
  const pageError = projectQuery.error ?? membersQuery.error ?? tasksQuery.error ?? activitiesQuery.error;
  if (pageError) {
    return (
      <ErrorState
        error={pageError}
        onRetry={() => {
          void projectQuery.refetch();
          void membersQuery.refetch();
          void tasksQuery.refetch();
          void activitiesQuery.refetch();
        }}
      />
    );
  }
  if (!project || !tasksQuery.data || !activitiesQuery.data) {
    return <ErrorState error={new Error("Project details are missing.")} onRetry={() => void projectQuery.refetch()} />;
  }

  const role = currentMembership?.role ?? "MEMBER";

  return (
    <div className="space-y-7">
      <Link
        href="/projects"
        className="inline-flex items-center gap-2 text-xs font-medium text-muted hover:text-brand"
      >
        <ArrowLeft size={14} /> All projects
      </Link>
      <PageHeading
        eyebrow="Project"
        title={project.name}
        description={project.description || "A focused space for your team's work."}
        action={
          <div className="flex items-center gap-2">
            {canManage ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setActionError(null);
                  resetProject({
                    name: project.name,
                    description: project.description ?? "",
                  });
                  setEditing((current) => !current);
                }}
              >
                {editing ? <X size={15} /> : <Pencil size={15} />}
                {editing ? "Cancel" : "Edit project"}
              </Button>
            ) : null}
            <Link href={`/projects/${id}/board`}>
              <Button>
                Open board <ArrowRight size={15} />
              </Button>
            </Link>
          </div>
        }
      />

      {actionError ? (
        <p className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">
          {actionError}
        </p>
      ) : null}

      {editing ? (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-foreground">Project details</h2>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={handleProjectSubmit((values) => updateProject.mutate(values))}
            >
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground" htmlFor="edit-project-name">
                  Name
                </label>
                <Input id="edit-project-name" {...registerProject("name")} />
                {projectErrors.name ? <p className="mt-1 text-xs text-danger">{projectErrors.name.message}</p> : null}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground" htmlFor="edit-project-description">
                  Description
                </label>
                <Textarea id="edit-project-description" rows={2} {...registerProject("description")} />
                {projectErrors.description ? <p className="mt-1 text-xs text-danger">{projectErrors.description.message}</p> : null}
              </div>
              <div className="flex justify-end sm:col-span-2">
                <Button type="submit" disabled={updateProject.isPending}>
                  <Check size={15} /> {updateProject.isPending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "Tasks", value: project._count?.tasks ?? tasksQuery.data.total, icon: FolderKanban },
          { label: "Members", value: project._count?.members ?? members.length, icon: Users },
          { label: "Your role", value: role.toLowerCase(), icon: Check },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 p-4">
              <span className="grid size-9 place-items-center rounded-xl bg-brand/10 text-brand">
                <Icon size={16} />
              </span>
              <div>
                <p className="text-lg font-semibold capitalize text-foreground">{value}</p>
                <p className="text-xs text-muted">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Project tasks</h2>
                <p className="mt-1 text-xs text-muted">{tasksQuery.data.total} tasks in this project</p>
              </div>
              <Link href={`/projects/${id}/board`}>
                <Button size="sm" variant="secondary">View board</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            {tasksQuery.data.data.length ? (
              <div className="divide-y divide-border">
                {tasksQuery.data.data.slice(0, 8).map((task) => <TaskRow key={task.id} task={task} />)}
              </div>
            ) : (
              <EmptyState
                icon={FolderKanban}
                title="No tasks in this project"
                description="Open the project board to add the first task."
                action={<Link href={`/projects/${id}/board`}><Button size="sm"><Plus size={14} /> Add a task</Button></Link>}
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Project members</h2>
                  <p className="mt-1 text-xs text-muted">{members.length} people on this project</p>
                </div>
                <Users className="text-muted" size={17} />
              </div>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="space-y-1">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand/10 text-[10px] font-semibold text-brand">
                      {initials(member.user.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-foreground">{member.user.name}</span>
                      <span className="block truncate text-[10px] text-muted">{member.user.email}</span>
                    </span>
                    <Badge>{member.role}</Badge>
                    {member.role !== "OWNER" && (isOwner || (canManage && member.role === "MEMBER")) ? (
                      <button
                        aria-label={`Remove ${member.user.name}`}
                        className="grid size-8 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"
                        disabled={removeMember.isPending}
                        onClick={() => {
                          if (window.confirm(`Remove ${member.user.name} from this project?`)) {
                            removeMember.mutate(member.user.id);
                          }
                        }}
                        type="button"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
              {canManage ? (
                <form
                  className="mt-4 border-t border-border pt-4"
                  onSubmit={handleMemberSubmit(({ email }) => addMember.mutate(email))}
                >
                  <label className="mb-2 block text-xs font-medium text-foreground" htmlFor="member-email">
                    Invite an existing TaskFlow user
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="member-email"
                      type="email"
                      placeholder="teammate@company.com"
                      aria-invalid={Boolean(memberErrors.email)}
                      {...registerMember("email")}
                    />
                    <Button aria-label="Add member" disabled={addMember.isPending} type="submit">
                      <Plus size={15} />
                    </Button>
                  </div>
                  {memberErrors.email ? <p className="mt-1 text-xs text-danger">{memberErrors.email.message}</p> : null}
                  <p className="mt-2 text-[10px] leading-4 text-muted">
                    The person must already have an account. They will be added as a project member.
                  </p>
                </form>
              ) : null}
              <p className="mt-3 text-[10px] text-muted">
                Created {formatDate(project.createdAt)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-foreground">Recent activity</h2>
            </CardHeader>
            <CardContent className="pt-2">
              {activitiesQuery.data.length ? (
                <div className="divide-y divide-border">
                  {activitiesQuery.data.slice(0, 5).map((activity) => (
                    <ActivityRow key={activity.id} activity={activity} />
                  ))}
                </div>
              ) : (
                <p className="py-4 text-xs text-muted">Project activity will appear here.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
