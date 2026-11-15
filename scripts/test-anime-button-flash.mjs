import { chromium } from "playwright";

async function run() {
  console.log("=== INICIANDO TESTE DE ELIMINAÇÃO DE FLASH DOS BOTÕES DOS DETALHES ===");

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

  // 1. Acessa a página inicial para inicializar o domínio e localStorage
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });

  const targetAnimeId = "21"; // One Piece - anime real do catálogo

  // 2. Prepara o usuário em sessão e o estado salvo de progresso (ep. 1), status Completo (completed), e Favoritos
  await page.evaluate(({ animeId }) => {
    window.sessionStorage.setItem("hikari_preview_admin_email", "admin@hikari.tv");

    // A) Cache de cliente síncrono hikari_anime_user_cache_v1
    const animeCache = {
      [animeId]: {
        trackingStatus: "completed",
        episodesWatched: 12,
        score: 10,
        dbAnimeId: animeId,
        isFavorite: true,
        favFavoriteId: "fav-test-123",
        continueEpisode: { id: "ep-1", number: 1 },
        cachedAt: Date.now(),
      },
      "one-piece": {
        trackingStatus: "completed",
        episodesWatched: 12,
        score: 10,
        dbAnimeId: "21",
        isFavorite: true,
        favFavoriteId: "fav-test-123",
        continueEpisode: { id: "ep-1", number: 1 },
        cachedAt: Date.now(),
      },
    };
    window.localStorage.setItem(
      "hikari_anime_user_cache_v1",
      JSON.stringify(animeCache),
    );

    // B) Store hikari-user-state-v1 (continueWatching)
    try {
      const rawUserStore = window.localStorage.getItem("hikari-user-state-v1");
      const userStore = rawUserStore ? JSON.parse(rawUserStore) : { state: {} };
      if (!userStore.state) userStore.state = {};
      userStore.state.continueWatching = [
        {
          animeId,
          episodeId: "ep-1",
          episodeNumber: 1,
          episodeTitle: "Renascimento",
          cover: "",
          title: "One Piece",
          updatedAt: Date.now(),
        },
      ];
      userStore.state.myList = [animeId];
      window.localStorage.setItem(
        "hikari-user-state-v1",
        JSON.stringify(userStore),
      );
    } catch (e) {
      console.warn("Erro ao configurar store:", e);
    }
  }, { animeId: targetAnimeId });

  // 3. Adiciona init script para registrar cada estado exibido nos 3 botões desde o 1º milissegundo de montagem
  await page.addInitScript(() => {
    window.__buttonStatesLog = [];

    const record = () => {
      const watchBtn = document.querySelector('a[href*="/watch/"]');
      const collectionBtn = document.querySelector('button[aria-label*="Coleção"], button[aria-label*="Minha"]');
      const favBtn = document.querySelector('button[aria-label*="favoritos"]');

      if (watchBtn || collectionBtn || favBtn) {
        window.__buttonStatesLog.push({
          time: performance.now(),
          watchText: watchBtn ? watchBtn.textContent?.trim() : null,
          collectionText: collectionBtn ? collectionBtn.textContent?.trim() : null,
          favText: favBtn ? favBtn.textContent?.trim() : null,
          favAria: favBtn ? favBtn.getAttribute("aria-label") : null,
        });
      }
    };

    const interval = setInterval(record, 4);

    const observer = new MutationObserver(record);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    window.addEventListener("load", () => {
      record();
      setTimeout(() => clearInterval(interval), 5000);
    });
  });

  // 4. Navega diretamente para os detalhes do anime com estado salvo
  console.log(`Navegando para http://localhost:3000/anime/${targetAnimeId}...`);
  await page.goto(`http://localhost:3000/anime/${targetAnimeId}`, {
    waitUntil: "networkidle",
  });

  // 5. Coleta o log de estados registrados pelo MutationObserver
  const log = await page.evaluate(() => window.__buttonStatesLog || []);
  console.log(`\nForam capturadas ${log.length} mutações durante a carga e hidratação.`);

  const watchStates = Array.from(new Set(log.map((l) => l.watchText).filter(Boolean)));
  const collectionStates = Array.from(new Set(log.map((l) => l.collectionText).filter(Boolean)));
  const favStates = Array.from(new Set(log.map((l) => l.favText).filter(Boolean)));

  console.log("\n--- HISTÓRICO DE ESTADOS CAPTURADOS (DO 1º FRAME AO FINAL) ---");
  console.log("Estados do Botão Assistir:", watchStates);
  console.log("Estados do Botão Coleção/Lista:", collectionStates);
  console.log("Estados do Botão Favoritos:", favStates);

  // 6. Tira screenshot para conferência visual
  await page.screenshot({ path: "screenshots/anime_details_buttons_no_flash.png" });
  console.log("\nScreenshot salvo em: screenshots/anime_details_buttons_no_flash.png");

  // 7. Validação estrita contra flashes:
  // A) O botão de assistir NUNCA deve ter exibido o texto genérico "Assistir"
  const hadWatchFlash = watchStates.some((text) => text === "Assistir");
  if (hadWatchFlash) {
    throw new Error(`[FALHA] O botão Assistir exibiu brevemente "Assistir" antes do progresso! Estados: ${JSON.stringify(watchStates)}`);
  }
  const hasContinue = watchStates.some((text) => text.includes("Continuar no ep. 1"));
  if (!hasContinue) {
    throw new Error(`[FALHA] O botão Assistir não exibiu "Continuar no ep. 1"! Estados: ${JSON.stringify(watchStates)}`);
  }
  console.log("✓ Botão Assistir: Exibiu diretamente 'Continuar no ep. 1' sem nenhum flash de 'Assistir'!");

  // B) O botão de coleção NUNCA deve ter exibido o texto genérico "Minha Coleção"
  const hadCollectionFlash = collectionStates.some((text) => text === "Minha Coleção");
  if (hadCollectionFlash) {
    throw new Error(`[FALHA] O botão Minha Coleção exibiu brevemente "Minha Coleção" antes do status! Estados: ${JSON.stringify(collectionStates)}`);
  }
  const hasCompleted = collectionStates.some((text) => text.includes("Concluído") || text.includes("Completo"));
  if (!hasCompleted) {
    throw new Error(`[FALHA] O botão de coleção não exibiu status salvo! Estados: ${JSON.stringify(collectionStates)}`);
  }
  console.log("✓ Botão Minha Lista/Coleção: Exibiu diretamente o status salvo sem nenhum flash!");

  // C) O botão de favoritos NUNCA deve ter exibido "Favoritar"
  const hadFavoriteFlash = favStates.some((text) => text === "Favoritar");
  if (hadFavoriteFlash) {
    throw new Error(`[FALHA] O botão Favoritos exibiu brevemente "Favoritar" antes de favoritado! Estados: ${JSON.stringify(favStates)}`);
  }
  const hasFavoritado = favStates.some((text) => text.includes("Favoritado"));
  if (!hasFavoritado) {
    throw new Error(`[FALHA] O botão Favoritos não exibiu 'Favoritado'! Estados: ${JSON.stringify(favStates)}`);
  }
  console.log("✓ Botão Favoritos: Exibiu diretamente 'Favoritado' sem nenhum flash!");

  // 8. Teste de Recarregamento (Reload)
  console.log("\n[Teste de Recarregamento] Recarregando a página (F5 / page.reload)...");
  await page.reload({ waitUntil: "networkidle" });
  
  const reloadLog = await page.evaluate(() => window.__buttonStatesLog || []);
  const reloadWatchStates = Array.from(new Set(reloadLog.map((l) => l.watchText).filter(Boolean)));
  const reloadCollectionStates = Array.from(new Set(reloadLog.map((l) => l.collectionText).filter(Boolean)));
  const reloadFavStates = Array.from(new Set(reloadLog.map((l) => l.favText).filter(Boolean)));

  console.log("Reload - Estados do Botão Assistir:", reloadWatchStates);
  console.log("Reload - Estados do Botão Coleção/Lista:", reloadCollectionStates);
  console.log("Reload - Estados do Botão Favoritos:", reloadFavStates);

  if (reloadWatchStates.some((text) => text === "Assistir")) {
    throw new Error("[FALHA] No reload, o botão Assistir exibiu brevemente 'Assistir'!");
  }
  if (reloadCollectionStates.some((text) => text === "Minha Coleção")) {
    throw new Error("[FALHA] No reload, o botão Coleção exibiu brevemente 'Minha Coleção'!");
  }
  if (reloadFavStates.some((text) => text === "Favoritar")) {
    throw new Error("[FALHA] No reload, o botão Favoritos exibiu brevemente 'Favoritar'!");
  }

  await page.screenshot({ path: "screenshots/anime_details_buttons_reloaded.png" });
  console.log("✓ Teste de recarregamento passou com sucesso absoluto!");

  await browser.close();
  console.log("\n=== TODOS OS TESTES PASSARAM COM SUCESSO! ZERO FLASHES DETECTADOS! ===");
}

run().catch((err) => {
  console.error("ERRO NO TESTE:", err);
  process.exit(1);
});
