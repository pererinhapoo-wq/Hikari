import {
  createFileRoute,
  Outlet,
} from "@tanstack/react-router";

export const Route = createFileRoute("/adult")({
  component: AdultLayout,
});

function AdultLayout() {
  return <Outlet />;
}
