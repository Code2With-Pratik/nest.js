"use client";

import {
  Bell,
  Check,
  CheckCheck,
  FolderPlus,
  MessageSquareText,
  UserRoundPlus,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ErrorState, LoadingState } from "@/components/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeading } from "@/components/ui/page-heading";
import { apiFetch, getErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Notification, NotificationList, NotificationType } from "@/types/api";

const icons: Record<NotificationType, typeof Bell> = {
  TASK_ASSIGNED: UserRoundPlus,
  TASK_STATUS_UPDATED: Check,
  COMMENT_ADDED: MessageSquareText,
  PROJECT_INVITATION: FolderPlus,
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<NotificationList>("/notifications"),
    refetchInterval: 60_000,
  });
  const markRead = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markAllRead = useMutation({
    mutationFn: () => apiFetch<void>("/notifications/read-all", { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  if (query.isLoading) return <LoadingState label="Loading notifications…" />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data) return <ErrorState error={new Error("Notification data is missing.")} onRetry={() => void query.refetch()} />;

  return (
    <div>
      <PageHeading
        eyebrow="Inbox"
        title="Notifications"
        description="Important updates from the projects you work on."
        action={
          query.data.unreadCount > 0 ? (
            <Button
              variant="secondary"
              disabled={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck size={15} />
              {markAllRead.isPending ? "Updating…" : "Mark all read"}
            </Button>
          ) : null
        }
      />
      {markRead.error || markAllRead.error ? (
        <p className="mb-4 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">
          {getErrorMessage(markRead.error ?? markAllRead.error)}
        </p>
      ) : null}
      <Card>
        <CardContent className="p-3 sm:p-5">
          {query.data.data.length ? (
            <div className="divide-y divide-border">
              {query.data.data.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  isPending={markRead.isPending}
                  onMarkRead={() => markRead.mutate(notification.id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Bell}
              title="You’re all caught up"
              description="When something needs your attention, you’ll find it here."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationRow({
  notification,
  isPending,
  onMarkRead,
}: {
  notification: Notification;
  isPending: boolean;
  onMarkRead: () => void;
}) {
  const Icon = icons[notification.type];
  return (
    <article
      className={`flex gap-3 rounded-xl px-3 py-4 sm:gap-4 ${
        notification.isRead ? "" : "bg-brand/[0.035]"
      }`}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-secondary text-muted">
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">{notification.title}</h2>
          {!notification.isRead ? <Badge>New</Badge> : null}
        </div>
        <p className="mt-1 text-sm leading-6 text-muted">{notification.message}</p>
        <p className="mt-1.5 text-xs text-muted">
          {formatDate(notification.createdAt, {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>
      {!notification.isRead ? (
        <button
          aria-label={`Mark ${notification.title} as read`}
          className="grid size-8 shrink-0 place-items-center self-center rounded-lg text-muted hover:bg-surface-secondary hover:text-brand"
          disabled={isPending}
          onClick={onMarkRead}
          type="button"
        >
          <Check size={16} />
        </button>
      ) : null}
    </article>
  );
}
