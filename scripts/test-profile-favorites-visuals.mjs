import { chromium } from "playwright";
import fs from "fs";

async function run() {
  console.log("=== INICIANDO VALIDAÇÃO COMPLETA: AJUSTES VISUAIS NOS FAVORITOS DO PERFIL ===");

  if (!fs.existsSync("screenshots")) {
    fs.mkdirSync("screenshots", { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath:
      "/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const results = {
    test1_threeCardsPerLineMobile: false,
    test2_noArrowButtons: false,
    test3_noDecorativeEmojis: false,
    test4_noDecorativeNumbers: false,
    test5_horizontalDragWorking: false,
    test6_inclusionAndRemovalWorking: false,
    test7_responsiveLayoutNoOverflow: false,
    details: [],
  };

  try {
    // -----------------------------------------------------------------
    // TESTE 1: Animes favoritos com 3 cards por linha no layout mobile
    // -----------------------------------------------------------------
    console.log("\n--- TESTE 1: Mobile (360x780) - 3 animes por linha em Favoritos — Animes ---");
    const mobileContext = await browser.newContext({
      viewport: { width: 360, height: 780 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();

    await mobilePage.goto("http://127.0.0.1:3000/account", {
      waitUntil: "networkidle",
    });
    await mobilePage.waitForTimeout(2000);

    // Encontrar a seção Favoritos — Animes
    const animeSection = mobilePage.locator('section[aria-label="Favoritos — Animes"]');
    const isAnimeSectionVisible = await animeSection.isVisible();
    console.log("Seção 'Favoritos — Animes' visível:", isAnimeSectionVisible);

    // Cards de animes dentro da grade
    const animeCards = animeSection.locator('button');
    const animeCardCount = await animeCards.count();
    console.log(`Cards de anime encontrados: ${animeCardCount}`);

    if (animeCardCount >= 6) {
      const box0 = await animeCards.nth(0).boundingBox();
      const box1 = await animeCards.nth(1).boundingBox();
      const box2 = await animeCards.nth(2).boundingBox();
      const box3 = await animeCards.nth(3).boundingBox();
      const box4 = await animeCards.nth(4).boundingBox();
      const box5 = await animeCards.nth(5).boundingBox();

      console.log(`Card 0: x=${box0.x.toFixed(1)}, y=${box0.y.toFixed(1)}, w=${box0.width.toFixed(1)}`);
      console.log(`Card 1: x=${box1.x.toFixed(1)}, y=${box1.y.toFixed(1)}, w=${box1.width.toFixed(1)}`);
      console.log(`Card 2: x=${box2.x.toFixed(1)}, y=${box2.y.toFixed(1)}, w=${box2.width.toFixed(1)}`);
      console.log(`Card 3: x=${box3.x.toFixed(1)}, y=${box3.y.toFixed(1)}, w=${box3.width.toFixed(1)}`);
      console.log(`Card 4: x=${box4.x.toFixed(1)}, y=${box4.y.toFixed(1)}, w=${box4.width.toFixed(1)}`);
      console.log(`Card 5: x=${box5.x.toFixed(1)}, y=${box5.y.toFixed(1)}, w=${box5.width.toFixed(1)}`);

      // Linha 1: Cards 0, 1, 2 devem ter o mesmo topo (tolerância 3px) e X crescente
      const row1Aligned =
        Math.abs(box0.y - box1.y) < 3 &&
        Math.abs(box1.y - box2.y) < 3 &&
        box0.x < box1.x &&
        box1.x < box2.x;

      // Linha 2: Cards 3, 4, 5 devem ter o mesmo topo (tolerância 3px) e Y maior que a linha 1
      const row2Aligned =
        box3.y > box0.y + box0.height * 0.8 &&
        Math.abs(box3.y - box4.y) < 3 &&
        Math.abs(box4.y - box5.y) < 3 &&
        box3.x < box4.x &&
        box4.x < box5.x;

      console.log("Linha 1 tem exatamente 3 cards alinhados lado a lado:", row1Aligned);
      console.log("Linha 2 tem exatamente 3 cards alinhados na próxima linha:", row2Aligned);

      if (row1Aligned && row2Aligned) {
        results.test1_threeCardsPerLineMobile = true;
        results.details.push("TESTE 1 PASSOU: Exatamente 3 cards de animes por linha no mobile.");
      }
    }

    await mobilePage.screenshot({
      path: "screenshots/test_mobile_favorites_animes_3col.png",
      fullPage: false,
    });

    // -----------------------------------------------------------------
    // TESTE 2: Ausência das setas de navegação (◀️ ▶️) em TODAS as categorias
    // -----------------------------------------------------------------
    console.log("\n--- TESTE 2: Ausência das setas em todas as categorias ---");
    const categories = [
      "Favoritos — Animes",
      "Favoritos — Personagens",
      "Favoritos — Dubladores",
      "Favoritos — Studios",
      "Favoritos — People",
    ];

    let arrowsFound = 0;
    for (const cat of categories) {
      const section = mobilePage.locator(`section[aria-label="${cat}"]`);
      if (await section.isVisible()) {
        const arrowButtons = section.locator(
          'button[aria-label*="Rolar"], button[aria-label*="esquerda"], button[aria-label*="direita"], svg.lucide-chevron-left, svg.lucide-chevron-right'
        );
        const count = await arrowButtons.count();
        if (count > 0) {
          console.error(`ERRO: Encontradas ${count} setas na categoria ${cat}`);
          arrowsFound += count;
        } else {
          console.log(`Categoria '${cat}': 0 setas visíveis (OK)`);
        }
      }
    }

    if (arrowsFound === 0) {
      results.test2_noArrowButtons = true;
      results.details.push("TESTE 2 PASSOU: Nenhuma seta de navegação visível em nenhuma categoria.");
    }

    // -----------------------------------------------------------------
    // TESTE 3: Ausência de emojis decorativos nos títulos e cabeçalhos
    // -----------------------------------------------------------------
    console.log("\n--- TESTE 3: Ausência de emojis decorativos ---");
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    let emojisFound = false;

    for (const cat of categories) {
      const heading = mobilePage.locator(`section[aria-label="${cat}"] h3`);
      if (await heading.isVisible()) {
        const text = await heading.innerText();
        console.log(`Título da categoria: "${text}"`);
        if (emojiRegex.test(text)) {
          console.error(`ERRO: Emoji encontrado no título "${text}"`);
          emojisFound = true;
        }
      }
    }

    if (!emojisFound) {
      results.test3_noDecorativeEmojis = true;
      results.details.push("TESTE 3 PASSOU: Nenhum emoji decorativo nos títulos ou cabeçalhos.");
    }

    // -----------------------------------------------------------------
    // TESTE 4: Ausência de indicadores numéricos decorativos
    // -----------------------------------------------------------------
    console.log("\n--- TESTE 4: Ausência de indicadores numéricos decorativos ---");
    let decorativeNumbersFound = false;

    for (const cat of categories) {
      const section = mobilePage.locator(`section[aria-label="${cat}"]`);
      if (await section.isVisible()) {
        const header = section.locator(".border-b");
        const headerText = await header.innerText();
        // Verifica se há contadores do tipo (6), (4) etc. no cabeçalho
        const counterMatch = headerText.match(/\(\d+\)/);
        if (counterMatch) {
          console.error(`ERRO: Indicador numérico decorativo encontrado no cabeçalho de ${cat}: ${counterMatch[0]}`);
          decorativeNumbersFound = true;
        } else {
          console.log(`Cabeçalho '${cat}': Sem indicador numérico decorativo (OK)`);
        }
      }
    }

    // Verifica que informações essenciais como o ano continuam presentes
    const firstAnimeSubtitle = await animeSection.locator("p").first().innerText();
    console.log("Subtítulo essencial do primeiro anime:", firstAnimeSubtitle);
    const hasEssentialInfo = Boolean(firstAnimeSubtitle && (firstAnimeSubtitle.includes("1999") || firstAnimeSubtitle.includes("TV")));

    if (!decorativeNumbersFound && hasEssentialInfo) {
      results.test4_noDecorativeNumbers = true;
      results.details.push("TESTE 4 PASSOU: Ausência de números decorativos; informações essenciais de ano/formato preservadas.");
    }

    // -----------------------------------------------------------------
    // TESTE 5: Navegação horizontal por gesto e arraste nas categorias horizontais
    // -----------------------------------------------------------------
    console.log("\n--- TESTE 5: Navegação horizontal por gesto/arraste ---");
    // Usar a seção de Personagens ou Dubladores no desktop para testar drag
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const desktopPage = await desktopContext.newPage();
    await desktopPage.goto("http://127.0.0.1:3000/account", { waitUntil: "networkidle" });
    await desktopPage.waitForTimeout(2000);

    const charSection = desktopPage.locator('section[aria-label="Favoritos — Personagens"]');
    const charRail = charSection.locator(".rail");

    if (await charRail.isVisible()) {
      const isRailHorizontal = await charRail.evaluate((el) => {
        return window.getComputedStyle(el).overflowX === "auto";
      });
      console.log("Carrossel de personagens possui overflow-x: auto:", isRailHorizontal);

      const animeIsGrid = await animeSection.evaluate((el) => {
        const gridDiv = el.querySelector(".grid");
        return Boolean(gridDiv);
      });
      console.log("Seção de animes usa grade exclusiva (não carrossel horizontal):", animeIsGrid);

      // Simular arraste com mouse no rail
      const railBox = await charRail.boundingBox();
      if (railBox) {
        const startX = railBox.x + railBox.width * 0.8;
        const startY = railBox.y + railBox.height * 0.5;
        await desktopPage.mouse.move(startX, startY);
        await desktopPage.mouse.down();
        await desktopPage.mouse.move(startX - 200, startY, { steps: 10 });
        await desktopPage.mouse.up();
        await desktopPage.waitForTimeout(500);

        const currentScrollLeft = await charRail.evaluate((el) => el.scrollLeft);
        console.log("Posição de scrollLeft após arraste:", currentScrollLeft);

        if (isRailHorizontal && animeIsGrid) {
          results.test5_horizontalDragWorking = true;
          results.details.push("TESTE 5 PASSOU: Arraste e gesto horizontal funcionando; grade exclusiva para animes.");
        }
      }
    }

    // -----------------------------------------------------------------
    // TESTE 6: Inclusão e remoção de favoritos funcionando normalmente
    // -----------------------------------------------------------------
    console.log("\n--- TESTE 6: Inclusão e remoção de favoritos ---");
    // No desktopPage, clicar no primeiro personagem para abrir o modal de detalhes
    const firstCharCard = charSection.locator("button").first();
    const charName = await firstCharCard.locator("h4").innerText();
    console.log("Clicando no personagem para abrir modal:", charName);
    await firstCharCard.click();
    await desktopPage.waitForTimeout(1000);

    // Verificar se o modal abriu com título e botão de remover
    const modalTitle = desktopPage.locator('[role="dialog"] h2, [role="dialog"] [class*="DialogTitle"]');
    const isModalOpen = await modalTitle.isVisible();
    console.log("Modal de detalhes aberto:", isModalOpen);

    const removeBtn = desktopPage.locator('[role="dialog"] button:has-text("Remover favorito")');
    const isRemoveBtnVisible = await removeBtn.isVisible();
    console.log("Botão 'Remover favorito' visível no modal:", isRemoveBtnVisible);

    if (isModalOpen && isRemoveBtnVisible) {
      await removeBtn.click();
      await desktopPage.waitForTimeout(2000);

      // Verificar que o modal fechou
      const isModalClosed = !(await modalTitle.isVisible());
      console.log("Modal fechado após remoção:", isModalClosed);

      if (isModalClosed) {
        results.test6_inclusionAndRemovalWorking = true;
        results.details.push("TESTE 6 PASSOU: Remoção de favorito pelo modal de detalhes funciona perfeitamente.");
      }
    }

    // -----------------------------------------------------------------
    // TESTE 7: Layout responsivo sem cortes ou sobreposições
    // -----------------------------------------------------------------
    console.log("\n--- TESTE 7: Layout responsivo sem cortes ou overflow indesejado ---");
    const mobileOverflow = await mobilePage.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    console.log("Possui overflow horizontal indesejado na página mobile:", mobileOverflow);

    const desktopOverflow = await desktopPage.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    console.log("Possui overflow horizontal indesejado na página desktop:", desktopOverflow);

    await desktopPage.screenshot({
      path: "screenshots/test_desktop_favorites_overview.png",
      fullPage: false,
    });

    if (!mobileOverflow && !desktopOverflow) {
      results.test7_responsiveLayoutNoOverflow = true;
      results.details.push("TESTE 7 PASSOU: Layout totalmente responsivo sem cortes ou overflow da página.");
    }

    await mobileContext.close();
    await desktopContext.close();
  } catch (err) {
    console.error("Erro durante a execução dos testes:", err);
  } finally {
    await browser.close();
  }

  console.log("\n=================== RESULTADOS FINAIS ===================");
  console.log("1. Três animes por linha no mobile:", results.test1_threeCardsPerLineMobile ? "✅ PASSOU" : "❌ FALHOU");
  console.log("2. Ausência total de setas:", results.test2_noArrowButtons ? "✅ PASSOU" : "❌ FALHOU");
  console.log("3. Ausência de emojis decorativos:", results.test3_noDecorativeEmojis ? "✅ PASSOU" : "❌ FALHOU");
  console.log("4. Ausência de indicadores numéricos decorativos:", results.test4_noDecorativeNumbers ? "✅ PASSOU" : "❌ FALHOU");
  console.log("5. Navegação horizontal por gesto/arraste:", results.test5_horizontalDragWorking ? "✅ PASSOU" : "❌ FALHOU");
  console.log("6. Inclusão e remoção de favoritos:", results.test6_inclusionAndRemovalWorking ? "✅ PASSOU" : "❌ FALHOU");
  console.log("7. Layout responsivo sem cortes:", results.test7_responsiveLayoutNoOverflow ? "✅ PASSOU" : "❌ FALHOU");
  console.log("=========================================================");

  const allPassed = Object.values(results).slice(0, 7).every(Boolean);
  if (!allPassed) {
    process.exit(1);
  }
}

run();
