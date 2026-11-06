import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/watch_/$id/$ep")({
  component: () => <div>Watch Episode</div>,
});
