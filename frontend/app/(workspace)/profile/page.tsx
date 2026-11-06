"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Mail, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ErrorState, LoadingState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeading } from "@/components/ui/page-heading";
import { useAuth } from "@/app/auth-provider";
import { apiFetch, getErrorMessage } from "@/lib/api";
import { formatDate, initials } from "@/lib/format";
import type { User } from "@/types/api";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must have at least 2 characters").max(80),
});
type ProfileValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { updateUser } = useAuth();
  const queryClient = useQueryClient();
  const [success, setSuccess] = useState(false);
  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: () => apiFetch<User>("/users/me"),
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    if (profileQuery.data) reset({ name: profileQuery.data.name });
  }, [profileQuery.data, reset]);

  const updateProfile = useMutation({
    mutationFn: (values: ProfileValues) =>
      apiFetch<User>("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ name: values.name }),
      }),
    onSuccess: async (user) => {
      updateUser(user);
      setSuccess(true);
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  if (profileQuery.isLoading) return <LoadingState label="Loading your profile…" />;
  if (profileQuery.error) {
    return <ErrorState error={profileQuery.error} onRetry={() => void profileQuery.refetch()} />;
  }
  if (!profileQuery.data) {
    return <ErrorState error={new Error("Profile data is missing.")} onRetry={() => void profileQuery.refetch()} />;
  }
  const profile = profileQuery.data;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading
        eyebrow="Account"
        title="Your profile"
        description="Manage the details your teammates see across TaskFlow."
      />
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-2xl bg-brand/10 text-lg font-semibold text-brand">
              {initials(profile.name)}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-foreground">{profile.name}</h2>
              <p className="mt-1 truncate text-sm text-muted">{profile.email}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form
            className="space-y-5"
            onSubmit={handleSubmit((values) => {
              setSuccess(false);
              updateProfile.mutate(values);
            })}
          >
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground" htmlFor="profile-name">
                Full name
              </label>
              <Input
                id="profile-name"
                autoComplete="name"
                aria-invalid={Boolean(errors.name)}
                {...register("name")}
              />
              {errors.name ? <p className="mt-1.5 text-xs text-danger">{errors.name.message}</p> : null}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground" htmlFor="profile-email">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                <Input
                  className="pl-9"
                  id="profile-email"
                  type="email"
                  value={profile.email}
                  disabled
                  readOnly
                />
              </div>
              <p className="mt-1.5 text-xs text-muted">
                Email changes are not currently supported.
              </p>
            </div>
            {updateProfile.error ? (
              <p className="text-sm text-danger" role="alert">
                {getErrorMessage(updateProfile.error)}
              </p>
            ) : null}
            {success ? (
              <p className="flex items-center gap-2 text-sm text-success" role="status">
                <Check size={15} /> Your profile was saved.
              </p>
            ) : null}
            <div className="flex justify-end border-t border-border pt-4">
              <Button type="submit" disabled={updateProfile.isPending}>
                <UserRound size={15} />
                {updateProfile.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-5">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-success/10 text-success">
              <ShieldCheck size={17} />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">Account security</p>
              <p className="mt-1 text-xs text-muted">Member since {formatDate(profile.createdAt)}</p>
            </div>
          </div>
          <span className="rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-medium text-success">
            Protected
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
