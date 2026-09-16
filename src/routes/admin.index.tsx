import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Plus, Search, Trash2, Upload } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { searchCatalog } from "@/lib/api";
import { animeToLocal, displayTitle, type SlimAnime } from "@/lib/types";
import { useHikariStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/")({
  component: AdminIndex,
});

function AdminIndex() {
  const animes = useHikariStore((s) => s.animes);
  const removeAnime = useHikariStore((s) => s.removeAnime);
  const upsertAnime = useHikariStore((s) => s.upsertAnime);
  const importAll = useHikariStore((s) => s.importAll);
  const [q, setQ] = useState("");
  const [importQ, setImportQ] = useState("");
  const [hits, setHits] = useState<SlimAnime[]>([]);
  const [searching, setSearching] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return animes;
    return animes.filter((a) =>
      `${a.titleRomaji} ${a.titleEnglish} ${a.titleNative}`.toLowerCase().includes(n),
    );
  }, [animes, q]);

  async function runImportSearch(e: FormEvent) {
    e.preventDefault();
    if (!importQ.trim()) return;
    setSearching(true);
    try {
      const res = await searchCatalog({ data: { q: importQ.trim(), page: 1 } });
      setHits(res.items);
    } catch {
      toast.error("Não foi possível buscar no AniList.");
    } finally {
      setSearching(false);
    }
  }

  function importHit(hit: SlimAnime) {
    const existing = animes.find((a) => a.anilistId === hit.anilistId);
    const local = animeToLocal(hit, existing);
    upsertAnime(local);
    toast.success(`${displayTitle(hit)} importado. Abra para editar episódios.`);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ animes }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hikari-catalogo.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as { animes?: typeof animes };
        if (!Array.isArray(parsed.animes)) throw new Error("invalid");
        importAll(parsed.animes);
        toast.success("Catálogo restaurado.");
      } catch {
        toast.error("Arquivo inválido.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-8 pt-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] tracking-[0.28em] text-muted uppercase">Painel</p>
          <h1 className="font-display text-3xl tracking-tight">Admin</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Adicione, edite e exclua animes, temporadas e episódios. Este painel é exclusivo do administrador.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/admin/$id" params={{ id: "new" }}>
              <Plus className="size-4" />
              Novo anime
            </Link>
          </Button>
          <Button type="button" variant="outline" onClick={exportJson}>
            <Download className="size-4" />
            Exportar
          </Button>
          <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md px-4 text-sm font-medium shadow-[var(--shadow-border)] hover:bg-elevated">
            <Upload className="size-4" />
            Importar JSON
            <input
              type="file"
              accept="application/json"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImportFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </header>

      <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-5">
        <h2 className="font-display text-lg">Importar do AniList</h2>
        <p className="mt-1 text-sm text-muted">
          Busque um título oficial e traga capa, sinopse e gêneros. Depois acrescente URLs de
          episódio.
        </p>
        <form className="mt-4 flex gap-2" onSubmit={runImportSearch}>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
            <Input
              value={importQ}
              onChange={(e) => setImportQ(e.target.value)}
              placeholder="Ex.: Frieren, Dandadan, One Piece"
              className="pl-10"
            />
          </div>
          <Button type="submit" disabled={searching}>
            {searching ? "Buscando…" : "Buscar"}
          </Button>
        </form>
        {hits.length > 0 && (
          <ul className="mt-4 divide-y divide-border">
            {hits.slice(0, 8).map((hit) => (
              <li key={hit.id} className="flex items-center gap-3 py-3">
                <div className="h-14 w-10 shrink-0 overflow-hidden rounded-sm bg-elevated">
                  {hit.cover && <img src={hit.cover} alt="" className="size-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{displayTitle(hit)}</p>
                  <p className="truncate text-xs text-muted">
                    {hit.year ?? ""} {hit.genres.slice(0, 2).join(" · ")}
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => importHit(hit)}>
                  Importar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg">Seu catálogo ({animes.length})</h2>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrar"
            className="max-w-48"
          />
        </div>
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            Nenhum título local ainda. Importe do AniList ou crie um do zero.
          </p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-lg bg-surface p-2 shadow-[var(--shadow-border)]"
              >
                <div className="h-16 w-12 shrink-0 overflow-hidden rounded-md bg-elevated">
                  {a.cover && <img src={a.cover} alt="" className="size-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {a.titleEnglish || a.titleRomaji || a.titleNative}
                    {a.hidden && <span className="ml-2 text-xs text-subtle">oculto</span>}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {a.seasons.reduce((n, s) => n + s.episodes.length, 0)} eps
                    {a.anilistId ? ` · AniList ${a.anilistId}` : " · original"}
                  </p>
                </div>
                <Button asChild size="sm" variant="ghost">
                  <Link to="/admin/$id" params={{ id: a.id }}>
                    Editar
                  </Link>
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Excluir"
                  onClick={() => setPendingDelete(a.id)}
                >
                  <Trash2 className="size-4 text-danger" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={Boolean(pendingDelete)} onOpenChange={() => setPendingDelete(null)}>
        <DialogContent>
          <DialogTitle>Excluir anime?</DialogTitle>
          <DialogDescription>
            Temporadas e episódios deste título saem do catálogo local. O AniList continua
            disponível.
          </DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setPendingDelete(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                if (pendingDelete) removeAnime(pendingDelete);
                setPendingDelete(null);
                toast.success("Removido.");
              }}
            >
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
