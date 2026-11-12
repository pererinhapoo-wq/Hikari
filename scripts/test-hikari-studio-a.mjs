import { chromium } from "playwright";
import fs from "fs";

async function main() {
  if (!fs.existsSync("screenshots")) {
    fs.mkdirSync("screenshots", { recursive: true });
  }

  const browser = await chromium.launch({
    executablePath: "/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const baseUrl = "http://localhost:3000";

  console.log("==================================================================");
  console.log("   HIKARI STUDIO — VALIDAÇÃO DA ETAPA A (NOVA ESTRUTURA VISUAL)   ");
  console.log("==================================================================");

  // -------------------------------------------------------------
  // TESTE 1: Isolamento do Site Público (Home)
  // -------------------------------------------------------------
  const publicContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const publicPage = await publicContext.newPage();

  console.log("1. Testando rota pública (/)...");
  await publicPage.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await publicPage.waitForTimeout(1500);

  const publicHeaderExists = await publicPage.locator("header nav").count() > 0;
  const studioSidebarInPublic = await publicPage.locator("aside:has-text('HIKARI STUDIO')").count();
  console.log(`   - Cabeçalho público presente: ${publicHeaderExists ? "SIM" : "NÃO"}`);
  console.log(`   - Sidebar do Studio vazou na Home: ${studioSidebarInPublic > 0 ? "SIM (ERRO)" : "NÃO (CORRETO)"}`);

  if (!publicHeaderExists || studioSidebarInPublic > 0) {
    throw new Error("Falha no isolamento do site público!");
  }
  console.log("   -> [TESTE 1 APROVADO] Site público perfeitamente isolado.");

  // -------------------------------------------------------------
  // TESTE 2: Bloqueio de Acesso Não Autorizado ao /admin
  // -------------------------------------------------------------
  console.log("2. Testando bloqueio de acesso não autenticado ao /admin...");
  await publicPage.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
  try {
    await publicPage.waitForURL((url) => url.pathname.includes("/login") || url.pathname.includes("/account"), {
      timeout: 5000,
    });
  } catch {
    // Continua para checagem da URL
  }
  const currentUrl = publicPage.url();
  const redirectedToLogin = currentUrl.includes("/login") || currentUrl.includes("/account");
  console.log(`   - Redirecionado para autenticação: ${redirectedToLogin ? "SIM (" + currentUrl + ")" : "NÃO"}`);

  if (!redirectedToLogin) {
    throw new Error("Falha na proteção de rota não autenticada!");
  }
  console.log("   -> [TESTE 2 APROVADO] Redirecionamento de segurança ativo.");
  await publicContext.close();

  // -------------------------------------------------------------
  // TESTE 3: Acesso Administrativo Autorizado no Desktop (1440x900)
  // -------------------------------------------------------------
  console.log("3. Testando acesso com sessão administrativa autorizada no Desktop (1440x900)...");
  const adminContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const adminPage = await adminContext.newPage();

  // Injeta sessão de administrador autorizada (nexaweeb@gmail.com)
  await adminPage.addInitScript(() => {
    try {
      window.sessionStorage.setItem("hikari_preview_admin_email", "nexaweeb@gmail.com");
    } catch {
      // Ignorar no ambiente do teste
    }
  });

  // Também interceptamos a rota /api/auth/get-session para retornar usuário admin
  await adminPage.route("**/api/auth/get-session", async (route) => {
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

  await adminPage.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
  await adminPage.waitForTimeout(2000);

  const hasStudioSidebar = await adminPage.locator("aside:has-text('STUDIO')").count() > 0;
  console.log(`   - Sidebar fixa HIKARI STUDIO visível: ${hasStudioSidebar ? "SIM" : "NÃO"}`);

  const hasBreadcrumb = await adminPage.locator("header:has-text('Hikari Studio')").count() > 0;
  console.log(`   - Breadcrumb visual hierárquico ativo: ${hasBreadcrumb ? "SIM" : "NÃO"}`);

  const hasPublicReturnLink = await adminPage.locator("a:has-text('Voltar ao site público')").count() > 0;
  console.log(`   - Opção para voltar ao site público disponível: ${hasPublicReturnLink ? "SIM" : "NÃO"}`);

  const desktopOverflow = await adminPage.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  console.log(`   - Transbordo horizontal no Desktop: ${desktopOverflow ? "SIM (ERRO)" : "NÃO (CORRETO)"}`);

  await adminPage.screenshot({ path: "screenshots/studio-desktop.png", fullPage: false });
  console.log("   - Captura salva em: screenshots/studio-desktop.png");

  if (!hasStudioSidebar || !hasPublicReturnLink || desktopOverflow) {
    throw new Error("Falha na renderização desktop do Hikari Studio!");
  }
  console.log("   -> [TESTE 3 APROVADO] Layout Desktop Hikari Studio perfeito.");
  await adminContext.close();

  // -------------------------------------------------------------
  // TESTE 4: Responsividade Mobile (390px e 360px) + Drawer Acessível
  // -------------------------------------------------------------
  console.log("4. Testando responsividade mobile estreita (390x844 e 360x740)...");
  for (const width of [390, 360]) {
    const mobileContext = await browser.newContext({
      viewport: { width, height: 800 },
      isMobile: true,
    });

    const mobilePage = await mobileContext.newPage();
    await mobilePage.addInitScript(() => {
      try {
        window.sessionStorage.setItem("hikari_preview_admin_email", "nexaweeb@gmail.com");
      } catch {
        // Ignorar no ambiente do teste
      }
    });
    await mobilePage.route("**/api/auth/get-session", async (route) => {
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

    await mobilePage.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
    await mobilePage.waitForTimeout(2000);

    // No mobile, a sidebar desktop deve estar oculta
    const desktopAsideVisible = await mobilePage.evaluate(() => {
      const aside = document.querySelector("aside");
      if (!aside) return false;
      const style = window.getComputedStyle(aside);
      return style.display !== "none";
    });
    console.log(`   [${width}px] Sidebar desktop oculta no mobile: ${!desktopAsideVisible ? "SIM" : "NÃO (ERRO)"}`);

    // Botão de menu hamburguer deve estar visível
    const menuBtn = mobilePage.locator("button[aria-label='Abrir menu lateral']");
    const menuBtnVisible = await menuBtn.isVisible();
    console.log(`   [${width}px] Botão hamburguer visível: ${menuBtnVisible ? "SIM" : "NÃO"}`);

    // Verifica overflow horizontal antes de abrir o drawer
    const preOverflow = await mobilePage.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    console.log(`   [${width}px] Transbordo horizontal da página: ${preOverflow ? "SIM (ERRO)" : "NÃO (CORRETO)"}`);

    // Abre o drawer
    await menuBtn.click();
    await mobilePage.waitForTimeout(500);

    const drawerVisible = await mobilePage.locator("div[role='dialog']:has-text('STUDIO')").isVisible();
    console.log(`   [${width}px] Drawer móvel aberto com sucesso: ${drawerVisible ? "SIM" : "NÃO"}`);

    // Clica no botão fechar do drawer
    const closeBtn = mobilePage.locator("button[aria-label='Fechar navegação']");
    await closeBtn.click();
    await mobilePage.waitForTimeout(300);

    const drawerClosed = !(await mobilePage.locator("div[role='dialog']").isVisible());
    console.log(`   [${width}px] Drawer fechado com sucesso: ${drawerClosed ? "SIM" : "NÃO"}`);

    if (width === 390) {
      await mobilePage.screenshot({ path: "screenshots/studio-mobile.png", fullPage: false });
      console.log("   - Captura mobile salva em: screenshots/studio-mobile.png");
    }

    if (desktopAsideVisible || !menuBtnVisible || preOverflow || !drawerVisible || !drawerClosed) {
      throw new Error(`Falha nos testes de responsividade mobile para ${width}px!`);
    }

    await mobileContext.close();
  }
  console.log("   -> [TESTE 4 APROVADO] Responsividade mobile e drawer 100% validados.");

  // -------------------------------------------------------------
  // TESTE 5: Navegação entre Rotas Administrativas Existentes
  // -------------------------------------------------------------
  console.log("5. Testando persistência do layout Studio em sub-rotas (/admin/moderation e /admin/hikari-ai)...");
  const navContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const navPage = await navContext.newPage();
  await navPage.addInitScript(() => {
    try {
      window.sessionStorage.setItem("hikari_preview_admin_email", "nexaweeb@gmail.com");
    } catch {
      // Ignorar no ambiente do teste
    }
  });
  await navPage.route("**/api/auth/get-session", async (route) => {
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

  for (const subRoute of ["/admin/moderation", "/admin/hikari-ai"]) {
    await navPage.goto(`${baseUrl}${subRoute}`, { waitUntil: "domcontentloaded" });
    await navPage.waitForSelector("aside", { timeout: 8000 });

    const hasStudioInSub = await navPage.locator("aside:has-text('STUDIO')").count() > 0;
    console.log(`   - ${subRoute} encapsulado no Hikari Studio: ${hasStudioInSub ? "SIM" : "NÃO"}`);

    if (!hasStudioInSub) {
      throw new Error(`Falha: ${subRoute} não renderizou dentro do Hikari Studio!`);
    }
  }
  console.log("   -> [TESTE 5 APROVADO] Todas as sub-rotas administrativas encapsuladas no Hikari Studio.");
  await navContext.close();

  await browser.close();
  console.log("==================================================================");
  console.log("   RESULTADO: TODOS OS TESTES DA ETAPA A FORAM APROVADOS! (100%)  ");
  console.log("==================================================================");
}

main().catch((err) => {
  console.error("ERRO NA VALIDAÇÃO:", err);
  process.exit(1);
});
