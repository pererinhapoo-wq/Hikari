import { createFileRoute } from "@tanstack/react-router";
import { CommandCenterLayout } from "@/components/admin/command-center/command-center-layout";

export const Route = createFileRoute("/admin/diagnostics")({
  component: AdminDiagnosticsPageRoute,
});

function AdminDiagnosticsPageRoute() {
  return <CommandCenterLayout />;
}
