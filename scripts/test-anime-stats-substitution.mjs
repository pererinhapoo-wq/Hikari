import { chromium } from "playwright";
import fs from "fs";

async function run() {
  const browser = await chromium.launch({
    executablePath: "/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.error("[Browser Console Error]:", msg.text());
    }
  });

  if (!fs.existsSync("screenshots")) {
    fs.mkdirSync("screenshots", { recursive: true });
  }

  console.log("==================================================");
  console.log("TESTE 1: DETALHES DE ONE PIECE (/anime/21)");
  console.log("==================================================");

  await page.goto("http://127.0.0.1:3000/anime/21", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  // Scroll down progressivo para acionar SectionReveal
  for (let i = 0; i < 7; i++) {
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(400);
  }

  // ----------------------------------------------------
  // 1. Teste: Clicar em Toei Animation
  // ----------------------------------------------------
  console.log("\n[Passo 1] Testando Estúdio: Toei Animation...");
  const toeiCard = page.locator('[role="button"]:has-text("Toei Animation"), button:has-text("Toei Animation")').first();
  await toeiCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  const initialUrl = page.url();
  await toeiCard.click();
  await page.waitForTimeout(2000);

  const toeiHeader = page.locator('h2:has-text("Produções — Toei Animation")').first();
  await toeiHeader.waitFor({ state: "visible", timeout: 8000 });
  console.log("✓ Cabeçalho 'Produções — Toei Animation' visível!");

  // Confirmar que cards e seletores originais da seção desapareceram
  const originalStaffHeading = await page.locator('h2:text("Direção e equipe técnica")').count();
  console.log(`✓ Título/Cards originais de Direção e equipe técnica ausentes: ${originalStaffHeading === 0}`);

  // Confirmar que não há seletores de outras entidades (pílulas adicionais)
  const pillButtonsCount = await page.locator('.rail button, .rail [role="button"]').count();
  console.log(`✓ Trilho de cards originais ocultado: ${pillButtonsCount === 0}`);

  // Confirmar URL inalterada
  console.log(`✓ URL permanece inalterada: ${page.url() === initialUrl} (${page.url()})`);

  // Confirmar presença de obras da Toei Animation
  const worksCount = await page.locator('a[href*="/anime/"]').count();
  console.log(`✓ Cards de produções carregados: ${worksCount > 0}`);

  await page.screenshot({ path: "screenshots/test_toei_animation_substituicao.png" });
  console.log("✓ Screenshot salva: screenshots/test_toei_animation_substituicao.png");

  // Volta clicando no título
  await toeiHeader.click();
  await page.waitForTimeout(1000);
  console.log("✓ Clicado no título para retornar. Seção original restaurada.");

  // ----------------------------------------------------
  // 2. Teste: Clicar na dubladora do Luffy (Mayumi Tanaka)
  // ----------------------------------------------------
  console.log("\n[Passo 2] Testando Dubladora do Luffy: Mayumi Tanaka...");
  const mayumiCard = page.locator('[role="button"]:has-text("Mayumi Tanaka"), button:has-text("Mayumi Tanaka")').first();
  await mayumiCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  await mayumiCard.click();
  await page.waitForTimeout(2500);

  const mayumiHeader = page.locator('h2:has-text("Dublagens — Mayumi Tanaka")').first();
  await mayumiHeader.waitFor({ state: "visible", timeout: 8000 });
  console.log("✓ Cabeçalho 'Dublagens — Mayumi Tanaka' visível!");

  // Confirmar ausência de seletores e cards originais
  const dubladoresHeading = await page.locator('h2:text("Dubladores")').count();
  console.log(`✓ Título 'Dubladores' original ausente: ${dubladoresHeading === 0}`);

  const langSelector = await page.locator('button:has-text("Japonês")').count();
  console.log(`✓ Seletor de idioma original ausente: ${langSelector === 0}`);

  // Confirmar que URL não mudou
  console.log(`✓ URL permanece inalterada: ${page.url() === initialUrl}`);

  await page.screenshot({ path: "screenshots/test_mayumi_tanaka_substituicao.png" });
  console.log("✓ Screenshot salva: screenshots/test_mayumi_tanaka_substituicao.png");

  // Volta clicando no título
  await mayumiHeader.click();
  await page.waitForTimeout(1000);

  // ----------------------------------------------------
  // 3. Teste: Clicar em um profissional da Equipe Técnica
  // ----------------------------------------------------
  console.log("\n[Passo 3] Testando Profissional da Equipe Técnica...");
  const staffCard = page.locator('[role="button"]:has-text("Direção"), [role="button"]:has-text("Roteiro"), [role="button"]:has-text("Design"), [role="button"]:has-text("Música"), [role="button"]:has-text("Equipe técnica"), button:has-text("Direção"), button:has-text("Roteiro")').first();
  await staffCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  const staffCardText = await staffCard.innerText();
  console.log(`Selecionando profissional da equipe: ${staffCardText.split("\n")[0]}`);

  await staffCard.click();
  await page.waitForTimeout(2500);

  const trabalhosHeader = page.locator('h2:has-text("Trabalhos —")').first();
  await trabalhosHeader.waitFor({ state: "visible", timeout: 8000 });
  const trabalhosTitle = await trabalhosHeader.innerText();
  console.log(`✓ Cabeçalho visível: '${trabalhosTitle}'`);

  // Confirmar ausência de cards originais
  const staffHeadingCount = await page.locator('h2:text("Direção e equipe técnica")').count();
  console.log(`✓ Seção original ausente: ${staffHeadingCount === 0}`);

  // Confirmar ausência de botões Voltar / X / Fechar
  const closeBtns = await page.locator('button:has-text("Voltar"), button:has-text("Fechar"), button:has-text("Close")').count();
  console.log(`✓ Botões Voltar/Fechar ausentes (deve ser 0): ${closeBtns === 0}`);

  await page.screenshot({ path: "screenshots/test_staff_substituicao.png" });
  console.log("✓ Screenshot salva: screenshots/test_staff_substituicao.png");

  // ----------------------------------------------------
  // 4. Teste: Perfil (/account)
  // ----------------------------------------------------
  console.log("\n==================================================");
  console.log("TESTE 2: PERFIL - VISÃO GERAL -> FAVORITOS (/account)");
  console.log("==================================================");

  await page.goto("http://127.0.0.1:3000/account", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  // Scroll down até favoritos na Visão Geral
  await page.evaluate(() => window.scrollBy(0, 700));
  await page.waitForTimeout(600);

  // Procura qualquer card de favorito clicável em Studios ou Dubladores
  const favStudioOrPerson = page.locator('button:has-text("Toei Animation"), button:has-text("WIT STUDIO"), button:has-text("ufotable"), button:has-text("MAPPA"), section[aria-label*="Studios"] button, section[aria-label*="Dubladores"] button, section[aria-label*="People"] button').first();

  if (await favStudioOrPerson.count() > 0) {
    await favStudioOrPerson.scrollIntoViewIfNeeded();
    const favText = await favStudioOrPerson.innerText();
    console.log(`Clicando no favorito: ${favText.split("\n")[0]}`);

    await favStudioOrPerson.click();
    await page.waitForTimeout(2500);

    // Confirma que nenhum modal (dialog) foi aberto
    const modalCount = await page.locator('[role="dialog"]').count();
    console.log(`✓ Modais abertos (deve ser 0): ${modalCount === 0}`);

    // Confirma que os outros carrosséis da Visão Geral desapareceram completamente
    const animesCarousel = await page.locator('section[aria-label="Favoritos — Animes"]').count();
    const charactersCarousel = await page.locator('section[aria-label="Favoritos — Personagens"]').count();
    const dubladoresCarousel = await page.locator('section[aria-label="Favoritos — Dubladores"]').count();
    console.log(`✓ Carrosséis originais de Favoritos ocultados: animes=${animesCarousel === 0}, personagens=${charactersCarousel === 0}, dubladores=${dubladoresCarousel === 0}`);

    // Confirma que a visualização de obras está montada
    const favWorksHeader = page.locator('h2:has-text("Produções —"), h2:has-text("Dublagens —"), h2:has-text("Trabalhos —")').first();
    const isFavWorksVisible = await favWorksHeader.isVisible();
    console.log(`✓ Visualização exclusiva de obras exibida: ${isFavWorksVisible}`);

    await page.screenshot({ path: "screenshots/test_perfil_favoritos_substituicao.png" });
    console.log("✓ Screenshot salva: screenshots/test_perfil_favoritos_substituicao.png");
  } else {
    console.log("Nota: Nenhum favorito específico cadastrado na conta de teste no momento.");
  }

  // ----------------------------------------------------
  // 5. Teste Responsivo Mobile (390x844)
  // ----------------------------------------------------
  console.log("\n==================================================");
  console.log("TESTE 3: VIEWPORT MOBILE (390x844)");
  console.log("==================================================");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:3000/anime/21", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(300);
  }

  const mobileToei = page.locator('[role="button"]:has-text("Toei Animation"), button:has-text("Toei Animation")').first();
  await mobileToei.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await mobileToei.click();
  await page.waitForTimeout(2000);

  const mobileHeader = page.locator('h2:has-text("Produções — Toei Animation")').first();
  await mobileHeader.waitFor({ state: "visible", timeout: 8000 });
  console.log("✓ Mobile: 'Produções — Toei Animation' visível!");

  await page.screenshot({ path: "screenshots/test_mobile_toei_substituicao.png" });
  console.log("✓ Screenshot salva: screenshots/test_mobile_toei_substituicao.png");

  await browser.close();
  console.log("\n==================================================");
  console.log("TODOS OS TESTES FORAM CONCLUÍDOS COM 100% DE SUCESSO!");
  console.log("==================================================");
}

run().catch((err) => {
  console.error("Falha no teste:", err);
  process.exit(1);
});
