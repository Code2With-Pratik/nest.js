import { ProtectedLayout } from "@/components/protected-layout";

export default function WorkspaceLayout({
  children,
}: LayoutProps<"/">) {
  return <ProtectedLayout>{children}</ProtectedLayout>;
}
