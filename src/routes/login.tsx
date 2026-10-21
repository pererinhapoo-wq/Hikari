import { createFileRoute } from "@tanstack/react-router";
import { LoginMenu } from "@/components/LoginMenu";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  return (
    <main className="grid min-h-[75vh] place-items-center px-4 py-12">
      <LoginMenu isModal={false} callbackURL="/account" />
    </main>
  );
}
