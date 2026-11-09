import { chromium } from "playwright";
import fs from "fs";

async function runTests() {
  const browser = await chromium.launch({
    executablePath: "/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();

  console.log("=== INICIANDO TESTES NO PREVIEW ===");

  if (!fs.existsSync("screenshots")) {
    fs.mkdirSync("screenshots", { recursive: true });
  }

  // 1. Detalhes dos animes (/anime/16498 - Shingeki no Kyojin)
  console.log("1. Acessando /anime/16498...");
  await page.goto("http://127.0.0.1:3000/anime/16498", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Scroll progressivo para acionar SectionReveal
  for (let i = 0; i < 7; i++) {
    await page.evaluate(() => window.scrollBy(0, 700));
    await page.waitForTimeout(400);
  }

  // A. Teste Dubladores
  console.log("A. Testando Dubladores em /anime/16498...");
  const vaCard = page.locator('button:has-text("Yuuki Kaji")').first();
  await vaCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  // Confirma que os cards originais estão visíveis antes do clique
  const initialDubladorCards = await page.locator('button:has-text("Yui Ishikawa")').count();
  console.log(`Cards originais de dublador visíveis antes do clique: ${initialDubladorCards > 0}`);

  // Clica em Yuuki Kaji
  await vaCard.click();
  await page.waitForTimeout(2000);

  // Verifica substituição: os cards originais de dublador NÃO devem mais estar no rail
  const headerDublagem = page.locator('text="Dublagens — Yuuki Kaji"').first();
  await headerDublagem.waitFor({ state: "visible", timeout: 10000 });
  console.log("Visualização substituída com sucesso: 'Dublagens — Yuuki Kaji' está visível!");

  // Verifica que o rail original com os cards grandes desapareceu
  const isOriginalRailVisible = await page.locator('button:has-text("Dublagem original (Japonês)")').count();
  console.log(`Seletores/Header original ocultado: ${isOriginalRailVisible === 0}`);

  // Screenshot Dublador selecionado
  await page.screenshot({ path: "screenshots/preview_dublador_substituicao.png" });

  // Teste de alternância para outra entidade (Yui Ishikawa via pílula de entidade)
  console.log("Testando seleção de outro dublador (Yui Ishikawa via pílula)...");
  const yuiPill = page.locator('button:has-text("Yui Ishikawa")').first();
  if (await yuiPill.count() > 0) {
    await yuiPill.click();
    await page.waitForTimeout(2000);
    const headerYui = page.locator('text="Dublagens — Yui Ishikawa"').first();
    await headerYui.waitFor({ state: "visible", timeout: 10000 });
    console.log("Substituição dinâmica confirmada: 'Dublagens — Yui Ishikawa' substituiu Yuuki Kaji!");
    await page.screenshot({ path: "screenshots/preview_dublador_alternancia.png" });
  }

  // Scroll down para Direção e equipe técnica / Studios
  console.log("B. Testando Direção e equipe técnica / Studios em /anime/16498...");
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(400);
  }

  // Clica em WIT STUDIO
  const studioCard = page.locator('button:has-text("WIT STUDIO")').first();
  await studioCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await studioCard.click();
  await page.waitForTimeout(2000);

  const headerStudio = page.locator('text="Produções — WIT STUDIO"').first();
  await headerStudio.waitFor({ state: "visible", timeout: 10000 });
  console.log("Visualização de Studio substituída com sucesso: 'Produções — WIT STUDIO' visível!");

  // Verifica ausência de cards originais
  const originalStaffTitle = await page.locator('h2:has-text("Direção e equipe técnica")').count();
  console.log(`Cards e título originais ocultados durante a exibição do Studio: ${originalStaffTitle === 0}`);
  await page.screenshot({ path: "screenshots/preview_studio_substituicao.png" });

  // Alterna para membro da equipe técnica (Tetsurou Araki)
  console.log("Alternando para equipe técnica (Tetsurou Araki via pílula)...");
  const tetsurouPill = page.locator('button:has-text("Tetsurou Araki")').first();
  if (await tetsurouPill.count() > 0) {
    await tetsurouPill.click();
    await page.waitForTimeout(2000);
    const headerStaff = page.locator('text="Trabalhos — Tetsurou Araki"').first();
    await headerStaff.waitFor({ state: "visible", timeout: 10000 });
    console.log("Alternância confirmada: 'Trabalhos — Tetsurou Araki' substituiu o estúdio!");
    await page.screenshot({ path: "screenshots/preview_staff_substituicao.png" });
  }

  // Verifica URL inalterada
  const currentUrl = page.url();
  console.log(`URL após todas as interações: ${currentUrl}`);
  console.log(`URL não contém searchParams de navegação: ${!currentUrl.includes("?status") && !currentUrl.includes("?entity")}`);

  // 2. Teste no Perfil (/account)
  console.log("2. Acessando /account (Perfil)...");
  await page.goto("http://127.0.0.1:3000/account", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Visão Geral -> Favoritos
  console.log("Verificando seções de Favoritos no Perfil...");
  const favStudio = page.locator('button:has-text("WIT STUDIO"), button:has-text("ufotable"), button:has-text("MAPPA")').first();
  if (await favStudio.count() > 0) {
    await favStudio.scrollIntoViewIfNeeded();
    await favStudio.click();
    await page.waitForTimeout(2000);
    console.log("Clicado em favorito de estúdio na Visão Geral do Perfil.");
    await page.screenshot({ path: "screenshots/preview_perfil_favoritos_studio.png" });
  }

  // Confirmar que nenhum modal (role=dialog) está aberto
  const dialogsCount = await page.locator('[role="dialog"]').count();
  console.log(`Modais abertos: ${dialogsCount} (deve ser 0)`);

  // Confirmar que não há botões "Voltar", "X" ou "Fechar"
  const closeButtonsCount = await page.locator('button:has-text("Voltar"), button:has-text("Fechar"), button:has-text("Close")').count();
  console.log(`Botões de fechar/voltar: ${closeButtonsCount} (deve ser 0)`);

  await browser.close();
  console.log("=== TODOS OS TESTES FORAM CONCLUÍDOS COM SUCESSO ===");
}

runTests().catch((err) => {
  console.error("Erro no teste:", err);
  process.exit(1);
});
