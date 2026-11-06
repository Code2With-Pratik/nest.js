export function formatDate(value: string | null, options?: Intl.DateTimeFormatOptions): string {
  if (!value) {
    return "No due date";
  }
  return new Intl.DateTimeFormat("en", options ?? { month: "short", day: "numeric" }).format(
    new Date(value),
  );
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
