import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

async function launchBrowser() {
  try {
    return await chromium.launch({
      executablePath:
        "/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  } catch {
    return await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  }
}

async function runE2E() {
  mkdirSync("screenshots", { recursive: true });
  const browser = await launchBrowser();

  try {
    console.log("=== ETAPA 4 E2E (DESKTOP 1280x800 + MOBILE 390x844) ===");

    // 0. Verificar que visitante não autenticado em /account redireciona para /login sem travar em skeleton
    {
      const anonCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const anonPage = await anonCtx.newPage();
      await anonPage.goto("http://127.0.0.1:3000/account", { waitUntil: "networkidle" });
      await anonPage.waitForURL(/\/login/, { timeout: 10000 });
      assert.ok(
        anonPage.url().includes("/login"),
        `Visitante não autenticado em /account deve redirecionar para /login (atual: ${anonPage.url()})`,
      );
      console.log("✓ Visitante sem sessão em /account redireciona imediatamente para /login");
      await anonCtx.close();
    }

    const desktopCtx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    await desktopCtx.addInitScript(() => {
      try {
        window.sessionStorage.setItem("hikari_preview_admin_email", "dev@example.com");
      } catch {
        /* ignore */
      }
    });
    const page = await desktopCtx.newPage();

    const pageErrors = [];
    const serverRequests = [];

    page.on("pageerror", (err) => {
      pageErrors.push(String(err));
    });
    page.on("request", (req) => {
      const u = req.url();
      if (u.includes("/_serverFn") || u.includes("/_server")) {
        serverRequests.push({
          method: req.method(),
          url: u.replace(/^http:\/\/[^/]+/, ""),
          ts: Date.now(),
        });
      }
    });

    // 1. Abertura de /account na Visão Geral
    await page.goto("http://127.0.0.1:3000/account", { waitUntil: "networkidle" });
    await page.waitForSelector("h1", { timeout: 15000 });
    await page.waitForTimeout(800);

    const bodyText = await page.evaluate(() => document.body.innerText);
    assert.ok(bodyText.includes("Visão Geral"), "Deve renderizar aba Visão Geral em /account");
    assert.ok(
      bodyText.includes("Estatísticas") || bodyText.includes("Animes"),
      "Deve renderizar seção de estatísticas",
    );

    const initialCallCount = serverRequests.length;
    console.log(
      `[Desktop /account] Chamadas /_server client-side na abertura inicial (antes do scroll): ${initialCallCount}`,
    );

    await page.screenshot({ path: "screenshots/etapa4-account-desktop-top.png", fullPage: false });

    // 2. Rolar para baixo até Atividades Recentes para disparar IntersectionObserver
    serverRequests.length = 0;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1200);

    const scrollLazyCalls = serverRequests.length;
    console.log(
      `[Desktop /account] Chamadas /_server após scroll para Atividades Recentes: ${scrollLazyCalls}`,
    );
    await page.screenshot({
      path: "screenshots/etapa4-account-desktop-scrolled.png",
      fullPage: false,
    });

    // 3. Alternar para aba Comentários -> não deve refazer requisição duplicada se já carregado
    serverRequests.length = 0;
    const commentsTabBtn = page.getByRole("button", { name: /Comentários/i }).first();
    await commentsTabBtn.click();
    await page.waitForTimeout(700);
    const commentsTabCalls = serverRequests.length;
    console.log(
      `[Desktop /account] Chamadas ao abrir Comentários após carregamento progressivo: ${commentsTabCalls}`,
    );
    assert.equal(
      commentsTabCalls,
      0,
      "Alternar para Comentários após carregamento progressivo não deve refazer query",
    );

    // 4. Alternar para aba Atividades e voltar para Visão Geral -> sem loops/refetches redundantes
    serverRequests.length = 0;
    const activityTabBtn = page.getByRole("button", { name: /Atividades/i }).first();
    await activityTabBtn.click();
    await page.waitForTimeout(700);
    const activityTabCalls = serverRequests.length;
    console.log(`[Desktop /account] Chamadas ao abrir aba Atividades: ${activityTabCalls}`);
    assert.ok(
      activityTabCalls <= 1,
      "Aba Atividades deve fazer no máximo 1 chamada (upgrade) ou 0 se !hasMore",
    );

    serverRequests.length = 0;
    const overviewTabBtn = page.getByRole("button", { name: /Visão Geral/i }).first();
    await overviewTabBtn.click();
    await page.waitForTimeout(500);
    assert.equal(
      serverRequests.length,
      0,
      "Voltar para Visão Geral não deve disparar chamadas redundantes",
    );

    // 5. Navegação direta com ?tab=comments, ?tab=activity, ?status=watching
    await page.goto("http://127.0.0.1:3000/account?tab=comments", { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    const tabCommentsText = await page.evaluate(() => document.body.innerText);
    assert.ok(
      tabCommentsText.includes("Comentários") &&
        (tabCommentsText.includes("Nenhum comentário") ||
          tabCommentsText.toLowerCase().includes("comentário")),
      "Deep-link ?tab=comments deve carregar conteúdo de comentários",
    );

    await page.goto("http://127.0.0.1:3000/account?tab=activity", { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    const tabActivityText = await page.evaluate(() => document.body.innerText);
    assert.ok(
      tabActivityText.includes("Atividades"),
      "Deep-link ?tab=activity deve exibir aba Atividades",
    );

    await page.goto("http://127.0.0.1:3000/account?status=watching", { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    const statusText = await page.evaluate(() => document.body.innerText);
    assert.ok(
      statusText.includes("Animes — Assistindo"),
      "Parâmetro ?status=watching deve continuar funcionando",
    );

    // 6. Redirecionamento do próprio perfil público /profile/<nick> -> /account
    await page.goto("http://127.0.0.1:3000/account", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const myNick = await page.evaluate(() => {
      const m = document.body.innerText.match(/@([a-z0-9_]+)/i);
      return m ? m[1] : null;
    });
    if (myNick) {
      await page.goto(`http://127.0.0.1:3000/profile/${myNick}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(800);
      assert.ok(
        page.url().includes("/account"),
        `Acessar próprio perfil /profile/${myNick} deve redirecionar para /account (atual: ${page.url()})`,
      );
      console.log(`✓ Redirecionamento /profile/${myNick} -> /account verificado`);
    }

    // 7. Perfil inexistente não quebra SSR/cliente
    await page.goto("http://127.0.0.1:3000/profile/usuario_inexistente_etapa4_999", {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(600);
    const notFoundText = await page.evaluate(() => document.body.innerText);
    assert.ok(
      notFoundText.includes("não encontrado") ||
        notFoundText.includes("não existe") ||
        notFoundText.includes("indisponível"),
      "Perfil inexistente deve exibir estado gracioso",
    );

    // 8. Mobile 390x844 sem overflow horizontal
    const mobileCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
    });
    await mobileCtx.addInitScript(() => {
      try {
        window.sessionStorage.setItem("hikari_preview_admin_email", "dev@example.com");
      } catch {
        /* ignore */
      }
    });
    const mobilePage = await mobileCtx.newPage();
    mobilePage.on("pageerror", (err) => pageErrors.push(String(err)));

    await mobilePage.goto("http://127.0.0.1:3000/account", { waitUntil: "networkidle" });
    await mobilePage.waitForSelector("h1", { timeout: 15000 });
    await mobilePage.waitForTimeout(800);
    const mobileOverflow = await mobilePage.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    assert.equal(mobileOverflow, false, "Mobile 390x844 não deve ter overflow horizontal em /account");
    await mobilePage.screenshot({ path: "screenshots/etapa4-account-mobile.png", fullPage: false });

    assert.equal(pageErrors.length, 0, `Erros de runtime no navegador: ${pageErrors.join("; ")}`);
    console.log("✓ E2E Desktop e Mobile concluído com 0 erros de página e screenshots gerados!");
  } finally {
    await browser.close();
  }
}

runE2E().catch((err) => {
  console.error("ERRO NO E2E ETAPA 4:", err);
  process.exit(1);
});
