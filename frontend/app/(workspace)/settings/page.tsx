"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeading } from "@/components/ui/page-heading";
import { useTheme } from "@/app/theme-provider";

const themes = [
  { value: "light", label: "Light", detail: "Bright canvas and crisp surfaces", icon: Sun },
  { value: "dark", label: "Dark", detail: "Low-glare slate surfaces", icon: Moon },
] as const;

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading
        eyebrow="Preferences"
        title="Settings"
        description="Make TaskFlow feel comfortable for the way you work."
      />
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-brand/10 text-brand">
              <Monitor size={17} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Appearance</h2>
              <p className="mt-1 text-xs leading-5 text-muted">
                Choose a theme. Your preference is saved on this device.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2">
          {themes.map(({ value, label, detail, icon: Icon }) => {
            const selected = theme === value;
            return (
              <button
                key={value}
                aria-pressed={selected}
                className={`rounded-xl border p-4 text-left transition ${
                  selected
                    ? "border-brand bg-brand/5 ring-2 ring-brand/15"
                    : "border-border hover:border-brand/40"
                }`}
                onClick={() => {
                  if (!selected) toggleTheme();
                }}
                type="button"
              >
                <span className="flex items-center justify-between">
                  <span className="grid size-9 place-items-center rounded-xl bg-surface-secondary text-foreground">
                    <Icon size={17} />
                  </span>
                  <span
                    className={`grid size-4 place-items-center rounded-full border ${
                      selected ? "border-brand bg-brand" : "border-border"
                    }`}
                  >
                    {selected ? <span className="size-1.5 rounded-full bg-white" /> : null}
                  </span>
                </span>
                <span className="mt-4 block text-sm font-semibold text-foreground">{label}</span>
                <span className="mt-1 block text-xs text-muted">{detail}</span>
              </button>
            );
          })}
        </CardContent>
      </Card>
      <p className="mt-4 flex items-center gap-2 px-1 text-xs text-muted">
        Theme preference is stored in your browser and does not change account data.
      </p>
    </div>
  );
}
