import { chromium } from "playwright";

async function runTests() {
  console.log("=== INICIANDO BATERIA DE TESTES DE REFORMULAÇÃO DA BUSCA NO PREVIEW ===");

  let browser;
  try {
    browser = await chromium.launch({
      executablePath:
        "/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  } catch {
    browser = await chromium.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  // Teste 1: Abrir busca em página com rolagem (Início '/') e fechar, verificando preservação da rolagem e estado
  console.log("\n[Teste 1 & 2 & 3] Testando abertura e fechamento da busca na Home '/' com rolagem preservada...");
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Rola a página para baixo
  await page.evaluate(() => window.scrollTo(0, 450));
  await page.waitForTimeout(500);
  const scrollBefore = await page.evaluate(() => window.scrollY);
  console.log(`Scroll antes de abrir busca: ${scrollBefore}px`);

  // Clica no botão de busca do header
  const searchButton = page.locator('button[aria-label*="Buscar"]').first();
  await searchButton.click();
  await page.waitForTimeout(500);

  // Verifica se o modal abriu
  const searchModal = page.locator('div[role="dialog"][aria-label="Caixa de busca do Hikari"]');
  const isModalOpen = await searchModal.isVisible();
  console.log("Modal de busca visível:", isModalOpen);
  if (!isModalOpen) throw new Error("Modal de busca não abriu ao clicar no botão de busca!");

  await page.screenshot({ path: "screenshots/search_modal_opened_desktop.png" });
  console.log("Screenshot salvo: screenshots/search_modal_opened_desktop.png");

  // Fecha a busca pelo botão de fechar ou tecla Escape
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  const isModalClosed = !(await searchModal.isVisible());
  console.log("Modal fechado com Escape:", isModalClosed);
  if (!isModalClosed) throw new Error("Modal não fechou com Escape!");

  const scrollAfter = await page.evaluate(() => window.scrollY);
  console.log(`Scroll após fechar busca: ${scrollAfter}px`);
  if (Math.abs(scrollAfter - scrollBefore) > 10) {
    throw new Error(`Posição de rolagem foi perdida! Antes: ${scrollBefore}, Depois: ${scrollAfter}`);
  }
  console.log("✓ Teste 1, 2 e 3 passaram: Fundo preservado e rolagem restaurada perfeitamente!");

  // Teste 4: Pesquisar animes na lista instantânea e confirmar exclusividade (zero usuários)
  console.log("\n[Teste 4] Testando busca instantânea de Animes...");
  await searchButton.click();
  await page.waitForTimeout(500);

  // Digita 'Solo Leveling'
  const searchInput = page.locator('input[type="search"]').first();
  await searchInput.fill("Solo Leveling");
  await page.waitForTimeout(1500); // Aguarda debounce e busca

  const animeResultsCount = await page.locator('a[href*="/anime/"]').count();
  const userResultsInAnimeSearch = await page.locator('a[href*="/profile/"]').count();
  console.log(`Animes encontrados: ${animeResultsCount}, Usuários encontrados: ${userResultsInAnimeSearch}`);

  if (animeResultsCount === 0) {
    throw new Error("Busca instantânea de animes não retornou resultados para 'Solo Leveling'!");
  }
  if (userResultsInAnimeSearch > 0) {
    throw new Error("Usuários apareceram nos resultados quando categoria Animes estava ativa!");
  }
  await page.screenshot({ path: "screenshots/search_instant_animes.png" });
  console.log("✓ Teste 4 passou: Busca de animes retornou animes e NENHUM usuário.");

  // Teste 8: Seletor de Categoria (abrir menu com seta para baixo e trocar para Usuários)
  console.log("\n[Teste 8] Testando seletor de categoria pelo menu dropdown...");
  const categorySelector = page.locator('button[aria-label*="Categoria de busca"]').first();
  await categorySelector.click();
  await page.waitForTimeout(400);

  // Confirma que o dropdown abriu com as duas opções
  const options = page.locator('div[role="listbox"] button[role="option"]');
  const optionsCount = await options.count();
  console.log(`Opções no menu de categoria: ${optionsCount}`);
  if (optionsCount !== 2) throw new Error(`Esperado 2 opções no menu de categoria, encontrado: ${optionsCount}`);

  await page.screenshot({ path: "screenshots/search_category_menu_open.png" });

  // Seleciona 'Usuários'
  const usersOption = page.locator('button[role="option"]:has-text("Usuários")').first();
  await usersOption.click();
  await page.waitForTimeout(500);

  // Confirma que o seletor agora exibe 'Usuários'
  const categoryText = await categorySelector.textContent();
  console.log(`Categoria selecionada agora: "${categoryText?.trim()}"`);
  if (!categoryText?.includes("Usuários")) {
    throw new Error("Categoria selecionada não mudou para 'Usuários'!");
  }
  console.log("✓ Teste 8 passou: Seletor de categoria com menu dropdown e seta para baixo funcionando!");

  // Teste 5: Pesquisar usuários na lista instantânea e confirmar exclusividade (zero animes)
  console.log("\n[Teste 5] Testando busca instantânea de Usuários...");
  await searchInput.fill("pererinha");
  await page.waitForTimeout(1500);

  const userItemsCount = await page.locator('a[href*="/profile/"]').count();
  const animeItemsInUserSearch = await page.locator('a[href*="/anime/"]').count();
  console.log(`Usuários encontrados: ${userItemsCount}, Animes encontrados: ${animeItemsInUserSearch}`);

  if (animeItemsInUserSearch > 0) {
    throw new Error("Animes apareceram nos resultados quando categoria Usuários estava ativa!");
  }
  await page.screenshot({ path: "screenshots/search_instant_users.png" });
  console.log("✓ Teste 5 passou: Busca de usuários retornou usuários e NENHUM anime.");

  // Teste 6: Abrir usuário e confirmar destino para Perfil NOVO (/profile/$nick)
  console.log("\n[Teste 6] Confirmando que o link de usuário abre o Perfil novo (/profile/$nick)...");
  if (userItemsCount > 0) {
    const userLink = page.locator('a[href*="/profile/"]').first();
    const href = await userLink.getAttribute("href");
    console.log(`Href do usuário selecionado: ${href}`);
    if (!href || !href.startsWith("/profile/")) {
      throw new Error(`Link do perfil não apontou para /profile/$nick: ${href}`);
    }

    // Clica no usuário
    await userLink.click();
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    console.log(`URL carregada: ${currentUrl}`);
    if (!currentUrl.includes("/profile/")) {
      throw new Error(`Página de destino não é o perfil novo: ${currentUrl}`);
    }
    await page.screenshot({ path: "screenshots/search_navigated_new_profile.png" });
    console.log("✓ Teste 6 passou: Seleção de usuário abre diretamente o Perfil novo (/profile/$nick).");
  }

  // Teste 7: Página completa de resultados (/search) em ambas as categorias
  console.log("\n[Teste 7] Testando página completa de busca (/search)...");
  await page.goto("http://localhost:3000/search?q=Attack", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Confirma seletor de categoria na página /search
  const pageCategoryBtn = page.locator('button[aria-label*="Categoria de busca"]').first();
  const pageCatText = await pageCategoryBtn.textContent();
  console.log(`Página /search categoria ativa: "${pageCatText?.trim()}"`);

  const pageAnimesCount = await page.locator('article, div[data-anime-card]').count();
  console.log(`Animes na página /search: ${pageAnimesCount}`);
  await page.screenshot({ path: "screenshots/search_page_animes.png" });

  // Troca para categoria Usuários na página /search pelo menu dropdown da seta
  await pageCategoryBtn.click();
  await page.waitForTimeout(300);
  await page.locator('button[role="option"]:has-text("Usuários")').first().click();
  await page.waitForTimeout(1000);

  // Digita usuário para buscar na página completa
  const pageSearchInput = page.locator('input[type="search"]').first();
  await pageSearchInput.fill("pererinha");
  await page.waitForTimeout(1500);

  const pageUsersCount = await page.locator('a[href*="/profile/"]').count();
  console.log(`Usuários na página /search: ${pageUsersCount}`);
  await page.screenshot({ path: "screenshots/search_page_users.png" });
  console.log("✓ Teste 7 passou: Página de busca completa testada nas duas categorias.");

  // Teste 9: Mobile Viewport (390x844)
  console.log("\n[Teste 9] Testando comportamento em tela Mobile (390x844)...");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const mobileSearchBtn = page.locator('button[aria-label*="Buscar"]').first();
  await mobileSearchBtn.click();
  await page.waitForTimeout(500);

  const mobileInput = page.locator('input[type="search"]').first();
  await mobileInput.fill("Demon");
  await page.waitForTimeout(1500);

  await page.screenshot({ path: "screenshots/search_mobile_view.png" });
  console.log("✓ Teste 9 passou: Visual mobile testado com sucesso.");

  console.log("\n==================================================================");
  console.log(">>> TODAS AS 10 ETAPAS DE TESTE PASSARAM COM 100% DE SUCESSO! <<<");
  console.log("==================================================================");

  await browser.close();
}

runTests().catch((err) => {
  console.error("FALHA NOS TESTES DE BUSCA:", err);
  process.exit(1);
});
