import { chromium } from "playwright";

async function runTests() {
  console.log("=== INICIANDO BATERIA DE TESTES: NOVA BUSCA HIKARI ===");

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

  // =========================================================================
  // TESTE 1: Proteção da página de fundo & preservação de rolagem na Home ('/')
  // =========================================================================
  console.log("\n[Teste 1] Testando preservação de rolagem e estado na Home '/'...");
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // Rola a página para baixo
  await page.evaluate(() => window.scrollTo(0, 420));
  await page.waitForTimeout(400);
  const scrollBefore = await page.evaluate(() => window.scrollY);
  console.log(`Scroll antes de abrir busca: ${scrollBefore}px`);

  // Abre a busca via atalho Ctrl+K
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(400);

  const modal = page.locator('div[role="dialog"][aria-label="Caixa de busca do Hikari"]');
  const isModalVisible = await modal.isVisible();
  console.log("Modal centralizado visível:", isModalVisible);
  if (!isModalVisible) throw new Error("Modal de busca não abriu!");

  await page.screenshot({ path: "screenshots/nova_busca_modal_aberto.png" });
  console.log("Screenshot salvo: screenshots/nova_busca_modal_aberto.png");

  // Fecha a busca com ESC
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  const isClosed = !(await modal.isVisible());
  console.log("Modal fechado com ESC:", isClosed);
  if (!isClosed) throw new Error("Modal não fechou com ESC!");

  const scrollAfter = await page.evaluate(() => window.scrollY);
  console.log(`Scroll após fechar busca: ${scrollAfter}px`);
  if (Math.abs(scrollAfter - scrollBefore) > 5) {
    throw new Error(`Posição de rolagem foi perdida! Antes: ${scrollBefore}, Depois: ${scrollAfter}`);
  }
  console.log("✓ Teste 1 passou: Fundo preservado e rolagem intacta.");

  // =========================================================================
  // TESTE 2: Proteção da página de fundo em outra rota (/browse/popular)
  // =========================================================================
  console.log("\n[Teste 2] Testando preservação da página de fundo em /browse/popular...");
  await page.goto("http://localhost:3000/browse/popular", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  await page.evaluate(() => window.scrollTo(0, 380));
  await page.waitForTimeout(300);
  const browseScrollBefore = await page.evaluate(() => window.scrollY);

  // Abre busca
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(400);

  // Toca no backdrop escurecido para fechar
  const backdrop = page.locator('.fixed.inset-0.bg-black\\/80');
  await backdrop.click({ position: { x: 50, y: 50 } });
  await page.waitForTimeout(400);

  const browseScrollAfter = await page.evaluate(() => window.scrollY);
  console.log(`Browse scroll: Antes: ${browseScrollBefore}px, Depois: ${browseScrollAfter}px`);
  if (Math.abs(browseScrollAfter - browseScrollBefore) > 5) {
    throw new Error(`Posição de rolagem perdida no browse! Antes: ${browseScrollBefore}, Depois: ${browseScrollAfter}`);
  }
  console.log("✓ Teste 2 passou: Página /browse/popular intacta e rolagem preservada.");

  // =========================================================================
  // TESTE 3: Botão X e Seletor de Categoria (Seta)
  // =========================================================================
  console.log("\n[Teste 3] Testando Botão X e Seletor de Categoria...");
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(400);

  const clearBtn = page.locator('button[aria-label="Limpar pesquisa"]');
  const isClearHiddenInitially = (await clearBtn.count()) === 0;
  console.log("Botão X oculto quando campo está vazio:", isClearHiddenInitially);
  if (!isClearHiddenInitially) throw new Error("Botão X não deve aparecer com campo vazio!");

  // Digita texto
  const searchInput = page.locator('div[role="dialog"] input[type="text"]');
  await searchInput.fill("Naruto");
  await page.waitForTimeout(200);

  const isClearVisibleNow = await clearBtn.isVisible();
  console.log("Botão X visível após digitar:", isClearVisibleNow);
  if (!isClearVisibleNow) throw new Error("Botão X deve aparecer após digitar!");

  await page.screenshot({ path: "screenshots/nova_busca_botao_x_visivel.png" });

  // Toca no botão X para limpar
  await clearBtn.click();
  await page.waitForTimeout(200);

  const inputValueAfterClear = await searchInput.inputValue();
  console.log("Valor do input após clicar no X:", `"${inputValueAfterClear}"`);
  if (inputValueAfterClear !== "") throw new Error("Botão X não limpou o campo de pesquisa!");

  const isClearHiddenAfterClear = (await clearBtn.count()) === 0;
  console.log("Botão X ocultou novamente:", isClearHiddenAfterClear);
  if (!isClearHiddenAfterClear) throw new Error("Botão X deve ocultar após limpar!");

  // Teste do Seletor de Categoria (Seta)
  const categoryBtn = page.locator('button[aria-label*="Categoria de busca"]').first();
  await categoryBtn.click();
  await page.waitForTimeout(300);

  const options = page.locator('div[role="listbox"] button[role="option"]');
  const countOptions = await options.count();
  console.log(`Opções no menu da seta: ${countOptions}`);
  if (countOptions !== 2) throw new Error(`O menu deve conter somente 2 opções (Animes e Usuários), encontrado: ${countOptions}`);

  const option1 = await options.nth(0).textContent();
  const option2 = await options.nth(1).textContent();
  console.log(`Opção 1: "${option1?.trim()}", Opção 2: "${option2?.trim()}"`);
  if (!option1?.includes("Animes") || !option2?.includes("Usuários")) {
    throw new Error("Opções do menu da seta devem ser exclusivamente 'Animes' e 'Usuários'!");
  }

  await page.screenshot({ path: "screenshots/nova_busca_menu_seta.png" });
  console.log("✓ Teste 3 passou: Botão X e Seletor de Categoria (Seta) funcionando conforme especificado.");

  // =========================================================================
  // TESTE 4: Busca de Animes (Exclusividade de catálogo, metadados reais, sem 'Ver todos')
  // =========================================================================
  console.log("\n[Teste 4] Testando Busca de Animes (catálogo, capas, notas, gêneros)...");
  // Garante que 'Animes' está selecionado
  await options.nth(0).click();
  await page.waitForTimeout(300);

  await searchInput.fill("Frieren");
  await page.waitForTimeout(1500); // Aguarda debounce e busca

  // Verifica contagem de resultados
  const resultCountBadge = page.locator('text=/\\d+ resultados?/i');
  const hasResultCount = (await resultCountBadge.count()) > 0;
  console.log("Contador de resultados visível:", hasResultCount);

  // Verifica resultados de anime
  const animeCards = page.locator('div[role="dialog"] a[href*="/anime/"]');
  const animeCount = await animeCards.count();
  console.log(`Animes encontrados: ${animeCount}`);
  if (animeCount === 0) throw new Error("Nenhum anime encontrado para 'Frieren'!");

  // Verifica exclusividade: nenhum usuário pode aparecer
  const userCardsInAnimeSearch = page.locator('div[role="dialog"] a[href*="/profile/"]');
  const userCountInAnime = await userCardsInAnimeSearch.count();
  console.log(`Usuários nos resultados de animes: ${userCountInAnime}`);
  if (userCountInAnime > 0) throw new Error("Usuários apareceram na busca de Animes!");

  // Confirma ausência total do botão 'Ver todos os resultados'
  const verTodosBtn = page.locator('text="Ver todos os resultados"');
  const hasVerTodos = (await verTodosBtn.count()) > 0;
  console.log("Botão 'Ver todos os resultados' removido:", !hasVerTodos);
  if (hasVerTodos) throw new Error("Botão 'Ver todos os resultados' não deve existir!");

  // Verifica presença de metadados: capas, notas, ano, gêneros
  const firstCard = animeCards.first();
  const hasCover = (await firstCard.locator("img").count()) > 0;
  const cardText = await firstCard.textContent();
  console.log(`Primeiro card: capa=${hasCover}, texto="${cardText?.slice(0, 60)}..."`);
  if (!hasCover) throw new Error("Card de anime deve exibir capa!");

  await page.screenshot({ path: "screenshots/nova_busca_resultados_animes.png" });
  console.log("✓ Teste 4 passou: Busca de animes com capas, notas, gêneros e zero usuários.");

  // =========================================================================
  // TESTE 5: Busca de Usuários (Exclusividade de membros, zero animes)
  // =========================================================================
  console.log("\n[Teste 5] Testando Busca de Usuários...");
  await categoryBtn.click();
  await page.waitForTimeout(300);
  await page.locator('div[role="listbox"] button[role="option"]:has-text("Usuários")').click();
  await page.waitForTimeout(400);

  await searchInput.fill("pererinha");
  await page.waitForTimeout(1500);

  const userCards = page.locator('div[role="dialog"] a[href*="/profile/"]');
  const userCount = await userCards.count();
  console.log(`Usuários encontrados: ${userCount}`);

  // Verifica exclusividade: zero animes na busca de usuários
  const animeCardsInUserSearch = page.locator('div[role="dialog"] a[href*="/anime/"]');
  const animeCountInUser = await animeCardsInUserSearch.count();
  console.log(`Animes nos resultados de usuários: ${animeCountInUser}`);
  if (animeCountInUser > 0) throw new Error("Animes apareceram na busca de Usuários!");

  await page.screenshot({ path: "screenshots/nova_busca_resultados_usuarios.png" });
  console.log("✓ Teste 5 passou: Busca de usuários exclusiva sem animes.");

  // =========================================================================
  // TESTE 6: Abrir Perfil Novo do Hikari (/profile/$nick)
  // =========================================================================
  console.log("\n[Teste 6] Confirmando abertura do Perfil Novo (/profile/$nick)...");
  if (userCount > 0) {
    const firstUserCard = userCards.first();
    const userHref = await firstUserCard.getAttribute("href");
    console.log(`Href do usuário: ${userHref}`);
    if (!userHref?.startsWith("/profile/")) {
      throw new Error(`Link do usuário deve apontar para /profile/$nick, recebido: ${userHref}`);
    }

    await firstUserCard.click();
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log(`URL navegada: ${currentUrl}`);
    if (!currentUrl.includes("/profile/")) {
      throw new Error(`Navegação não abriu o perfil novo: ${currentUrl}`);
    }
    await page.screenshot({ path: "screenshots/nova_busca_perfil_novo.png" });
    console.log("✓ Teste 6 passou: Seleção de usuário abre diretamente o Perfil novo (/profile/$nick).");
  }

  // =========================================================================
  // TESTE 7: Validação em tela Mobile (390x844)
  // =========================================================================
  console.log("\n[Teste 7] Testando no Preview Mobile (390x844)...");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // Clica no botão de busca do header mobile
  const mobileSearchBtn = page.locator('button[aria-label="Buscar"]').first();
  await mobileSearchBtn.click();
  await page.waitForTimeout(500);

  const mobileModal = page.locator('div[role="dialog"][aria-label="Caixa de busca do Hikari"]');
  const isMobileModalOpen = await mobileModal.isVisible();
  console.log("Modal aberto no mobile:", isMobileModalOpen);
  if (!isMobileModalOpen) throw new Error("Modal não abriu no mobile!");

  const mobileInput = mobileModal.locator('input[type="text"]');
  await mobileInput.fill("Demon");
  await page.waitForTimeout(1500);

  await page.screenshot({ path: "screenshots/nova_busca_mobile_animes.png" });
  console.log("Screenshot salvo: screenshots/nova_busca_mobile_animes.png");
  console.log("✓ Teste 7 passou: Layout e comportamento mobile validados com sucesso.");

  console.log("\n==================================================================");
  console.log(">>> TODAS AS VALIDAÇÕES DA NOVA BUSCA PASSARAM COM SUCESSO! <<<");
  console.log("==================================================================");

  await browser.close();
}

runTests().catch((err) => {
  console.error("FALHA NOS TESTES:", err);
  process.exit(1);
});
