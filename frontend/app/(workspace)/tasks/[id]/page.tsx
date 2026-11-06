"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CircleUserRound,
  MessageSquare,
  Send,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ErrorState, LoadingState } from "@/components/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/app/auth-provider";
import { apiFetch, getErrorMessage } from "@/lib/api";
import { formatDate, initials } from "@/lib/format";
import type { Comment, ProjectMember, Task, TaskPriority, TaskStatus } from "@/types/api";

const commentSchema = z.object({
  content: z.string().trim().min(1, "Write a comment first").max(2000, "Comment is too long"),
});
type CommentValues = z.infer<typeof commentSchema>;

const statuses: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];
const priorities: TaskPriority[] = ["LOW", "MEDIUM", "HIGH"];

export default function TaskDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [actionError, setActionError] = useState<string | null>(null);
  const taskQuery = useQuery({
    queryKey: ["task", id],
    queryFn: () => apiFetch<Task>(`/tasks/${id}`),
  });
  const task = taskQuery.data;
  const commentsQuery = useQuery({
    queryKey: ["task-comments", id],
    queryFn: () => apiFetch<Comment[]>(`/tasks/${id}/comments`),
  });
  const membersQuery = useQuery({
    queryKey: ["project-members", task?.projectId],
    queryFn: () => apiFetch<ProjectMember[]>(`/projects/${task?.projectId}/members`),
    enabled: Boolean(task?.projectId),
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CommentValues>({ resolver: zodResolver(commentSchema) });

  const updateTask = useMutation({
    mutationFn: (updates: Partial<Pick<Task, "status" | "priority">>) =>
      apiFetch<Task>(`/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: async () => {
      setActionError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["task", id] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["project-tasks", task?.projectId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  });
  const addComment = useMutation({
    mutationFn: (values: CommentValues) =>
      apiFetch<Comment>(`/tasks/${id}/comments`, {
        method: "POST",
        body: JSON.stringify(values),
      }),
    onSuccess: async () => {
      reset();
      await queryClient.invalidateQueries({ queryKey: ["task-comments", id] });
      await queryClient.invalidateQueries({ queryKey: ["task", id] });
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  });
  const deleteTask = useMutation({
    mutationFn: () => apiFetch<void>(`/tasks/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["project-tasks", task?.projectId] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      router.replace(`/projects/${task?.projectId}`);
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  });

  if (taskQuery.isLoading || commentsQuery.isLoading || (task && membersQuery.isLoading)) {
    return <LoadingState label="Loading task…" />;
  }
  const pageError = taskQuery.error ?? commentsQuery.error ?? membersQuery.error;
  if (pageError) {
    return (
      <ErrorState
        error={pageError}
        onRetry={() => {
          void taskQuery.refetch();
          void commentsQuery.refetch();
          void membersQuery.refetch();
        }}
      />
    );
  }
  if (!task || !commentsQuery.data || !membersQuery.data) {
    return <ErrorState error={new Error("Task details are missing.")} onRetry={() => void taskQuery.refetch()} />;
  }

  const membership = membersQuery.data.find((member) => member.user.id === user?.id);
  const canDelete =
    task.createdById === user?.id ||
    membership?.role === "OWNER" ||
    membership?.role === "ADMIN";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href={`/projects/${task.projectId}`}
        className="inline-flex items-center gap-2 text-xs font-medium text-muted hover:text-brand"
      >
        <ArrowLeft size={14} /> {task.project.name}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand">
            Task details
          </p>
          <h1 className="break-words text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {task.title}
          </h1>
          <p className="mt-2 text-sm text-muted">
            Created by {task.createdBy.name} · {formatDate(task.createdAt)}
          </p>
        </div>
        {canDelete ? (
          <Button
            variant="secondary"
            disabled={deleteTask.isPending}
            onClick={() => {
              if (window.confirm(`Delete "${task.title}"? This cannot be undone.`)) {
                deleteTask.mutate();
              }
            }}
          >
            <Trash2 size={15} />
            {deleteTask.isPending ? "Deleting…" : "Delete task"}
          </Button>
        ) : null}
      </div>

      {actionError ? (
        <p className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-foreground">Description</h2>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-7 text-muted">
                {task.description || "No description has been added."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Comments</h2>
                <Badge>{commentsQuery.data.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                className="space-y-3"
                onSubmit={handleSubmit((values) => addComment.mutate(values))}
              >
                <Textarea
                  aria-label="Write a comment"
                  placeholder="Share an update or ask a question…"
                  rows={3}
                  aria-invalid={Boolean(errors.content)}
                  {...register("content")}
                />
                {errors.content ? <p className="text-xs text-danger">{errors.content.message}</p> : null}
                <div className="flex justify-end">
                  <Button type="submit" disabled={addComment.isPending}>
                    <Send size={14} />
                    {addComment.isPending ? "Sending…" : "Add comment"}
                  </Button>
                </div>
              </form>

              {commentsQuery.data.length ? (
                <div className="divide-y divide-border border-t border-border">
                  {commentsQuery.data.map((comment) => (
                    <article key={comment.id} className="flex gap-3 py-4">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand/10 text-[10px] font-semibold text-brand">
                        {initials(comment.user.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-xs font-semibold text-foreground">{comment.user.name}</span>
                          <span className="text-[10px] text-muted">{formatDate(comment.createdAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted">{comment.content}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="border-t border-border pt-4 text-center text-xs text-muted">
                  No comments yet. Start the conversation.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-foreground">Task properties</h2>
            </CardHeader>
            <CardContent className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-muted">Status</span>
                <select
                  className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                  value={task.status}
                  disabled={updateTask.isPending}
                  onChange={(event) => updateTask.mutate({ status: event.target.value as TaskStatus })}
                >
                  {statuses.map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-muted">Priority</span>
                <select
                  className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                  value={task.priority}
                  disabled={updateTask.isPending}
                  onChange={(event) => updateTask.mutate({ priority: event.target.value as TaskPriority })}
                >
                  {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                </select>
              </label>
              <div>
                <span className="mb-2 block text-xs font-medium text-muted">Assignee</span>
                <span className="flex items-center gap-2 text-sm text-foreground">
                  <CircleUserRound className="text-muted" size={16} />
                  {task.assignee?.name ?? "Unassigned"}
                </span>
              </div>
              <div>
                <span className="mb-2 block text-xs font-medium text-muted">Due date</span>
                <span className="flex items-center gap-2 text-sm text-foreground">
                  <CalendarDays className="text-muted" size={16} />
                  {task.dueDate ? formatDate(task.dueDate) : "No due date"}
                </span>
              </div>
              <div>
                <span className="mb-2 block text-xs font-medium text-muted">Project</span>
                <Link
                  className="text-sm font-medium text-brand hover:underline"
                  href={`/projects/${task.projectId}`}
                >
                  {task.project.name}
                </Link>
              </div>
            </CardContent>
          </Card>
          <div className="flex items-center gap-2 px-1 text-xs text-muted">
            <MessageSquare size={14} />
            {commentsQuery.data.length} comments
            <span className="ml-auto flex items-center gap-1">
              <Check size={13} /> Saved to project
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
