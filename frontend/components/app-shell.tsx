"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Menu, Moon, Sun, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/format";
import { useAuth } from "@/app/auth-provider";
import { useTheme } from "@/app/theme-provider";
import { getErrorMessage } from "@/lib/api";
import { apiFetch } from "@/lib/api";
import type { NotificationList } from "@/types/api";

const pageTitles: Record<string, string> = {
  "/dashboard": "Overview",
  "/projects": "Projects",
  "/tasks": "My tasks",
  "/notifications": "Notifications",
  "/profile": "Profile",
  "/settings": "Settings",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<NotificationList>("/notifications"),
    refetchInterval: 60_000,
  });
  const title =
    pageTitles[pathname] ??
    (pathname.includes("/board") ? "Project board" : "Project");

  async function handleSignOut() {
    setSignOutError(null);
    setIsSigningOut(true);
    try {
      await signOut();
      router.replace("/login");
    } catch (error) {
      setSignOutError(getErrorMessage(error));
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-foreground">
      <div className="fixed inset-y-0 left-0 z-20 hidden lg:block">
        <AppSidebar />
      </div>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            className="absolute inset-0 bg-slate-950/40"
            aria-label="Close navigation"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 h-full shadow-2xl">
            <AppSidebar onNavigate={() => setMobileMenuOpen(false)} />
            <Button
              className="absolute right-3 top-4"
              size="icon"
              variant="ghost"
              aria-label="Close navigation"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X size={18} />
            </Button>
          </div>
        </div>
      ) : null}

      <div className="min-h-screen lg:pl-[252px]">
        <header className="sticky top-0 z-10 flex h-[68px] items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur-md sm:px-7 lg:px-9">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              className="lg:hidden"
              size="icon"
              variant="ghost"
              aria-label="Open navigation"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={19} />
            </Button>
            <div className="truncate">
              <p className="text-[11px] text-muted">Workspace</p>
              <p className="text-sm font-semibold text-foreground">{title}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              onClick={toggleTheme}
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </Button>
            <Link
              href="/notifications"
              className="relative grid size-10 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-secondary hover:text-foreground"
              aria-label={
                notifications?.unreadCount
                  ? `Notifications, ${notifications.unreadCount} unread`
                  : "Notifications"
              }
            >
              <Bell size={18} strokeWidth={1.8} />
              {notifications?.unreadCount ? (
                <span className="absolute right-2 top-2 size-2 rounded-full border-2 border-surface bg-brand" />
              ) : null}
            </Link>

            <details className="group relative ml-1">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl p-1.5 hover:bg-surface-secondary">
                <span className="grid size-8 place-items-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                  {user ? initials(user.name) : "TF"}
                </span>
                <span className="hidden max-w-32 text-left sm:block">
                  <span className="block truncate text-xs font-semibold text-foreground">
                    {user?.name}
                  </span>
                  <span className="block truncate text-[10px] text-muted">
                    {user?.email}
                  </span>
                </span>
              </summary>
              <div className="absolute right-0 mt-2 w-52 rounded-xl border border-border bg-surface p-1.5 shadow-xl">
                <Link
                  className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-surface-secondary"
                  href="/profile"
                >
                  Your profile
                </Link>
                <Link
                  className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-surface-secondary"
                  href="/settings"
                >
                  Settings
                </Link>
                <button
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-surface-secondary"
                  disabled={isSigningOut}
                  onClick={() => void handleSignOut()}
                >
                  {isSigningOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </details>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-7 sm:py-8 lg:px-9">
          {signOutError ? (
            <p
              className="mb-5 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger"
              role="alert"
            >
              Could not sign out: {signOutError}
            </p>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
