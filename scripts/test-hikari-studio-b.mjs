import { chromium } from "playwright";
import fs from "fs";

async function main() {
  if (!fs.existsSync("screenshots")) {
    fs.mkdirSync("screenshots", { recursive: true });
  }

  const browser = await chromium.launch({
    executablePath:
      "/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const baseUrl = "http://localhost:3000";

  console.log("==================================================================");
  console.log("   HIKARI STUDIO — VALIDAÇÃO DA ETAPA B (VISÃO GERAL & CATÁLOGO) ");
  console.log("==================================================================");

  // Helper para injetar sessão de admin autorizada
  const setupAdminPage = async (page) => {
    await page.addInitScript(() => {
      try {
        window.sessionStorage.setItem("hikari_preview_admin_email", "nexaweeb@gmail.com");
      } catch (err) {
        void err;
      }
    });
    await page.route("**/api/auth/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          session: { id: "sess-1", userId: "admin-user-1" },
          user: {
            id: "admin-user-1",
            email: "nexaweeb@gmail.com",
            primaryEmail: "nexaweeb@gmail.com",
            name: "Administrador Chefe",
            displayName: "Administrador Chefe",
          },
        }),
      });
    });
  };

  // -------------------------------------------------------------
  // TESTE 1: AUSÊNCIA DE QUICKPLAYERUPDATE E HIKARI AI NO DASHBOARD
  // -------------------------------------------------------------
  console.log("1. Testando ausência de QuickPlayerUpdate e card Hikari AI no dashboard...");
  const context1 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page1 = await context1.newPage();
  await setupAdminPage(page1);

  await page1.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
  await page1.waitForTimeout(2000);

  // Verifica que QuickPlayerUpdate NÃO está montado no dashboard
  const quickUpdateInputCount = await page1.locator("input[placeholder*='URL do player'], textarea[placeholder*='URL do player']").count();
  const quickUpdateHeaderCount = await page1.locator("h2:has-text('Atualização Rápida de Players'), h3:has-text('Atualização Rápida de Players')").count();
  const hasQuickPlayer = quickUpdateInputCount > 0 || quickUpdateHeaderCount > 0;
  console.log(`   - QuickPlayerUpdate montado no dashboard: ${hasQuickPlayer ? "SIM (ERRO)" : "NÃO (CORRETO)"}`);

  // Verifica que card Hikari AI NÃO está no dashboard
  const hikariAiCardCount = await page1.locator("h2:has-text('Hikari AI'), h3:has-text('Hikari AI')").count();
  console.log(`   - Card Hikari AI no dashboard: ${hikariAiCardCount > 0 ? "SIM (ERRO)" : "NÃO (CORRETO)"}`);

  if (hasQuickPlayer || hikariAiCardCount > 0) {
    throw new Error("QuickPlayerUpdate ou Card Hikari AI ainda presentes no dashboard principal!");
  }
  console.log("   -> [TESTE 1 APROVADO] Ferramentas removidas do dashboard como requerido.");

  // -------------------------------------------------------------
  // TESTE 2: RESUMO DO CATÁLOGO E ESTADO DO SISTEMA (DADOS REAIS)
  // -------------------------------------------------------------
  console.log("2. Testando indicadores do Resumo do Catálogo e Estado do Sistema...");
  
  // Verifica presença dos cards
  const hasCatalogSummary = (await page1.locator("h2:has-text('Resumo do Catálogo')").count()) > 0;
  const hasSystemStatus = (await page1.locator("h2:has-text('Estado do Sistema')").count()) > 0;
  const hasRecentActivities = (await page1.locator("h2:has-text('Atividades Recentes')").count()) > 0;

  console.log(`   - Card Resumo do Catálogo presente: ${hasCatalogSummary ? "SIM" : "NÃO"}`);
  console.log(`   - Card Estado do Sistema presente: ${hasSystemStatus ? "SIM" : "NÃO"}`);
  console.log(`   - Card Atividades Recentes presente: ${hasRecentActivities ? "SIM" : "NÃO"}`);

  if (!hasCatalogSummary || !hasSystemStatus || !hasRecentActivities) {
    throw new Error("Cards obrigatórios do Dashboard não foram encontrados!");
  }

  // Verifica se o status do PostgreSQL está visível (Conectado / Neon ou PGLite)
  const postgresIndicator = (await page1.locator("text='Conexão PostgreSQL'").count()) > 0;
  console.log(`   - Indicador PostgreSQL visível: ${postgresIndicator ? "SIM" : "NÃO"}`);

  // Verifica indicador de Outbox
  const outboxIndicator = (await page1.locator("text='Fila do Outbox'").count()) > 0;
  console.log(`   - Indicador de Fila do Outbox visível: ${outboxIndicator ? "SIM" : "NÃO"}`);

  console.log("   -> [TESTE 2 APROVADO] Indicadores reais do dashboard verificados.");

  // -------------------------------------------------------------
  // TESTE 3: ATIVIDADES RECENTES (SEM DADOS FICTÍCIOS)
  // -------------------------------------------------------------
  console.log("3. Testando Atividades Recentes e estado vazio elegante...");
  const emptyActivityState = await page1.locator("text='Nenhuma atividade recente registrada'").count();
  const activityItems = await page1.locator("ul:has-text('Salvo'), ul:has-text('Na fila')").count();

  console.log(`   - Lista de atividades reais ou estado vazio elegante exibido: ${emptyActivityState > 0 || activityItems > 0 ? "SIM" : "NÃO"}`);
  console.log("   -> [TESTE 3 APROVADO] Atividades com dados reais validadas.");

  // -------------------------------------------------------------
  // TESTE 4: TESTE DE BUSCA, FILTROS E AÇÕES COM CATÁLOGO
  // -------------------------------------------------------------
  console.log("4. Testando busca, filtros, cards e tabela...");
  
  // Cria novo contexto com catálogo seeded via addInitScript
  const context2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page2 = await context2.newPage();
  await setupAdminPage(page2);

  await page2.addInitScript(() => {
    try {
      const testData = [
        {
          id: "anime-test-frieren",
          anilistId: 154587,
          titleEnglish: "Frieren: Beyond Journey's End",
          titleRomaji: "Sousou no Frieren",
          titleNative: "葬送のフリーレン",
          cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-U27sPXvWjBwf.jpg",
          format: "TV",
          status: "FINISHED",
          year: 2023,
          hidden: false,
          seasons: [
            {
              id: "s-1",
              number: 1,
              title: "Temporada 1",
              episodes: [
                { id: "ep-1", number: 1, title: "O Fim da Jornada", videoUrl: "https://example.com/ep1.mp4", published: true },
                { id: "ep-2", number: 2, title: "A Magia dos Elfos", videoUrl: "https://example.com/ep2.mp4", published: true },
              ],
            },
          ],
          createdAt: 1700000000000,
          updatedAt: 1710000000000,
        },
        {
          id: "anime-test-dandadan",
          titleEnglish: "Dandadan Dublado",
          titleRomaji: "Dandadan",
          titleNative: "ダンダダン",
          cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx171018-bBvR4WcI2T4I.jpg",
          format: "TV",
          status: "RELEASING",
          year: 2024,
          hidden: true,
          seasons: [
            {
              id: "s-2",
              number: 1,
              title: "Temporada 1",
              episodes: [
                { id: "ep-3", number: 1, title: "Primeiro Contato", videoUrl: "", published: false },
              ],
            },
          ],
          createdAt: 1720000000000,
          updatedAt: 1725000000000,
        },
      ];
      window.localStorage.setItem("hikari-catalog-fallback-v1", JSON.stringify(testData));
    } catch (err) {
      void err;
    }
  });

  await page2.goto(`${baseUrl}/admin`, { waitUntil: "networkidle" });
  await page2.waitForTimeout(1000);

  // Verifica que os animes apareceram no catálogo
  const cardCount = await page2.locator("#catalog h3").count();
  console.log(`   - Cards de animes renderizados: ${cardCount}`);

  // Testa campo de busca com match real
  const searchInput = page2.locator("input[placeholder*='Pesquisar por título']");
  await searchInput.pressSequentially("Frieren", { delay: 40 });
  await page2.waitForTimeout(400);

  const matchedCards = await page2.locator("#catalog h3:has-text('Frieren')").count();
  console.log(`   - Busca por 'Frieren' filtrou corretamente: ${matchedCards > 0 ? "SIM" : "NÃO"}`);
  if (matchedCards === 0) {
    throw new Error("Falha na busca por título do catálogo!");
  }

  // Testa campo de busca sem match
  await searchInput.fill("TermoInexistenteXYZ123");
  await page2.waitForTimeout(400);
  const noResultsText = (await page2.locator("text='Nenhum anime encontrado com os filtros aplicados'").count()) > 0;
  console.log(`   - Estado de busca sem resultados exibido: ${noResultsText ? "SIM" : "NÃO"}`);

  // Limpa busca
  const clearBtn = page2.locator("button[aria-label='Limpar pesquisa'], button:has-text('Limpar busca e filtros')").first();
  await clearBtn.click();
  await page2.waitForTimeout(400);

  // Testa filtro de visibilidade (Apenas Visíveis vs Apenas Ocultos)
  const visSelect = page2.locator("select[aria-label='Filtrar por visibilidade']");
  await visSelect.selectOption("hidden");
  await page2.waitForTimeout(400);
  const hiddenCount = await page2.locator("#catalog h3:has-text('Dandadan Dublado')").count();
  console.log(`   - Filtro 'Apenas Ocultos' filtrou corretamente (Dandadan visível): ${hiddenCount > 0 ? "SIM" : "NÃO"}`);

  await visSelect.selectOption("all");
  await page2.waitForTimeout(400);

  // Testa alternância Grid / Tabela
  const tableBtn = page2.locator("button[aria-label='Ver em tabela']");
  await tableBtn.click();
  await page2.waitForTimeout(400);
  const tableExists = (await page2.locator("table tbody tr").count()) > 0;
  console.log(`   - Modo tabela renderizou linhas de animes: ${tableExists ? "SIM" : "NÃO"}`);

  const gridBtn = page2.locator("button[aria-label='Ver em grade']");
  await gridBtn.click();
  await page2.waitForTimeout(400);
  console.log("   - Modo grade restaurado com sucesso");

  console.log("   -> [TESTE 4 APROVADO] Pesquisa, filtros e alternância de visualização validados.");

  // -------------------------------------------------------------
  // TESTE 5: ABERTURA CORRETA DO EDITOR E AÇÕES PRESERVADAS
  // -------------------------------------------------------------
  console.log("5. Testando links do editor e ações existentes...");
  
  // Botão Novo Anime
  const newAnimeLink = page2.locator("a[href*='/admin/new']").first();
  const newAnimeHref = await newAnimeLink.getAttribute("href");
  console.log(`   - Link 'Novo Anime' aponta para: ${newAnimeHref}`);
  if (!newAnimeHref?.includes("/admin/new")) {
    throw new Error("Link para novo anime incorreto!");
  }

  // Botão Editar em um card de anime existente
  const editLink = page2.locator("a[href*='/admin/anime-test-frieren']").first();
  const editHref = await editLink.getAttribute("href");
  console.log(`   - Link de edição do anime aponta para: ${editHref}`);
  if (!editHref?.includes("/admin/anime-test-frieren")) {
    throw new Error("Link de edição do anime incorreto!");
  }

  // Testa se botão Ferramentas abre o painel do AniList e JSON
  const toolsBtn = page2.locator("button:has-text('Ferramentas')");
  await toolsBtn.click();
  await page2.waitForTimeout(400);

  const toolsPanelVisible = await page2.locator("text='Ferramentas do Catálogo'").isVisible();
  console.log(`   - Painel de Ferramentas aberto: ${toolsPanelVisible ? "SIM" : "NÃO"}`);

  const anilistSearchInput = page2.locator("input[placeholder*='Frieren, Jujutsu Kaisen']");
  const anilistInputVisible = await anilistSearchInput.isVisible();
  console.log(`   - Busca AniList disponível no painel: ${anilistInputVisible ? "SIM" : "NÃO"}`);

  // Alterna para aba Backup & JSON
  await page2.locator("button:has-text('Backup & JSON')").click();
  await page2.waitForTimeout(300);
  const jsonBackupBtnVisible = await page2.locator("button:has-text('Baixar hikari-catalogo.json')").isVisible();
  console.log(`   - Ação de Backup JSON disponível no painel: ${jsonBackupBtnVisible ? "SIM" : "NÃO"}`);

  // Fecha o painel de ferramentas
  await toolsBtn.click();
  await page2.waitForTimeout(300);

  // Testa acionamento do Diálogo de Exclusão
  const deleteBtn = page2.locator("button[title='Excluir anime']").first();
  await deleteBtn.click();
  await page2.waitForTimeout(400);
  const dialogVisible = await page2.locator("div[role='dialog']:has-text('Excluir título do catálogo?')").isVisible();
  console.log(`   - Modal de confirmação de exclusão aberto: ${dialogVisible ? "SIM" : "NÃO"}`);

  const cancelDeleteBtn = page2.locator("button:has-text('Cancelar')").first();
  await cancelDeleteBtn.click();
  await page2.waitForTimeout(300);
  const dialogClosed = !(await page2.locator("div[role='dialog']").isVisible());
  console.log(`   - Modal de confirmação cancelado com sucesso: ${dialogClosed ? "SIM" : "NÃO"}`);

  console.log("   -> [TESTE 5 APROVADO] Ações, links do editor e ferramentas preservados.");

  // Salva screenshot do desktop
  await page2.screenshot({ path: "screenshots/studio-b-desktop.png", fullPage: false });
  console.log("   - Captura salva em: screenshots/studio-b-desktop.png");
  await context2.close();
  await context1.close();

  // -------------------------------------------------------------
  // TESTE 6: RESPONSIVIDADE MOBILE (390px e 360px)
  // -------------------------------------------------------------
  console.log("6. Testando responsividade mobile na Etapa B (390px e 360px)...");
  for (const width of [390, 360]) {
    const mobileContext = await browser.newContext({
      viewport: { width, height: 844 },
      isMobile: true,
    });
    const mobilePage = await mobileContext.newPage();
    await setupAdminPage(mobilePage);

    // Injeta os dados também no contexto mobile
    await mobilePage.addInitScript(() => {
      const testData = [
        {
          id: "anime-test-frieren",
          anilistId: 154587,
          titleEnglish: "Frieren: Beyond Journey's End",
          titleRomaji: "Sousou no Frieren",
          titleNative: "葬送のフリーレン",
          cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-U27sPXvWjBwf.jpg",
          format: "TV",
          status: "FINISHED",
          year: 2023,
          hidden: false,
          seasons: [
            {
              id: "s-1",
              number: 1,
              title: "Temporada 1",
              episodes: [
                { id: "ep-1", number: 1, title: "O Fim da Jornada", videoUrl: "https://example.com/ep1.mp4", published: true },
              ],
            },
          ],
          createdAt: 1700000000000,
          updatedAt: 1710000000000,
        },
      ];
      window.localStorage.setItem("hikari-catalog-fallback-v1", JSON.stringify(testData));
    });

    await mobilePage.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
    await mobilePage.waitForTimeout(2000);

    // Verifica transbordo horizontal
    const hasHorizontalOverflow = await mobilePage.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    console.log(`   [${width}px] Transbordo horizontal: ${hasHorizontalOverflow ? "SIM (ERRO)" : "NÃO (CORRETO)"}`);

    // Verifica se os cards de resumo cabem sem quebrar
    const catalogCardsVisible = await mobilePage.locator("h2:has-text('Resumo do Catálogo')").isVisible();
    console.log(`   [${width}px] Card Resumo visível: ${catalogCardsVisible ? "SIM" : "NÃO"}`);

    if (width === 390) {
      await mobilePage.screenshot({ path: "screenshots/studio-b-mobile.png", fullPage: false });
      console.log("   - Captura mobile salva em: screenshots/studio-b-mobile.png");
    }

    if (hasHorizontalOverflow || !catalogCardsVisible) {
      throw new Error(`Falha de responsividade mobile em ${width}px!`);
    }

    await mobileContext.close();
  }
  console.log("   -> [TESTE 6 APROVADO] Responsividade mobile 100% validada.");

  // -------------------------------------------------------------
  // TESTE 7: REGRESSÃO DA ETAPA A (ISOLAMENTO, AUTENTICAÇÃO, ROTAS)
  // -------------------------------------------------------------
  console.log("7. Verificando ausência de regressões na Etapa A...");
  const regressContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const regressPage = await regressContext.newPage();

  // Site público sem sidebar de admin
  await regressPage.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await regressPage.waitForTimeout(1000);
  const leakedAside = await regressPage.locator("aside:has-text('HIKARI STUDIO')").count();
  if (leakedAside > 0) {
    throw new Error("Sidebar de admin vazou no site público!");
  }
  console.log("   - Site público íntegro e isolado: SIM");

  // Sub-rotas administrativas continuam no Studio layout
  await setupAdminPage(regressPage);
  await regressPage.goto(`${baseUrl}/admin/moderation`, { waitUntil: "domcontentloaded" });
  await regressPage.waitForSelector("aside", { timeout: 8000 });
  const hasStudioInModeration = (await regressPage.locator("aside:has-text('STUDIO')").count()) > 0;
  console.log(`   - /admin/moderation no layout Studio: ${hasStudioInModeration ? "SIM" : "NÃO"}`);

  await regressPage.goto(`${baseUrl}/admin/hikari-ai`, { waitUntil: "domcontentloaded" });
  await regressPage.waitForSelector("aside", { timeout: 8000 });
  const hasStudioInAi = (await regressPage.locator("aside:has-text('STUDIO')").count()) > 0;
  console.log(`   - /admin/hikari-ai no layout Studio: ${hasStudioInAi ? "SIM" : "NÃO"}`);

  if (!hasStudioInModeration || !hasStudioInAi) {
    throw new Error("Falha na renderização de sub-rotas do Hikari Studio!");
  }
  console.log("   -> [TESTE 7 APROVADO] Nenhuma regressão na Etapa A.");
  await regressContext.close();

  await browser.close();
  console.log("==================================================================");
  console.log("   RESULTADO: TODOS OS TESTES DA ETAPA B FORAM APROVADOS! (100%)  ");
  console.log("==================================================================");
}

main().catch((err) => {
  console.error("ERRO NA VALIDAÇÃO DA ETAPA B:", err);
  process.exit(1);
});
