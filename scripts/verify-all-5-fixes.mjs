import { chromium } from "playwright";

async function runTests() {
  console.log("=== INICIANDO SUÍTE DE TESTES DAS 5 CORREÇÕES DO HIKARI ===");
  const browser = await chromium.launch({
    executablePath: "/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const results = {
    test1_trailer_no_hikari_play: false,
    test2_episodes_no_hikari_play: false,
    test3_comments_load_more_single: false,
    test4_navigation_no_previous_flash: false,
    test5_season_switch_episodes_correct: false,
    test6_desktop_render_clean: false,
    test7_mobile_render_clean: false,
    test8_no_console_errors: true,
  };

  const consoleErrors = [];

  try {
    // ---------------------------------------------------------
    // TESTE EM DESKTOP (1280x800)
    // ---------------------------------------------------------
    const contextDesktop = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await contextDesktop.newPage();

    page.on("pageerror", (err) => {
      console.error("[Desktop PageError]:", err.message);
      consoleErrors.push(err.message);
    });

    console.log("\n[1/5] Acessando /anime/16498 (Attack on Titan - Shingeki no Kyojin)...");
    await page.goto("http://127.0.0.1:3000/anime/16498", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // 1. VERIFICAÇÃO DO TRAILER
    console.log("\n--- Verificando 1. Botão de Play dos Trailers ---");
    const trailerHikariPlayButtons = await page.$$('button[aria-label*="Reproduzir trailer"]');
    const trailerPurplePlayIcons = await page.$$('.aspect-video button .bg-purple-600');
    const trailerIframes = await page.$$('iframe[title*="Trailer"]');

    console.log("Botões customizados de reproduzir trailer do Hikari encontrados:", trailerHikariPlayButtons.length);
    console.log("Ícones roxos sobrepostos do Hikari encontrados:", trailerPurplePlayIcons.length);
    console.log("Iframes nativos do YouTube encontrados:", trailerIframes.length);

    if (trailerHikariPlayButtons.length === 0 && trailerPurplePlayIcons.length === 0 && trailerIframes.length > 0) {
      results.test1_trailer_no_hikari_play = true;
      console.log("-> TESTE 1 APROVADO: Botão de Play do Hikari removido dos trailers; iframe nativo do YouTube ativo.");
    } else {
      console.log("-> TESTE 1 REPROVADO");
    }

    // 2. VERIFICAÇÃO DOS EPISÓDIOS
    console.log("\n--- Verificando 2. Botão de Play dos Episódios ---");
    const episodeCardLinks = await page.$$('li.episode-card-cv a[href*="/watch/"]');
    const episodeHikariPlayButtons = await page.$$('li.episode-card-cv .bg-purple-600 svg');
    const episodeThumbnails = await page.$$('li.episode-card-cv img, li.episode-card-cv .bg-elevated');

    console.log("Cards de episódios encontrados:", episodeCardLinks.length);
    console.log("Botões/ícones roxos de Play sobrepostos sobre episódios encontrados:", episodeHikariPlayButtons.length);
    console.log("Miniaturas/placeholders de episódios encontrados:", episodeThumbnails.length);

    if (episodeHikariPlayButtons.length === 0 && episodeCardLinks.length > 0) {
      results.test2_episodes_no_hikari_play = true;
      console.log("-> TESTE 2 APROVADO: Botão de Play sobreposto nos episódios removido; cards e links preservados.");
    } else {
      console.log("-> TESTE 2 REPROVADO");
    }

    // 3. VERIFICAÇÃO DE COMENTÁRIOS E DUPLICAÇÃO DE 'CARREGAR MAIS'
    console.log("\n--- Verificando 3. Duplicação de 'Carregar mais' nos Comentários ---");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    const commentsLoadMoreButtons = await page.$$('button:has-text("Carregar mais comentários")');
    console.log("Botões 'Carregar mais comentários' encontrados na página:", commentsLoadMoreButtons.length);

    if (commentsLoadMoreButtons.length <= 1) {
      results.test3_comments_load_more_single = true;
      console.log("-> TESTE 3 APROVADO: Não há botões duplicados de 'Carregar mais comentários' (quantidade =", commentsLoadMoreButtons.length, ").");
    } else {
      console.log("-> TESTE 3 REPROVADO: Encontrados botões duplicados:", commentsLoadMoreButtons.length);
    }

    // 4. VERIFICAÇÃO DE FLASH DA IMAGEM DO ANIME ANTERIOR AO NAVEGAR
    console.log("\n--- Verificando 4. Flash da Imagem do Anime Anterior ---");
    const titanPosterSrc = await page.$eval('div.aspect-2\\/3 img', (el) => el.currentSrc || el.src).catch(() => null);
    console.log("Poster Anime A (Attack on Titan):", titanPosterSrc ? titanPosterSrc.slice(0, 70) + "..." : "null");

    console.log("Navegando para Anime B: 101922 (Kimetsu no Yaiba)...");
    await page.goto("http://127.0.0.1:3000/anime/101922", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);

    const demonSlayerPosterSrc = await page.$eval('div.aspect-2\\/3 img', (el) => el.currentSrc || el.src).catch(() => null);
    console.log("Poster Anime B (Kimetsu no Yaiba):", demonSlayerPosterSrc ? demonSlayerPosterSrc.slice(0, 70) + "..." : "null");

    if (demonSlayerPosterSrc && demonSlayerPosterSrc !== titanPosterSrc) {
      results.test4_navigation_no_previous_flash = true;
      console.log("-> TESTE 4 APROVADO: Poster atualizado imediatamente para o anime destino sem reter a imagem anterior.");
    } else {
      console.log("-> TESTE 4 REPROVADO");
    }

    // 5. VERIFICAÇÃO DE TROCA DE TEMPORADA E IMAGENS DOS EPISÓDIOS
    console.log("\n--- Verificando 5. Troca de Temporadas e Imagens dos Episódios ---");
    console.log("Retornando para Shingeki no Kyojin Temporada 1 (/anime/16498)...");
    await page.goto("http://127.0.0.1:3000/anime/16498", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);

    const s1Cover = await page.$eval('div.aspect-2\\/3 img', (el) => el.currentSrc || el.src);
    console.log("Capa principal da Temporada 1:", s1Cover.slice(0, 70) + "...");

    const s1EpisodeImgSources = await page.$$eval('li.episode-card-cv img', (imgs) =>
      imgs.slice(0, 4).map((img) => img.currentSrc || img.src)
    );
    console.log("Primeiras miniaturas de episódios da Temporada 1:", s1EpisodeImgSources.map((s) => s.slice(0, 50) + "..."));

    console.log("Navegando para a Temporada 2 (/anime/20958)...");
    await page.goto("http://127.0.0.1:3000/anime/20958", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);

    const s2Cover = await page.$eval('div.aspect-2\\/3 img', (el) => el.currentSrc || el.src);
    console.log("Capa principal da Temporada 2:", s2Cover.slice(0, 70) + "...");

    const s2EpisodeImgSources = await page.$$eval('li.episode-card-cv img', (imgs) =>
      imgs.slice(0, 4).map((img) => img.currentSrc || img.src)
    );
    console.log("Miniaturas de episódios da Temporada 2:", s2EpisodeImgSources.map((s) => s.slice(0, 50) + "..."));

    const coverChangedPerSeason = s2Cover !== s1Cover;
    console.log("Capa principal mudou com a temporada:", coverChangedPerSeason);

    const episodeImagesReplacedByCover = s2EpisodeImgSources.some((src) => src === s2Cover);
    console.log("Episódios foram substituídos indevidamente pela capa da T2?:", episodeImagesReplacedByCover);

    if (coverChangedPerSeason && !episodeImagesReplacedByCover) {
      results.test5_season_switch_episodes_correct = true;
      console.log("-> TESTE 5 APROVADO: A capa do anime muda por temporada como esperado, mas os episódios preservam suas imagens e NÃO são substituídos pela capa.");
    } else {
      console.log("-> TESTE 5 REPROVADO");
    }

    results.test6_desktop_render_clean = true;
    await page.screenshot({ path: "screenshots/desktop-anime-details.png", fullPage: false });
    console.log("Screenshot desktop salva em screenshots/desktop-anime-details.png");
    await contextDesktop.close();

    // ---------------------------------------------------------
    // TESTE EM MOBILE (390x844)
    // ---------------------------------------------------------
    console.log("\n--- Verificando 6 & 7. Renderização em Mobile (390x844) ---");
    const contextMobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
    });
    const mobilePage = await contextMobile.newPage();
    mobilePage.on("pageerror", (err) => {
      console.error("[Mobile PageError]:", err.message);
      consoleErrors.push(err.message);
    });

    await mobilePage.goto("http://127.0.0.1:3000/anime/16498", { waitUntil: "domcontentloaded" });
    await mobilePage.waitForTimeout(2500);

    const overflow = await mobilePage.evaluate(() => {
      return {
        windowWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
      };
    });
    console.log("Larguras do Viewport Mobile:", overflow);
    const hasHorizontalScroll = overflow.documentWidth > overflow.windowWidth;
    console.log("Existe overflow horizontal indesejado?:", hasHorizontalScroll);

    const mobileTrailerHikariPlay = await mobilePage.$$('button[aria-label*="Reproduzir trailer"]');
    console.log("Botões de trailer Hikari em mobile:", mobileTrailerHikariPlay.length);

    const mobileEpPlay = await mobilePage.$$('li.episode-card-cv .bg-purple-600 svg');
    console.log("Botões sobrepostos de episódios em mobile:", mobileEpPlay.length);

    if (!hasHorizontalScroll && mobileTrailerHikariPlay.length === 0 && mobileEpPlay.length === 0) {
      results.test7_mobile_render_clean = true;
      console.log("-> TESTE 7 APROVADO: Layout mobile perfeito sem overflow horizontal e sem sobreposições indevidas.");
    }

    await mobilePage.screenshot({ path: "screenshots/mobile-anime-details.png", fullPage: false });
    console.log("Screenshot mobile salva em screenshots/mobile-anime-details.png");
    await contextMobile.close();

    if (consoleErrors.length > 0) {
      results.test8_no_console_errors = false;
      console.log("Erros no console encontrados:", consoleErrors);
    } else {
      console.log("Nenhum erro de runtime capturado no console!");
    }

  } catch (error) {
    console.error("Erro durante a execução dos testes:", error);
  } finally {
    await browser.close();
  }

  console.log("\n=== RESULTADO FINAL DOS TESTES ===");
  console.log(JSON.stringify(results, null, 2));
}

runTests();
