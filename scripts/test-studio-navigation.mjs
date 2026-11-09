import { chromium } from "playwright";
import fs from "fs";

async function run() {
  console.log("Iniciando teste de navegação e visualização de Studios...");
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const results = {
    step1_animeDetailsLoaded: false,
    step2_toeiClicked: false,
    step3_urlHasStudioParam: false,
    step4_studioProductionsViewRendered: false,
    step5_animeDetailsHidden: false,
    step6_reloadPreservesStudioView: false,
    step7_browserBackRestoresAnimeDetails: false,
    step8_browserForwardRestoresStudioView: false,
    worksCount: 0,
    errors: [],
  };

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`[Browser Console Error] ${msg.text()}`);
    }
  });

  try {
    // 1. Abrir detalhes de One Piece
    console.log("Navegando para /anime/21 (One Piece)...");
    await page.goto("http://127.0.0.1:3000/anime/21", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    const mainTitle = await page.locator("h1").first().textContent();
    console.log("Título principal da página:", mainTitle);
    if (mainTitle && mainTitle.toLowerCase().includes("one piece")) {
      results.step1_animeDetailsLoaded = true;
    }

    // Scroll down progressivo para acionar SectionReveal
    console.log("Rolando a página para acionar SectionReveal...");
    for (let i = 0; i < 7; i++) {
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(400);
    }

    // Rolar até a seção de Direção e equipe técnica onde está o card do Studio Toei Animation
    console.log("Procurando o card de Toei Animation...");
    const toeiCard = page.locator('[role="button"]:has-text("Toei Animation"), button:has-text("Toei Animation")').first();
    await toeiCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);

    // Tirar screenshot antes do clique
    await page.screenshot({ path: "screenshots/test_studio_before_click.png" });

    // 2. Clicar em Toei Animation
    console.log("Clicando no card de Toei Animation...");
    await toeiCard.click();
    results.step2_toeiClicked = true;

    // Aguardar atualização de URL e renderização da visualização do estúdio
    await page.waitForTimeout(2500);

    // 3. Confirmar searchParams na URL
    const currentUrl = page.url();
    console.log("URL após clique em Toei Animation:", currentUrl);
    if (currentUrl.includes("studio=Toei") || currentUrl.includes("studio=Toei+Animation") || currentUrl.includes("studio=Toei%20Animation")) {
      results.step3_urlHasStudioParam = true;
    }

    // 4. Confirmar que a visualização própria do Studio foi aberta
    const studioTitleLocator = page.locator('h1:has-text("Produções — Toei Animation"), h2:has-text("Produções — Toei Animation")');
    const isStudioTitleVisible = await studioTitleLocator.isVisible();
    console.log("Título 'Produções — Toei Animation' visível:", isStudioTitleVisible);
    if (isStudioTitleVisible) {
      results.step4_studioProductionsViewRendered = true;
    }

    // Verificar contador de resultados
    const countBadge = page.locator('span.tabular-nums:has-text("25"), span.tabular-nums').first();
    const countText = await countBadge.textContent().catch(() => "");
    console.log("Contador exibido:", countText);
    results.worksCount = parseInt(countText || "0", 10);

    // 5. Confirmar que os detalhes de One Piece (episódios, sinopse, elenco) NÃO continuam visíveis junto
    const episodesSectionVisible = await page.locator('text="Episódios"').isVisible().catch(() => false);
    const synopsisVisible = await page.locator('text="Gol D. Roger"').isVisible().catch(() => false);
    console.log("Episódios de One Piece visíveis junto:", episodesSectionVisible);
    console.log("Sinopse de One Piece visível junto:", synopsisVisible);

    if (!episodesSectionVisible && !synopsisVisible) {
      results.step5_animeDetailsHidden = true;
    }

    // Screenshot da visualização de produções da Toei
    await page.screenshot({ path: "screenshots/test_toei_productions_view.png" });

    // 6. Testar atualização da página (F5 reload)
    console.log("Recarregando a página (F5) para confirmar persistência via URL...");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    const isStudioTitleVisibleAfterReload = await studioTitleLocator.isVisible();
    const reloadUrl = page.url();
    console.log("URL após reload:", reloadUrl);
    console.log("Título do Studio visível após reload:", isStudioTitleVisibleAfterReload);
    if (isStudioTitleVisibleAfterReload && reloadUrl.includes("studio=")) {
      results.step6_reloadPreservesStudioView = true;
    }

    // 7. Testar navegação pelo histórico (Browser Back)
    console.log("Testando botão Voltar do navegador (page.goBack())...");
    await page.goBack({ waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    const backUrl = page.url();
    console.log("URL após goBack():", backUrl);
    const mainTitleAfterBack = await page.locator("h1").first().textContent();
    console.log("Título após goBack():", mainTitleAfterBack);
    const studioTitleAfterBack = await studioTitleLocator.isVisible().catch(() => false);

    if (!studioTitleAfterBack && mainTitleAfterBack && mainTitleAfterBack.toLowerCase().includes("one piece")) {
      results.step7_browserBackRestoresAnimeDetails = true;
    }

    // 8. Testar navegação pelo histórico (Browser Forward)
    console.log("Testando botão Avançar do navegador (page.goForward())...");
    await page.goForward({ waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    const forwardUrl = page.url();
    console.log("URL após goForward():", forwardUrl);
    const studioTitleAfterForward = await studioTitleLocator.isVisible();
    if (studioTitleAfterForward && forwardUrl.includes("studio=")) {
      results.step8_browserForwardRestoresStudioView = true;
    }

    // Screenshot final
    await page.screenshot({ path: "screenshots/test_toei_forward_view.png" });

  } catch (err) {
    console.error("Erro durante execução do teste:", err);
    results.errors.push(String(err));
  } finally {
    await browser.close();
  }

  console.log("--- RESULTADOS FINAIS DO TESTE ---");
  console.log(JSON.stringify(results, null, 2));
}

run();
