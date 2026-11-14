import { createFileRoute } from "@tanstack/react-router";
import { QuickPlayerUpdate } from "@/components/admin/QuickPlayerUpdate";
import { StudioPageHeader } from "@/components/admin/studio-ui";

export const Route = createFileRoute("/admin/quick-update")({
  component: AdminQuickUpdatePage,
});

function AdminQuickUpdatePage() {
  return (
    <div className="studio-enter space-y-6 pb-12">
      <StudioPageHeader
        kicker="Mídia & Players"
        title="Atualização Rápida de Players"
        description="Substitua ou adicione links de reprodução diretamente em qualquer slot (Player 1 a 5) preservando os demais dados do episódio e do catálogo."
        backTo="/admin"
      />

      <QuickPlayerUpdate />
    </div>
  );
}
