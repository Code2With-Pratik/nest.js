import { AlertCircle, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/api";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
      <LoaderCircle className="animate-spin" size={17} />
      {label}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-2xl border border-danger/20 bg-danger/5 px-5 py-10 text-center"
    >
      <AlertCircle className="text-danger" size={22} />
      <p className="mt-3 text-sm font-medium text-foreground">
        We couldn&apos;t load this information.
      </p>
      <p className="mt-1 max-w-md text-xs leading-5 text-muted">
        {getErrorMessage(error)}
      </p>
      <Button className="mt-4" size="sm" variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
