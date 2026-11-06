"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/app/auth-provider";

export function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isLoading, bootstrapError, retrySession } = useAuth();

  useEffect(() => {
    if (!isLoading && !bootstrapError && !user) {
      router.replace("/login");
    }
  }, [bootstrapError, isLoading, router, user]);

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas">
        <p className="text-sm text-muted">Restoring your secure session…</p>
      </main>
    );
  }

  if (bootstrapError) {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas p-6">
        <div className="max-w-md rounded-2xl border border-border bg-surface p-6 text-center">
          <h1 className="font-semibold">Could not reach TaskFlow</h1>
          <p className="mt-2 text-sm text-muted">{bootstrapError}</p>
          <Button className="mt-5" onClick={() => void retrySession()}>
            Try again
          </Button>
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return <AppShell>{children}</AppShell>;
}
