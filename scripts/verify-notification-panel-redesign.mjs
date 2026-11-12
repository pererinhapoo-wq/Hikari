import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { toCrossJSON } from "seroval";

const BASE_URL = "http://127.0.0.1:3000";
const EXEC_PATH =
  "/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell";
const SCREENSHOTS_DIR = path.resolve(process.cwd(), "screenshots");

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

function parseServerFnExport(url) {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split("/_serverFn/");
    if (parts.length < 2) return null;
    const raw = parts[1].split("?")[0];
    const decoded = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    return decoded?.export ?? null;
  } catch {
    return null;
  }
}

function buildDataset(total = 35) {
  const baseTime = Date.UTC(2026, 10, 12, 20, 0, 0);
  const list = [
    {
      id: "notif-1-req",
      type: "follow_request",
      message: "Naruto Uzumaki solicitou para seguir você.",
      read: false,
      createdAt: new Date(baseTime).toISOString(),
      actorId: "actor_naruto",
      actorName: "Naruto Uzumaki",
      actorNick: "naruto_u",
      actorImage: null,
      commentId: null,
      animeId: null,
      episodeId: null,
      isFollowingActor: false,
      hasPendingFollowRequestToActor: false,
    },
    {
      id: "notif-2-req",
      type: "follow_request",
      message: "Sasuke Uchiha solicitou para seguir você.",
      read: false,
      createdAt: new Date(baseTime - 60_000).toISOString(),
      actorId: "actor_sasuke",
      actorName: "Sasuke Uchiha",
      actorNick: "sasuke_u",
      actorImage: null,
      commentId: null,
      animeId: null,
      episodeId: null,
      isFollowingActor: false,
      hasPendingFollowRequestToActor: false,
    },
    {
      id: "notif-3-follower",
      type: "new_follower",
      message: "Hinata Hyuga começou a seguir você.",
      read: false,
      createdAt: new Date(baseTime - 120_000).toISOString(),
      actorId: "actor_hinata",
      actorName: "Hinata Hyuga",
      actorNick: "hinata_h",
      actorImage: null,
      commentId: null,
      animeId: null,
      episodeId: null,
      isFollowingActor: false,
      hasPendingFollowRequestToActor: false,
    },
    {
      id: "notif-4-reply",
      type: "comment_reply",
      message: "Sakura Haruno respondeu ao seu comentário.",
      read: false,
      createdAt: new Date(baseTime - 180_000).toISOString(),
      actorId: "actor_sakura",
      actorName: "Sakura Haruno",
      actorNick: "sakura_h",
      actorImage: null,
      commentId: "cmt-reply-4",
      animeId: "solo-leveling",
      episodeId: "ep-1",
      animeTitle: "Solo Leveling",
      animeCover: null,
      animeSeasonNumber: 1,
      commentContent: "Essa cena com a trilha sonora ficou absurda demais!",
      commentHasMedia: false,
      commentIsSpoiler: false,
      parentCommentId: "cmt-orig-4",
      parentCommentContent: "A animação dessa luta superou todas as expectativas.",
      parentCommentHasMedia: false,
      parentCommentIsSpoiler: false,
      parentCommentAuthorName: "Você",
      isFollowingActor: false,
      hasPendingFollowRequestToActor: false,
    },
    {
      id: "notif-5-like",
      type: "comment_like",
      message: "Kakashi Hatake e mais 3 pessoas curtiram seu comentário.",
      read: true,
      createdAt: new Date(baseTime - 240_000).toISOString(),
      actorId: "actor_kakashi",
      actorName: "Kakashi Hatake",
      actorNick: "kakashi_h",
      actorImage: null,
      commentId: "cmt-like-5",
      animeId: "frieren",
      episodeId: "ep-4",
      animeTitle: "Frieren: Beyond Journey's End",
      animeCover: null,
      animeSeasonNumber: 1,
      commentContent: "Direção de arte e trilha sonora impecáveis nesse episódio.",
      commentHasMedia: false,
      commentIsSpoiler: false,
      commentLikes: 4,
      likeAvatars: [
        { id: "u1", name: "Kakashi Hatake", nick: "kakashi_h", image: null },
        { id: "u2", name: "Shikamaru Nara", nick: "shika_n", image: null },
        { id: "u3", name: "Ino Yamanaka", nick: "ino_y", image: null },
      ],
      isFollowingActor: false,
      hasPendingFollowRequestToActor: false,
    },
  ];

  for (let i = list.length; i < total; i++) {
    list.push({
      id: `notif-hist-${i + 1}`,
      type: "comment_reply",
      message: `Membro ${i + 1} respondeu ao seu comentário.`,
      read: true,
      createdAt: new Date(baseTime - (i + 1) * 60_000).toISOString(),
      actorId: `actor_hist_${i + 1}`,
      actorName: `Membro ${i + 1}`,
      actorNick: `membro_${i + 1}`,
      actorImage: null,
      commentId: `cmt-hist-${i + 1}`,
      animeId: "frieren",
      episodeId: `ep-${(i % 12) + 1}`,
      animeTitle: "Frieren: Beyond Journey's End",
      animeCover: null,
      animeSeasonNumber: 1,
      commentContent: `Comentário histórico #${i + 1} para validação do carregamento automático por lotes.`,
      commentHasMedia: false,
      commentIsSpoiler: false,
      parentCommentId: null,
      parentCommentContent: null,
      parentCommentHasMedia: false,
      parentCommentIsSpoiler: false,
      parentCommentAuthorName: null,
      isFollowingActor: false,
      hasPendingFollowRequestToActor: false,
    });
  }

  return list;
}

async function main() {
  const browser = await chromium.launch({
    executablePath: EXEC_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const consoleErrors = [];
  const pageErrors = [];

  try {
    // -----------------------------------------------------------------------
    // PARTE A: Painel real contra o servidor em execução
    // -----------------------------------------------------------------------
    {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
      });
      const page = await context.newPage();
      await page.route("**/pagead2.googlesyndication.com/**", (route) =>
        route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
      );
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(`[A] ${msg.text()}`);
      });
      page.on("pageerror", (err) => pageErrors.push(`[A] ${err.message}`));

      await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      await page.locator("button[aria-label='Notificações']").click();
      await page.waitForTimeout(600);

      const dialog = page.locator("[role='dialog'][aria-label='Painel de notificações']");
      await dialog.waitFor({ state: "visible" });
      const box = await dialog.boundingBox();
      assert.ok(box && box.width <= 385, `Largura do painel deve permanecer compacta (recebido ${box?.width})`);
      assert.ok(box && box.height <= 490, `Altura do painel deve permanecer compacta (recebido ${box?.height})`);

      const panelText = await dialog.innerText();
      assert.equal(panelText.includes("Ver todas as notificações"), false, "Botão 'Ver todas as notificações' removido");
      assert.equal(panelText.includes("Carregar mais"), false, "Botão 'Carregar mais' não existe");
      assert.equal(panelText.includes("Ver comentário"), false, "'Ver comentário' removido");
      assert.equal(panelText.includes("Ver perfil"), false, "'Ver perfil' removido");

      await context.close();
      console.log("✓ PARTE A PASSOU: Painel real compacto, sem botões removidos e sem erros.");
    }

    // -----------------------------------------------------------------------
    // PARTE B: Lotes automáticos (35 itens), ações, ordem cronológica e mobile
    // -----------------------------------------------------------------------
    {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
      });
      const page = await context.newPage();
      await page.route("**/pagead2.googlesyndication.com/**", (route) =>
        route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
      );
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(`[B] ${msg.text()}`);
      });
      page.on("pageerror", (err) => pageErrors.push(`[B] ${err.message}`));

      const dataset = buildDataset(35);
      const getRequests = [];
      let acceptCalled = false;
      let rejectCalled = false;
      let followBackCalled = false;

      await page.route("**/api/notifications**", async (route) => {
        const req = route.request();
        const method = req.method();

        if (method === "GET") {
          const url = new URL(req.url());
          const limit = Number(url.searchParams.get("limit") ?? 10);
          const offset = Number(url.searchParams.get("offset") ?? 0);
          getRequests.push({ limit, offset });

          const slice = dataset.slice(offset, offset + limit);
          const hasMore = offset + slice.length < dataset.length;
          const unreadCount = dataset.filter((n) => !n.read).length;

          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              notifications: slice,
              unreadCount,
              totalCount: dataset.length,
              hasMore,
              limit,
              offset,
              nextOffset: offset + slice.length,
            }),
          });
        }

        if (method === "PATCH") {
          const body = req.postDataJSON() ?? {};
          if (body?.all) {
            dataset.forEach((n) => {
              n.read = true;
            });
          } else if (Array.isArray(body?.ids)) {
            const ids = new Set(body.ids);
            dataset.forEach((n) => {
              if (ids.has(n.id)) n.read = true;
            });
          } else if (typeof body?.id === "string") {
            dataset.forEach((n) => {
              if (n.id === body.id) n.read = true;
            });
          }
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ok: true,
              unreadCount: dataset.filter((n) => !n.read).length,
            }),
          });
        }

        return route.continue();
      });

      await page.route("**/api/profile/follow**", async (route) => {
        followBackCalled = true;
        const target = dataset.find((n) => n.id === "notif-3-follower");
        if (target) target.isFollowingActor = true;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, status: "following" }),
        });
      });

      await page.route("**/_serverFn/**", async (route) => {
        const exportName = parseServerFnExport(route.request().url()) || "";
        if (exportName.startsWith("acceptFollowRequest")) {
          acceptCalled = true;
          return route.fulfill({
            status: 200,
            headers: { "content-type": "application/json", "x-tss-serialized": "true" },
            body: JSON.stringify(toCrossJSON({ result: { success: true } })),
          });
        }
        if (exportName.startsWith("rejectFollowRequest")) {
          rejectCalled = true;
          return route.fulfill({
            status: 200,
            headers: { "content-type": "application/json", "x-tss-serialized": "true" },
            body: JSON.stringify(toCrossJSON({ result: { success: true } })),
          });
        }
        return route.continue();
      });

      await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      // Abrir painel
      await page.locator("button[aria-label='Notificações']").click();
      await page.waitForTimeout(600);

      const dialog = page.locator("[role='dialog'][aria-label='Painel de notificações']");
      await dialog.waitFor({ state: "visible" });

      // Verificar apenas lote inicial (10 itens) carregado no início
      assert.ok(getRequests.every((r) => r.offset === 0 && r.limit === 10), "Apenas lote inicial (offset=0, limit=10) carregado inicialmente");

      const desktopBox = await dialog.boundingBox();
      assert.ok(desktopBox && desktopBox.width <= 385, `Largura desktop compacta: ${desktopBox?.width}`);
      assert.ok(desktopBox && desktopBox.height <= 490, `Altura desktop compacta: ${desktopBox?.height}`);

      // Screenshot desktop do painel redesenhado
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "panel_redesign_desktop.png") });

      // Conferir remoção de textos proibidos e presença das informações essenciais
      const initialText = await dialog.innerText();
      assert.equal(initialText.includes("Ver todas as notificações"), false, "Sem 'Ver todas as notificações'");
      assert.equal(initialText.includes("Carregar mais"), false, "Sem 'Carregar mais'");
      assert.equal(initialText.includes("Ver comentário"), false, "Sem 'Ver comentário'");
      assert.equal(initialText.includes("Ver perfil"), false, "Sem 'Ver perfil'");
      assert.ok(initialText.includes("Naruto Uzumaki"), "Nome preservado");
      assert.ok(initialText.includes("Solo Leveling"), "Anime preservado");
      assert.ok(initialText.includes("Episódio 1"), "Episódio preservado");
      assert.ok(initialText.includes("Essa cena com a trilha sonora"), "Trecho do comentário preservado");

      // Contar itens iniciais renderizados (usando <time> por item)
      const initialRendered = await dialog.locator("time").count();
      assert.equal(initialRendered, 10, `Esperados 10 itens iniciais no painel, recebidos ${initialRendered}`);

      // Testar ações: Seguir de volta, Aceitar, Recusar
      await dialog.locator("button:has-text('Seguir de volta')").first().click();
      await page.waitForTimeout(250);
      assert.equal(followBackCalled, true, "Seguir de volta acionado");
      assert.ok((await dialog.innerText()).includes("Seguindo"), "Estado atualizado para Seguindo");

      await dialog.locator("button:has-text('Aceitar')").first().click();
      await page.waitForTimeout(250);
      assert.equal(acceptCalled, true, "Aceitar acionado");
      assert.ok((await dialog.innerText()).includes("Solicitação aceita"), "Feedback Solicitação aceita");

      await dialog.locator("button:has-text('Recusar')").first().click();
      await page.waitForTimeout(250);
      assert.equal(rejectCalled, true, "Recusar acionado");
      assert.ok((await dialog.innerText()).includes("Solicitação recusada"), "Feedback Solicitação recusada");

      // Testar carregamento automático progressivo ao rolar até o fim da lista (35 itens = 4 lotes: 0, 10, 20, 30)
      const scrollEl = dialog.locator("div.overflow-y-auto").first();

      for (const expectedCount of [20, 30, 35]) {
        await scrollEl.evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });
        await page.waitForFunction(
          (targetCount) => {
            const dlg = document.querySelector("[role='dialog'][aria-label='Painel de notificações']");
            return dlg && dlg.querySelectorAll("time").length >= targetCount;
          },
          expectedCount,
          { timeout: 5000 },
        );
      }

      // Aguardar para garantir ausência de loop infinito ou chamadas repetidas após fim da lista
      const countAfterAllBatches = getRequests.length;
      await page.waitForTimeout(700);
      assert.equal(
        getRequests.length,
        countAfterAllBatches,
        "Zero requisições adicionais após atingir o fim da lista (sem loop)",
      );

      // Conferir ausência de duplicação e ordem cronológica preservada
      const renderedTimes = await dialog.locator("time").evaluateAll((els) =>
        els.map((el) => ({
          dt: el.getAttribute("dateTime") || "",
          text: el.textContent || "",
        })),
      );
      assert.equal(renderedTimes.length, 35, "Todos os 35 itens carregados por lotes sem duplicação");
      const uniqueDates = new Set(renderedTimes.map((r) => r.dt));
      assert.equal(uniqueDates.size, 35, "Zero notificações duplicadas");
      for (let i = 1; i < renderedTimes.length; i++) {
        assert.ok(
          Date.parse(renderedTimes[i - 1].dt) >= Date.parse(renderedTimes[i].dt),
          `Ordem cronológica preservada no índice ${i}`,
        );
      }

      const offsetsFetched = getRequests.map((r) => r.offset);
      assert.ok(offsetsFetched.includes(10) && offsetsFetched.includes(20) && offsetsFetched.includes(30), `Offsets por lote executados: ${offsetsFetched.join(",")}`);
      assert.equal(offsetsFetched.filter((o) => o === 30).length, 1, "Último lote (offset=30) chamado apenas uma vez");

      // Voltar ao topo e verificar layout Mobile (390x844)
      await scrollEl.evaluate((el) => {
        el.scrollTop = 0;
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(300);

      const mobileBox = await dialog.boundingBox();
      assert.ok(mobileBox && mobileBox.width <= 370, `Largura mobile compacta: ${mobileBox?.width}`);
      assert.ok(mobileBox && mobileBox.height <= 500, `Altura mobile compacta: ${mobileBox?.height}`);
      const mobileOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      assert.equal(mobileOverflow, false, "Sem overflow horizontal no mobile");
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "panel_redesign_mobile.png") });

      await context.close();
      console.log("✓ PARTE B PASSOU: Redesign, remoção de rótulos, lotes automáticos (35 itens), ações e mobile validados.");
    }

    assert.equal(consoleErrors.length, 0, `Console errors: ${consoleErrors.join("; ")}`);
    assert.equal(pageErrors.length, 0, `Page errors: ${pageErrors.join("; ")}`);
    console.log("✓ Zero console/page errors!");
  } finally {
    await browser.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FALHA NA VERIFICAÇÃO DO PAINEL:", err);
    process.exit(1);
  });
