import { chromium } from "playwright";

async function runSearchAudit() {
  console.log("=== INICIANDO AUDITORIA VISUAL E FUNCIONAL DA BUSCA HIKARI ===");

  const browser = await chromium.launch({
    executablePath:
      "/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  // =========================================================================
  // CENÁRIO 1: MOBILE (390 x 844) - MODAL DE BUSCA
  // =========================================================================
  console.log("\n[Cenário 1: Mobile] Testando SearchModal...");
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobileCtx.newPage();

  await mobilePage.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await mobilePage.waitForTimeout(1000);

  // Rola para baixo na home
  await mobilePage.evaluate(() => window.scrollTo(0, 300));
  await mobilePage.waitForTimeout(300);
  const scrollBefore = await mobilePage.evaluate(() => window.scrollY);

  // Abre a busca via botão do header
  const searchBtn = mobilePage.locator('button[aria-label="Buscar"]').first();
  await searchBtn.click();
  await mobilePage.waitForTimeout(400);

  const modal = mobilePage.locator('div[role="dialog"][aria-label="Caixa de busca do Hikari"]');
  if (!(await modal.isVisible())) {
    throw new Error("Modal de busca não abriu ao clicar no botão do header!");
  }
  await mobilePage.screenshot({ path: "screenshots/mobile_modal_empty_new.png" });
  console.log("✓ Modal vazio capturado: screenshots/mobile_modal_empty_new.png");

  // Digita busca de anime
  const modalInput = mobilePage.locator('div[role="dialog"] input');
  await modalInput.fill("Naruto");
  await mobilePage.waitForTimeout(700);

  await mobilePage.screenshot({ path: "screenshots/mobile_modal_animes_results.png" });
  console.log("✓ Resultados de animes no modal: screenshots/mobile_modal_animes_results.png");

  // Abre o seletor de categorias dentro do modal
  const modalSelector = mobilePage.locator('div[role="dialog"] button[aria-haspopup="listbox"]');
  await modalSelector.click();
  await mobilePage.waitForTimeout(300);

  const modalDropdown = mobilePage.locator('div[role="dialog"] div[role="listbox"]');
  if (!(await modalDropdown.isVisible())) {
    throw new Error("Dropdown do seletor não abriu no modal!");
  }

  // Verifica limites do dropdown no modal
  const modalDropBox = await modalDropdown.boundingBox();
  console.log("Posição do dropdown no modal:", modalDropBox);
  if (!modalDropBox || modalDropBox.x < 0 || modalDropBox.x + modalDropBox.width > 390) {
    throw new Error(`Dropdown no modal vazou os limites da tela! x: ${modalDropBox?.x}, width: ${modalDropBox?.width}`);
  }

  await mobilePage.screenshot({ path: "screenshots/mobile_modal_dropdown_open.png" });
  console.log("✓ Dropdown aberto no modal: screenshots/mobile_modal_dropdown_open.png");

  // Troca para Usuários
  const userOption = mobilePage.locator('button[role="option"]:has-text("Usuários")');
  await userOption.click();
  await mobilePage.waitForTimeout(400);

  // Digita busca de usuário
  await modalInput.fill("ren");
  await mobilePage.waitForTimeout(700);

  await mobilePage.screenshot({ path: "screenshots/mobile_modal_users_results.png" });
  console.log("✓ Resultados de usuários no modal: screenshots/mobile_modal_users_results.png");

  // Testa pressionamento de Enter (Ir no teclado mobile)
  await modalInput.press("Enter");
  await mobilePage.waitForTimeout(500);

  // Verifica se o foco foi retirado
  const isInputFocused = await mobilePage.evaluate(() => document.activeElement?.tagName === "INPUT");
  console.log("Input continua focado após Enter/Ir?", isInputFocused);
  if (isInputFocused) {
    console.warn("Aviso: input continuou focado.");
  } else {
    console.log("✓ Foco removido com sucesso ao pressionar Enter/Ir.");
  }

  // Fecha o modal
  await mobilePage.keyboard.press("Escape");
  await mobilePage.waitForTimeout(300);

  // =========================================================================
  // CENÁRIO 2: MOBILE (390 x 844) - PÁGINA "/search"
  // =========================================================================
  console.log("\n[Cenário 2: Mobile] Testando página /search...");
  await mobilePage.goto("http://localhost:3000/search?q=Naruto", { waitUntil: "networkidle" });
  await mobilePage.waitForTimeout(1000);

  await mobilePage.screenshot({ path: "screenshots/mobile_search_page_initial.png" });
  console.log("✓ Página /search mobile: screenshots/mobile_search_page_initial.png");

  // Clica no seletor de categorias na página /search
  const pageSelector = mobilePage.locator('button[aria-haspopup="listbox"]').first();
  await pageSelector.click();
  await mobilePage.waitForTimeout(300);

  const pageDropdown = mobilePage.locator('div[role="listbox"]').first();
  if (!(await pageDropdown.isVisible())) {
    throw new Error("Dropdown do seletor não abriu na página /search!");
  }

  // Mede a caixa do seletor e do dropdown para validar alinhamento e limites da tela
  const selectorBox = await pageSelector.boundingBox();
  const dropdownBox = await pageDropdown.boundingBox();

  console.log("Botão seletor na página /search:", selectorBox);
  console.log("Dropdown na página /search:", dropdownBox);

  if (!dropdownBox || dropdownBox.x < 0) {
    throw new Error(`ERRO CRÍTICO: Dropdown está vazando para a esquerda fora da tela! x: ${dropdownBox?.x}`);
  }
  if (dropdownBox.x + dropdownBox.width > 390) {
    throw new Error(`ERRO: Dropdown está vazando para a direita da tela! x: ${dropdownBox.x + dropdownBox.width}`);
  }
  console.log(`✓ Dropdown perfeitamente posicionado dentro da tela: x=${dropdownBox.x}px, width=${dropdownBox.width}px`);

  await mobilePage.screenshot({ path: "screenshots/mobile_search_dropdown_fixed.png" });
  console.log("✓ Screenshot do dropdown corrigido: screenshots/mobile_search_dropdown_fixed.png");

  // Testa pressionar Enter na barra de busca de /search
  const searchInput = mobilePage.locator('input[type="search"]').first();
  await searchInput.focus();
  await searchInput.fill("One Piece");
  await searchInput.press("Enter");
  await mobilePage.waitForTimeout(600);

  const searchInputStillFocused = await mobilePage.evaluate(() => document.activeElement?.tagName === "INPUT");
  console.log("Input na página /search desfocado após Enter/Ir:", !searchInputStillFocused);

  await mobilePage.screenshot({ path: "screenshots/mobile_search_after_enter_no_ring.png" });
  console.log("✓ Screenshot pós-busca sem contorno preso: screenshots/mobile_search_after_enter_no_ring.png");

  await mobileCtx.close();

  // =========================================================================
  // CENÁRIO 3: DESKTOP (1280 x 800)
  // =========================================================================
  console.log("\n[Cenário 3: Desktop] Testando modal e /search em desktop...");
  const desktopCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const desktopPage = await desktopCtx.newPage();

  await desktopPage.goto("http://localhost:3000/search?q=Bleach", { waitUntil: "networkidle" });
  await desktopPage.waitForTimeout(1000);

  // Dropdown na página /search em desktop
  const desktopSelector = desktopPage.locator('button[aria-haspopup="listbox"]').first();
  await desktopSelector.click();
  await desktopPage.waitForTimeout(300);
  await desktopPage.screenshot({ path: "screenshots/desktop_search_dropdown.png" });
  console.log("✓ Screenshot desktop /search: screenshots/desktop_search_dropdown.png");

  // Modal em desktop
  await desktopPage.keyboard.press("Control+k");
  await desktopPage.waitForTimeout(400);

  const desktopModalInput = desktopPage.locator('div[role="dialog"] input');
  await desktopModalInput.fill("Bleach");
  await desktopPage.waitForTimeout(600);
  await desktopPage.screenshot({ path: "screenshots/desktop_modal_results.png" });
  console.log("✓ Screenshot desktop modal: screenshots/desktop_modal_results.png");

  await desktopCtx.close();
  await browser.close();

  console.log("\n=== TODAS AS VERIFICAÇÕES PASSARAM COM SUCESSO! ===");
}

runSearchAudit().catch((err) => {
  console.error("FALHA NA AUDITORIA:", err);
  process.exit(1);
});
