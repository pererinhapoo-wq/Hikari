import { chromium } from "playwright";
import fs from "fs";

async function run() {
  console.log("=== INICIANDO SUÍTE COMPLETA DE VALIDAÇÃO VISUAL DE TRABALHOS ===");

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
    test1_studioShortAndLong: false,
    test2_dubladorShortAndLong: false,
    test3_peopleStaff: false,
    test4_threeAnimesPerLineMobile: false,
    test5_headerFullnameAndImage: false,
    test6_fallbackNoImage: false,
    test7_reloadAndBackForward: false,
    details: [],
  };

  try {
    // -------------------------------------------------------------
    // TESTE 4 & 1: 3 animes por linha em telas móveis + Studio
    // -------------------------------------------------------------
    console.log("\n--- TESTE 4 & 1: Mobile 360x780 & Studio (Toei Animation) ---");
    const mobileContext = await browser.newContext({
      viewport: { width: 360, height: 780 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();

    console.log("Acessando /anime/21?studio=Toei%20Animation no mobile...");
    await mobilePage.goto("http://127.0.0.1:3000/anime/21?studio=Toei%20Animation", {
      waitUntil: "domcontentloaded",
    });
    await mobilePage.waitForTimeout(2500);

    // Verificar se o cabeçalho existe e contém nome completo
    const studioTitle = mobilePage.locator('h1:has-text("Produções — Toei Animation")');
    const isStudioTitleVisible = await studioTitle.isVisible();
    console.log("Título 'Produções — Toei Animation' visível no mobile:", isStudioTitleVisible);

    // Verificar logotipo do estúdio no cabeçalho
    const studioLogoImg = mobilePage.locator('header img[alt="Logo oficial de Toei Animation"]');
    const isStudioLogoVisible = await studioLogoImg.isVisible();
    console.log("Logotipo oficial de Toei Animation visível:", isStudioLogoVisible);

    // Verificar 3 animes por linha: pegar bounding boxes dos primeiros 3 cards
    const cards = mobilePage.locator('a[href^="/anime/"]');
    const cardCount = await cards.count();
    console.log(`Cards de anime encontrados: ${cardCount}`);

    if (cardCount >= 3) {
      const box0 = await cards.nth(0).boundingBox();
      const box1 = await cards.nth(1).boundingBox();
      const box2 = await cards.nth(2).boundingBox();

      console.log("Posição Card 0:", box0);
      console.log("Posição Card 1:", box1);
      console.log("Posição Card 2:", box2);

      // Em 3 colunas, os três primeiros cards devem ter o mesmo topo (ou quase idêntico com tolerância de 2px)
      const sameRow =
        Math.abs(box0.y - box1.y) < 3 &&
        Math.abs(box1.y - box2.y) < 3 &&
        box0.x < box1.x &&
        box1.x < box2.x;

      console.log("Três primeiros cards estão alinhados na mesma linha:", sameRow);
      if (sameRow) {
        results.test4_threeAnimesPerLineMobile = true;
      }
    }

    await mobilePage.screenshot({ path: "screenshots/test_mobile_3col_studio_toei.png" });

    // -------------------------------------------------------------
    // TESTE 1: Studio com nome longo (Bandai Namco Filmworks)
    // -------------------------------------------------------------
    console.log("\n--- TESTE 1: Studio com nome longo (Bandai Namco Filmworks) ---");
    await mobilePage.goto(
      "http://127.0.0.1:3000/anime/21?studio=Bandai%20Namco%20Filmworks",
      { waitUntil: "domcontentloaded" }
    );
    await mobilePage.waitForTimeout(2000);

    const longStudioTitle = mobilePage.locator('h1:has-text("Produções — Bandai Namco Filmworks")');
    const isLongStudioTitleVisible = await longStudioTitle.isVisible();
    console.log("Título estúdio longo visível:", isLongStudioTitleVisible);

    const hasEllipsisInTitle = await longStudioTitle.evaluate((el) => {
      // Confirma que não foi cortado por text-overflow ellipsis
      return el.scrollWidth > el.clientWidth && getComputedStyle(el).textOverflow === "ellipsis";
    });
    console.log("Título longo foi cortado com ellipsis no CSS:", hasEllipsisInTitle);

    if (isStudioTitleVisible && isLongStudioTitleVisible && !hasEllipsisInTitle) {
      results.test1_studioShortAndLong = true;
    }
    await mobilePage.screenshot({ path: "screenshots/test_mobile_studio_longname.png" });

    await mobileContext.close();

    // -------------------------------------------------------------
    // TESTE 2 & 5: Dubladores com nomes curtos e longos + Foto
    // -------------------------------------------------------------
    console.log("\n--- TESTE 2 & 5: Dubladores com foto e nome completo ---");
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 850 },
    });
    const desktopPage = await desktopContext.newPage();

    // Dublador curto: Yuuki Kaji em Shingeki no Kyojin
    console.log("Acessando /anime/16498?dublador=Yuuki%20Kaji...");
    await desktopPage.goto("http://127.0.0.1:3000/anime/16498?dublador=Yuuki%20Kaji", {
      waitUntil: "domcontentloaded",
    });
    await desktopPage.waitForTimeout(2500);

    const dubladorTitle = desktopPage.locator('h1:has-text("Dublagens — Yuuki Kaji")');
    const isDubladorVisible = await dubladorTitle.isVisible();
    console.log("Título 'Dublagens — Yuuki Kaji' visível:", isDubladorVisible);

    // Verificar se fotografia de Yuuki Kaji foi carregada no cabeçalho
    const dubladorPhoto = desktopPage.locator('header img[alt="Fotografia de Yuuki Kaji"]');
    const isPhotoVisible = await dubladorPhoto.isVisible();
    const photoSrc = isPhotoVisible ? await dubladorPhoto.getAttribute("src") : null;
    console.log("Fotografia de Yuuki Kaji visível:", isPhotoVisible, "src:", photoSrc?.slice(0, 50));

    // Verificar dublador com nome longo: Takehito Koyasu
    console.log("Acessando dublador com nome longo: Takehito Koyasu...");
    await desktopPage.goto(
      "http://127.0.0.1:3000/anime/16498?dublador=Takehito%20Koyasu",
      { waitUntil: "domcontentloaded" }
    );
    await desktopPage.waitForTimeout(2500);

    const longDubTitle = desktopPage.locator('h1:has-text("Dublagens — Takehito Koyasu")');
    const isLongDubVisible = await longDubTitle.isVisible();
    console.log("Título 'Dublagens — Takehito Koyasu' visível:", isLongDubVisible);

    if (isDubladorVisible && isLongDubVisible) {
      results.test2_dubladorShortAndLong = true;
    }
    if (isPhotoVisible && photoSrc) {
      results.test5_headerFullnameAndImage = true;
    }
    await desktopPage.screenshot({ path: "screenshots/test_desktop_dublador_view.png" });

    // -------------------------------------------------------------
    // TESTE 3: People / Equipe Técnica
    // -------------------------------------------------------------
    console.log("\n--- TESTE 3: People / Equipe Técnica (Tetsurou Araki) ---");
    await desktopPage.goto(
      "http://127.0.0.1:3000/anime/16498?staff=Tetsurou%20Araki",
      { waitUntil: "domcontentloaded" }
    );
    await desktopPage.waitForTimeout(2500);

    const staffTitle = desktopPage.locator('h1:has-text("Trabalhos — Tetsurou Araki")');
    const isStaffVisible = await staffTitle.isVisible();
    console.log("Título 'Trabalhos — Tetsurou Araki' visível:", isStaffVisible);

    const staffPhoto = desktopPage.locator('header img[alt="Fotografia de Tetsurou Araki"]');
    const isStaffPhotoVisible = await staffPhoto.isVisible();
    console.log("Fotografia de Tetsurou Araki visível:", isStaffPhotoVisible);

    if (isStaffVisible) {
      results.test3_peopleStaff = true;
    }
    await desktopPage.screenshot({ path: "screenshots/test_desktop_staff_view.png" });

    // -------------------------------------------------------------
    // TESTE 6: Fallback elegante quando não houver imagem
    // -------------------------------------------------------------
    console.log("\n--- TESTE 6: Fallback elegante sem foto / estúdio desconhecido ---");
    await desktopPage.goto(
      "http://127.0.0.1:3000/anime/21?studio=Estudio%20Independente%20Inexistente",
      { waitUntil: "domcontentloaded" }
    );
    await desktopPage.waitForTimeout(2000);

    const fallbackTitle = desktopPage.locator('h1:has-text("Produções — Estudio Independente Inexistente")');
    const isFallbackTitleVisible = await fallbackTitle.isVisible();
    console.log("Título com estúdio sem logo oficial visível:", isFallbackTitleVisible);

    // O cabeçalho deve exibir o logo dinâmico ou inicial elegante no container
    const headerImgOrInitial = desktopPage.locator('header div.rounded-xl');
    const isHeaderBoxVisible = await headerImgOrInitial.first().isVisible();
    console.log("Container de logo/inicial do cabeçalho visível:", isHeaderBoxVisible);

    // Teste dublador fictício para testar fallback de foto com inicial
    await desktopPage.goto(
      "http://127.0.0.1:3000/anime/21?dublador=Fulano%20de%20Tal%20Inexistente",
      { waitUntil: "domcontentloaded" }
    );
    await desktopPage.waitForTimeout(2000);

    const initialBadge = desktopPage.locator('header div:has-text("F")');
    const isInitialBadgeVisible = await initialBadge.first().isVisible();
    console.log("Inicial 'F' renderizada no fallback elegante da fotografia:", isInitialBadgeVisible);

    if (isFallbackTitleVisible && isHeaderBoxVisible && isInitialBadgeVisible) {
      results.test6_fallbackNoImage = true;
    }
    await desktopPage.screenshot({ path: "screenshots/test_fallback_initials.png" });

    // -------------------------------------------------------------
    // TESTE 7: Atualização com F5 (reload) e navegação voltar/avançar
    // -------------------------------------------------------------
    console.log("\n--- TESTE 7: Atualização com F5 e navegação voltar/avançar ---");
    await desktopPage.goto("http://127.0.0.1:3000/anime/21?studio=Toei%20Animation", {
      waitUntil: "domcontentloaded",
    });
    await desktopPage.waitForTimeout(2000);

    console.log("Recarregando (F5)...");
    await desktopPage.reload({ waitUntil: "domcontentloaded" });
    await desktopPage.waitForTimeout(2000);

    const isStudioVisibleAfterReload = await desktopPage
      .locator('h1:has-text("Produções — Toei Animation")')
      .isVisible();
    console.log("Visualização persistida após F5:", isStudioVisibleAfterReload);

    console.log("Navegando Voltar (goBack)...");
    await desktopPage.goBack({ waitUntil: "domcontentloaded" });
    await desktopPage.waitForTimeout(2000);

    const urlAfterBack = desktopPage.url();
    console.log("URL após goBack:", urlAfterBack);

    console.log("Navegando Avançar (goForward)...");
    await desktopPage.goForward({ waitUntil: "domcontentloaded" });
    await desktopPage.waitForTimeout(2000);

    const isStudioVisibleAfterForward = await desktopPage
      .locator('h1:has-text("Produções — Toei Animation")')
      .isVisible();
    console.log("Visualização restaurada após goForward:", isStudioVisibleAfterForward);

    if (isStudioVisibleAfterReload && isStudioVisibleAfterForward) {
      results.test7_reloadAndBackForward = true;
    }

    await desktopContext.close();
  } catch (err) {
    console.error("Erro durante execução:", err);
    results.details.push(String(err));
  } finally {
    await browser.close();
  }

  console.log("\n=== RESULTADOS FINAIS DA VALIDAÇÃO ===");
  console.log(JSON.stringify(results, null, 2));

  const allPassed = Object.entries(results)
    .filter(([k]) => k.startsWith("test"))
    .every(([, v]) => v === true);

  console.log(`\nStatus Geral: ${allPassed ? "SUCESSO TOTAL (TODOS OS TESTES PASSARAM)" : "FALHA EM ALGUNS TESTES"}`);
  if (!allPassed) {
    process.exit(1);
  }
}

run();
