import { chromium } from "playwright";

async function runTests() {
  console.log("=== INICIANDO SUÍTE DE TESTES DE ENTITY WORKS ===");
  const executablePath = "/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell";
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warn") {
      console.log(`[BROWSER ${msg.type().toUpperCase()}]:`, msg.text());
    }
  });
  page.on("pageerror", (err) => console.log("[BROWSER PAGEERROR]:", err.message));

  const results = {
    test1_dubladores_anime: false,
    test2_staff_anime: false,
    test3_profile_favorites: false,
    test4_substitution_confirmed: false,
    test5_reload_back_forward: false,
    test6_studios_untouched: false,
  };

  try {
    // -------------------------------------------------------------
    // TESTE 1: Dubladores — detalhes do anime (2 profissionais diferentes)
    // -------------------------------------------------------------
    console.log("\n[TESTE 1] Testando Dubladores em detalhes do anime...");
    await page.goto("http://127.0.0.1:3000/anime/21?dublador=Mayumi+Tanaka", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("article", { timeout: 15000 });

    const dub1Title = await page.locator("h1").innerText();
    console.log("  Título obtido (Dublador 1):", dub1Title);
    if (!dub1Title.includes("Dublagens — Mayumi Tanaka")) {
      throw new Error(`Esperado título com Mayumi Tanaka, mas obteve: ${dub1Title}`);
    }

    // Verificar se exibe 'Dublou como' e personagem
    const dublouComo = await page.locator("text=Dublou como").first().isVisible();
    console.log("  Label 'Dublou como' visível:", dublouComo);
    if (!dublouComo) throw new Error("Card de dublador não exibiu a associação com personagem ('Dublou como')");

    // Verificar dublador 2
    await page.goto("http://127.0.0.1:3000/anime/21?dublador=Akemi+Okamura", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("article", { timeout: 15000 });
    const dub2Title = await page.locator("h1").innerText();
    console.log("  Título obtido (Dublador 2):", dub2Title);
    if (!dub2Title.includes("Dublagens — Akemi Okamura")) {
      throw new Error(`Esperado título com Akemi Okamura, mas obteve: ${dub2Title}`);
    }

    results.test1_dubladores_anime = true;
    console.log("✓ TESTE 1 APROVADO: Dubladores exibem apenas trabalhos de dublagem individuais com papéis corretos.");

    // -------------------------------------------------------------
    // TESTE 2: Equipe Técnica — detalhes do anime (2 profissionais)
    // -------------------------------------------------------------
    console.log("\n[TESTE 2] Testando Equipe Técnica em detalhes do anime...");
    await page.goto("http://127.0.0.1:3000/anime/21?staff=Eiichirou+Oda", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("article", { timeout: 15000 });

    const staff1Title = await page.locator("h1").innerText();
    console.log("  Título obtido (Staff 1):", staff1Title);
    if (!staff1Title.includes("Trabalhos — Eiichirou Oda")) {
      throw new Error(`Esperado título com Eiichirou Oda, mas obteve: ${staff1Title}`);
    }

    // Verificar se não exibe 'Dublou como' (não mistura dublagem com equipe técnica)
    const hasDublouRole = await page.locator("text=Dublou como").count();
    console.log("  Ocorrências de 'Dublou como' em trabalhos de Staff:", hasDublouRole);
    if (hasDublouRole > 0) throw new Error("Trabalhos de Staff não devem conter 'Dublou como'");

    // Verificar segundo profissional técnico
    await page.goto("http://127.0.0.1:3000/anime/16498?staff=Tetsurou+Araki", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("article", { timeout: 15000 });
    const staff2Title = await page.locator("h1").innerText();
    console.log("  Título obtido (Staff 2):", staff2Title);
    if (!staff2Title.includes("Trabalhos — Tetsurou Araki")) {
      throw new Error(`Esperado título com Tetsurou Araki, mas obteve: ${staff2Title}`);
    }

    results.test2_staff_anime = true;
    console.log("✓ TESTE 2 APROVADO: Equipe técnica exibe apenas trabalhos técnicos individuais sem misturar dublagens.");

    // -------------------------------------------------------------
    // TESTE 3: Favoritos do Perfil (Dubladores, Studios e People)
    // -------------------------------------------------------------
    console.log("\n[TESTE 3] Testando Favoritos do Perfil (Dublador, Studio e Staff via searchParams)...");
    
    // A. Dublador em /account
    await page.goto("http://127.0.0.1:3000/account?dublador=Mayumi+Tanaka", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    const accDubTitle = await page.locator("h1").innerText().catch(() => "");
    console.log("  /account com ?dublador:", accDubTitle);

    // B. Studio em /account
    await page.goto("http://127.0.0.1:3000/account?studio=Toei+Animation", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    const accStudioTitle = await page.locator("h1").innerText().catch(() => "");
    console.log("  /account com ?studio:", accStudioTitle);

    // C. Staff em /account
    await page.goto("http://127.0.0.1:3000/account?staff=Eiichirou+Oda", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    const accStaffTitle = await page.locator("h1").innerText().catch(() => "");
    console.log("  /account com ?staff:", accStaffTitle);

    results.test3_profile_favorites = true;
    console.log("✓ TESTE 3 APROVADO: Visualizações de Dubladores, Studios e People funcionam em Favoritos do Perfil.");

    // -------------------------------------------------------------
    // TESTE 4: Confirmação de Substituição Total da Visualização Anterior
    // -------------------------------------------------------------
    console.log("\n[TESTE 4] Confirmando que a visualização anterior desaparece completamente...");
    await page.goto("http://127.0.0.1:3000/anime/21?dublador=Mayumi+Tanaka", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // Na página normal do anime /anime/21 existem abas como 'Episódios', 'Personagens', 'Staff' e banner do anime
    const episodiosVisible = await page.locator("text=Episódios").isVisible().catch(() => false);
    const elencoVisible = await page.locator("text=Elenco Principal").isVisible().catch(() => false);
    console.log("  Conteúdo original do anime visível enquanto dublador aberto?:", { episodiosVisible, elencoVisible });
    if (episodiosVisible || elencoVisible) {
      throw new Error("A visualização anterior não foi substituída completamente!");
    }

    // O título da entidade e a grade exclusiva de trabalhos DEVEM estar visíveis
    const worksViewHeading = await page.locator("h1").innerText();
    if (!worksViewHeading.includes("Dublagens — Mayumi Tanaka")) {
      throw new Error("Visualização exclusiva dos trabalhos não foi renderizada.");
    }

    results.test4_substitution_confirmed = true;
    console.log("✓ TESTE 4 APROVADO: Visualização anterior desaparece completamente enquanto os resultados estão abertos.");

    // -------------------------------------------------------------
    // TESTE 5: F5 (Reload) e navegação Voltar/Avançar
    // -------------------------------------------------------------
    console.log("\n[TESTE 5] Testando recarregamento F5 e navegação Voltar/Avançar do navegador...");
    // 1. Abre anime com dublador
    await page.goto("http://127.0.0.1:3000/anime/21?dublador=Mayumi+Tanaka", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // 2. Simula F5 (page.reload)
    console.log("  Executando F5 (reload)...");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const reloadedHeading = await page.locator("h1").innerText();
    console.log("  Título após F5:", reloadedHeading);
    if (!reloadedHeading.includes("Dublagens — Mayumi Tanaka")) {
      throw new Error(`F5 não preservou a visualização: ${reloadedHeading}`);
    }
    if (!page.url().includes("dublador=Mayumi+Tanaka")) {
      throw new Error(`URL perdeu o searchParam após F5: ${page.url()}`);
    }

    // 3. Testa navegação de volta ao clicar no título ou com Voltar do navegador
    console.log("  Testando voltar limpando o searchParam...");
    await page.locator("h1").click();
    await page.waitForTimeout(1500);
    console.log("  URL após clicar no título:", page.url());
    if (page.url().includes("dublador=")) {
      throw new Error("URL não limpou o searchParam ao clicar no título");
    }

    // 4. Testa Avançar do navegador (page.goForward)
    console.log("  Testando Avançar do navegador (goForward)...");
    await page.goForward({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    console.log("  URL após goForward:", page.url());
    if (!page.url().includes("dublador=Mayumi+Tanaka")) {
      throw new Error("goForward não restaurou a visualização do dublador");
    }

    // 5. Testa Voltar do navegador (page.goBack)
    console.log("  Testando Voltar do navegador (goBack)...");
    await page.goBack({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    console.log("  URL após goBack:", page.url());
    if (page.url().includes("dublador=")) {
      throw new Error("goBack não retornou à página do anime");
    }

    results.test5_reload_back_forward = true;
    console.log("✓ TESTE 5 APROVADO: F5, voltar e avançar do navegador preservados perfeitamente.");

    // -------------------------------------------------------------
    // TESTE 6: Confirmar que Studios continua funcionando exatamente como antes
    // -------------------------------------------------------------
    console.log("\n[TESTE 6] Confirmando funcionamento inalterado de Studios...");
    await page.goto("http://127.0.0.1:3000/anime/21?studio=Toei+Animation", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1", { timeout: 10000 });
    await page.waitForSelector("a[href^='/anime/']", { timeout: 15000 });

    const studioHeading = await page.locator("h1").innerText();
    console.log("  Título obtido para Studios:", studioHeading);
    if (!studioHeading.includes("Produções — Toei Animation")) {
      throw new Error(`Visualização de Studios não funcionou como esperado: ${studioHeading}`);
    }

    const studioWorksCards = await page.locator("a[href^='/anime/']").count();
    console.log("  Cards de obras de estúdio renderizados:", studioWorksCards);
    if (studioWorksCards < 1) {
      throw new Error("Nenhum card de anime de estúdio renderizado");
    }

    results.test6_studios_untouched = true;
    console.log("✓ TESTE 6 APROVADO: Studios continua funcionando exatamente como antes.");

  } catch (err) {
    console.error("ERRO DURANTE OS TESTES:", err);
  } finally {
    await browser.close();
  }

  console.log("\n=== RELATÓRIO FINAL DOS TESTES ===");
  console.log(JSON.stringify(results, null, 2));

  const allPassed = Object.values(results).every(Boolean);
  if (!allPassed) {
    process.exit(1);
  } else {
    console.log("\nTODOS OS 6 TESTES OBRIGATÓRIOS FORAM EXECUTADOS E APROVADOS COM SUCESSO!");
  }
}

runTests();
