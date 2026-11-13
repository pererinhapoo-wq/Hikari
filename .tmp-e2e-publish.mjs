import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { createServer } from "vite";
import { chromium } from "playwright";

// Ensure app-env matches VITE_AUTH_ENABLED=false
process.env.VITE_AUTH_ENABLED = "false";

const PORT = 3099;
const BASE_URL = `http://localhost:${PORT}`;

function signCookie(value, secret) {
  const signature = createHmac("sha256", secret).update(value).digest("base64");
  return `${value}.${signature}`;
}

async function spaNavigate(page, path) {
  await page.evaluate((targetPath) => {
    window.history.pushState({}, "", targetPath);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}

async function main() {
  console.log("[E2E] Starting temporary Vite server on port", PORT);
  const server = await createServer({
    server: {
      port: PORT,
      host: "127.0.0.1",
      strictPort: true,
    },
    optimizeDeps: {
      noDiscovery: false,
    },
  });
  await server.listen();

  let browser = null;
  try {
    // 1. Initialize PGLite + Migrations + Admin Session inside server process
    const dbMod = await server.ssrLoadModule("/src/lib/db.ts");
    const catMod = await server.ssrLoadModule("/src/lib/catalog-episodes.ts");
    const authMod = await server.ssrLoadModule("/src/lib/auth/server.ts");

    const sql = await dbMod.getSql();
    const sessionToken = `test-admin-token-${randomUUID()}`;
    const sessionId = `sess-${randomUUID()}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const users = await sql.query(
      `SELECT "id", "email" FROM "user" WHERE "id" = 'pererinha_id' LIMIT 1;`,
    );
    assert.equal(users.length, 1, "Seeded admin user pererinha_id must exist in PGLite");

    await sql.query(
      `INSERT INTO "session" ("id", "expiresAt", "token", "createdAt", "updatedAt", "userId")
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'pererinha_id');`,
      [sessionId, expiresAt, sessionToken],
    );

    const signedCookieValue = signCookie(
      sessionToken,
      "hikari-auth-disabled-local-secret",
    );
    const verifyHeaders = new Headers({
      cookie: `${authMod.SESSION_TOKEN_COOKIE}=${encodeURIComponent(signedCookieValue)}`,
    });
    const sessionCheck = await authMod.auth.api.getSession({ headers: verifyHeaders });
    assert.equal(
      sessionCheck?.user?.email,
      "pererinhapoo@gmail.com",
      "Better Auth session verification must resolve admin user",
    );
    console.log("[E2E] Better Auth admin session verified for:", sessionCheck.user.email);

    // Pre-seed an already-registered draft episode directly in PostgreSQL (Scenario 6 pre-existing record)
    const preseededAnimeId = `preseeded-${randomUUID().slice(0, 8)}`;
    const preseededEpId = `ep-pre-${randomUUID().slice(0, 8)}`;
    await sql.query(
      `INSERT INTO "catalog_anime" ("id", "title", "format", "status", "createdAt", "updatedAt")
       VALUES ($1, $2, 'TV', 'RELEASING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      [preseededAnimeId, "Anime Pre-Cadastrado E2E"],
    );
    await sql.query(
      `INSERT INTO "catalog_season" ("animeId", "number", "title", "position", "createdAt")
       VALUES ($1, 1, 'Temporada 1', 0, CURRENT_TIMESTAMP);`,
      [preseededAnimeId],
    );
    await sql.query(
      `INSERT INTO "catalog_episode" ("id", "animeId", "seasonNumber", "number", "title", "videoUrl", "published", "publishedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, 1, 1, 'Episódio Pré-Cadastrado', 'https://cdn.example.com/preseeded-ep1.mp4', false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      [preseededEpId, preseededAnimeId],
    );

    await fetch(`${BASE_URL}/`);

    // 2. Launch Chromium
    browser = await chromium.launch({
      headless: true,
      executablePath:
        "/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell",
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 860 },
      extraHTTPHeaders: {
        cookie: `${authMod.SESSION_TOKEN_COOKIE}=${encodeURIComponent(signedCookieValue)}`,
      },
    });

    await context.addInitScript(() => {
      window.sessionStorage.setItem(
        "hikari_preview_admin_email",
        "pererinhapoo@gmail.com",
      );
    });

    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (err) => {
      console.error("[PAGEERROR]", err.message);
      pageErrors.push(err.message);
    });

    const testAnimeTitle = "E2E Publish Flow Anime";

    // Enter app via Home then SPA-navigate to /admin -> Novo Anime
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await spaNavigate(page, "/admin");
    await page.waitForURL(/\/admin\/?$/, { timeout: 15000 });
    await page.locator('a[href="/admin/new"]').first().waitFor({ state: "visible", timeout: 15000 });
    await page.locator('a[href="/admin/new"]').first().click();
    await page.waitForURL(/\/admin\/new/, { timeout: 15000 });

    // =========================================================================
    // SCENARIO 1: Criar episódio como rascunho
    // =========================================================================
    console.log("[E2E] Scenario 1: /admin/new -> add Episode 1 as Rascunho");
    await page.waitForSelector('input[placeholder*="Sousou no Frieren"]', {
      timeout: 15000,
    });

    const romajiInput = page.locator("label", { hasText: /Romaji/i }).locator("input").first();
    await romajiInput.fill(testAnimeTitle);

    await page.getByRole("button", { name: /Adicionar Episódio/i }).first().click();

    const ep1Card = page.locator('li[data-episode-number="1"]').first();
    await ep1Card.waitFor({ state: "visible" });

    const ep1DraftBtn = ep1Card.getByRole("button", { name: "Rascunho" });
    const ep1PubBtn = ep1Card.getByRole("button", { name: "Publicado" });
    assert.equal(
      await ep1DraftBtn.getAttribute("aria-pressed"),
      "true",
      "Scenario 1: New episode must default to Rascunho",
    );
    assert.equal(
      await ep1PubBtn.getAttribute("aria-pressed"),
      "false",
      "Scenario 1: New episode must NOT default to Publicado",
    );

    // =========================================================================
    // SCENARIO 2: Salvar e reabrir como rascunho (inclusive de navegador limpo)
    // =========================================================================
    console.log("[E2E] Scenario 2: Save draft (even with valid URL) & reopen");
    const ep1Player1 = ep1Card.locator('input[placeholder*="URL do vídeo"]').first();
    await ep1Player1.fill("https://cdn.example.com/hikari-ep1-draft.mp4");
    assert.equal(await ep1DraftBtn.getAttribute("aria-pressed"), "true");

    await page.getByRole("button", { name: /Salvar/i }).first().click();
    await page.waitForURL(/\/admin\/local-/, { timeout: 15000 });
    const animeId = page.url().split("/admin/")[1].split("?")[0];
    console.log("[E2E] Saved new animeId:", animeId);

    await page.waitForFunction(
      () =>
        document.body.innerText.includes("confirmados no PostgreSQL") ||
        document.body.innerText.includes("Sincronizado"),
      { timeout: 15000 },
    );

    const afterDraftServer = await catMod.executeGetCatalogEpisodes(animeId, {
      includeUnpublished: true,
    });
    assert.equal(afterDraftServer.episodes.length, 1, "DB must contain 1 episode");
    assert.equal(afterDraftServer.episodes[0].published, false, "DB episode must be published=false");
    assert.equal(afterDraftServer.episodes[0].publishedAt, null, "DB draft must have publishedAt=null");

    const publicAfterDraft = await catMod.executeGetPublicCatalogEpisodes();
    assert.equal(
      publicAfterDraft.episodes.some((e) => e.animeId === animeId),
      false,
      "Draft episode must NOT appear in public catalog query",
    );

    // Reopen via back-to-catalog + Editar
    await page.getByRole("link", { name: /Voltar ao Catálogo/i }).click();
    await page.waitForURL(/\/admin\/?$/, { timeout: 15000 });
    await page.locator(`a[href="/admin/${animeId}"]`).first().click();
    await page.waitForURL(new RegExp(`/admin/${animeId}`), { timeout: 15000 });

    const ep1CardReopened = page.locator('li[data-episode-number="1"]').first();
    await ep1CardReopened.waitFor({ state: "visible" });
    assert.equal(
      await ep1CardReopened.getByRole("button", { name: "Rascunho" }).getAttribute("aria-pressed"),
      "true",
      "Scenario 2: Episode must remain Rascunho after reopening",
    );

    // Also reopen in a BRAND-NEW clean browser context (zero IndexedDB/localStorage) to prove PostgreSQL recovery
    const cleanContext1 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    await cleanContext1.addInitScript(() => {
      window.sessionStorage.setItem("hikari_preview_admin_email", "pererinhapoo@gmail.com");
    });
    const cleanPage1 = await cleanContext1.newPage();
    await cleanPage1.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await spaNavigate(cleanPage1, `/admin/${animeId}`);
    const cleanEp1 = cleanPage1.locator('li[data-episode-number="1"]').first();
    await cleanEp1.waitFor({ state: "visible", timeout: 15000 });
    assert.equal(
      await cleanEp1.getByRole("button", { name: "Rascunho" }).getAttribute("aria-pressed"),
      "true",
      "Scenario 2 (clean browser / PostgreSQL recovery): Episode must remain Rascunho",
    );
    await cleanContext1.close();

    // =========================================================================
    // SCENARIO 7 (UI blocking checks): Episode without valid source CANNOT be published
    // =========================================================================
    console.log("[E2E] Scenario 7: Verify UI blocks publishing without valid source");
    await page.getByRole("button", { name: /Adicionar Episódio/i }).click();
    const ep2Card = page.locator('li[data-episode-number="2"]').first();
    await ep2Card.waitFor({ state: "visible" });

    // 7a: Empty URL
    await ep2Card.getByRole("button", { name: "Publicado" }).click();
    assert.equal(
      await ep2Card.getByRole("button", { name: "Rascunho" }).getAttribute("aria-pressed"),
      "true",
      "Scenario 7a: Empty source must block Publicado and stay Rascunho",
    );
    await ep2Card.getByRole("alert").waitFor({ state: "visible" });

    // 7b: YouTube / Crunchyroll / FTP / javascript / invalid text
    const ep2Player1 = ep2Card.locator('input[placeholder*="URL do vídeo"]').first();
    for (const invalidUrl of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.crunchyroll.com/watch/123",
      "ftp://cdn.example.com/ep2.mp4",
      "javascript:alert(1)",
      "nao-e-uma-url",
    ]) {
      await ep2Player1.fill(invalidUrl);
      await ep2Card.getByRole("button", { name: "Publicado" }).click();
      assert.equal(
        await ep2Card.getByRole("button", { name: "Rascunho" }).getAttribute("aria-pressed"),
        "true",
        `Scenario 7b: Invalid URL "${invalidUrl}" must block publication`,
      );
      await ep2Card.getByRole("alert").waitFor({ state: "visible" });
    }
    await ep2Player1.fill("");

    // =========================================================================
    // SCENARIO 3 & 4: Marcar episódio 1 como publicado, salvar e confirmar
    // =========================================================================
    console.log("[E2E] Scenarios 3 & 4: Publish Episode 1 & verify DB + public query + Home");
    await ep1CardReopened.getByRole("button", { name: "Publicado" }).click();
    assert.equal(
      await ep1CardReopened.getByRole("button", { name: "Publicado" }).getAttribute("aria-pressed"),
      "true",
      "Scenario 3: Ep 1 toggle should switch to Publicado",
    );

    await page.getByRole("button", { name: /Salvar/i }).first().click();
    await page.waitForTimeout(800);
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      return !btns.some((b) => b.textContent?.includes("Salvando"));
    });

    const afterPubServer = await catMod.executeGetCatalogEpisodes(animeId, {
      includeUnpublished: true,
    });
    assert.equal(afterPubServer.episodes.length, 2, "DB must have Ep 1 and Ep 2");
    const dbEp1 = afterPubServer.episodes.find((e) => e.number === 1);
    const dbEp2 = afterPubServer.episodes.find((e) => e.number === 2);
    assert.equal(dbEp1.published, true, "Scenario 4: DB Ep 1 must be published=true");
    assert.ok(dbEp1.publishedAt, "Scenario 4: DB Ep 1 must have publishedAt populated");
    assert.equal(dbEp2.published, false, "DB Ep 2 must be published=false (draft)");

    const publicAfterPub = await catMod.executeGetPublicCatalogEpisodes();
    assert.equal(
      publicAfterPub.episodes.some((e) => e.animeId === animeId && e.number === 1),
      true,
      "Scenario 4: Public catalog query must include published Ep 1",
    );
    assert.equal(
      publicAfterPub.episodes.some((e) => e.animeId === animeId && e.number === 2),
      false,
      "Public catalog query must exclude draft Ep 2",
    );

    // Check Home SSR renders Ep 1 in RecentEpisodesSection
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await page.waitForFunction(
      (title) => document.body.innerText.includes(title),
      testAnimeTitle,
      { timeout: 10000 },
    );
    console.log("[E2E] Confirmed published episode appears on Home!");

    // =========================================================================
    // SCENARIO 5: Reabrir editor e confirmar que Ep 1 continua Publicado (via clean context + SPA)
    // =========================================================================
    console.log("[E2E] Scenario 5: Reopen editor and verify Ep 1 stays Publicado");
    await spaNavigate(page, "/admin");
    await page.waitForURL(/\/admin\/?$/, { timeout: 15000 });
    await page.locator(`a[href="/admin/${animeId}"]`).first().waitFor({ state: "visible", timeout: 15000 });
    await page.locator(`a[href="/admin/${animeId}"]`).first().click();
    await page.waitForURL(new RegExp(`/admin/${animeId}`), { timeout: 15000 });

    const ep1Spa = page.locator('li[data-episode-number="1"]').first();
    const ep2Spa = page.locator('li[data-episode-number="2"]').first();
    await ep1Spa.waitFor({ state: "visible" });
    await ep2Spa.waitFor({ state: "visible" });

    assert.equal(
      await ep1Spa.getByRole("button", { name: "Publicado" }).getAttribute("aria-pressed"),
      "true",
      "Scenario 5: Ep 1 must still be Publicado after reopening",
    );
    assert.equal(
      await ep2Spa.getByRole("button", { name: "Rascunho" }).getAttribute("aria-pressed"),
      "true",
      "Scenario 6 pre-check: Ep 2 must still be Rascunho",
    );

    // Clean context check for Scenario 5 (fresh browser, zero IndexedDB)
    const cleanContext2 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    await cleanContext2.addInitScript(() => {
      window.sessionStorage.setItem("hikari_preview_admin_email", "pererinhapoo@gmail.com");
    });
    const cleanPage2 = await cleanContext2.newPage();
    await cleanPage2.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await spaNavigate(cleanPage2, `/admin/${animeId}`);
    await cleanPage2.locator('li[data-episode-number="1"]').first().waitFor({ state: "visible", timeout: 15000 });
    assert.equal(
      await cleanPage2
        .locator('li[data-episode-number="1"]')
        .first()
        .getByRole("button", { name: "Publicado" })
        .getAttribute("aria-pressed"),
      "true",
      "Scenario 5 (clean browser / PostgreSQL recovery): Ep 1 must remain Publicado",
    );
    await cleanContext2.close();

    // =========================================================================
    // SCENARIO 6: Publicar episódio que JÁ ESTAVA cadastrado (tanto Ep 2 quanto pré-cadastrado no DB)
    // =========================================================================
    console.log("[E2E] Scenario 6: Publish already-registered Ep 2 & pre-seeded DB episode");
    await ep2Spa
      .locator('input[placeholder*="URL do vídeo"]')
      .first()
      .fill("HTTPS://cdn.example.com/hikari-ep2.m3u8");
    await ep2Spa.getByRole("button", { name: "Publicado" }).click();
    // Revert Ep 1 back to Rascunho at the same time to test bidirectional persistence
    await ep1Spa.getByRole("button", { name: "Rascunho" }).click();

    await page.getByRole("button", { name: /Salvar/i }).first().click();
    await page.waitForTimeout(800);
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      return !btns.some((b) => b.textContent?.includes("Salvando"));
    });

    const finalDb = await catMod.executeGetCatalogEpisodes(animeId, {
      includeUnpublished: true,
    });
    const finalEp1 = finalDb.episodes.find((e) => e.number === 1);
    const finalEp2 = finalDb.episodes.find((e) => e.number === 2);
    assert.equal(finalEp1.published, false, "Ep 1 reverted to Rascunho must persist published=false");
    assert.equal(finalEp1.publishedAt, null, "Ep 1 reverted to Rascunho must clear publishedAt");
    assert.equal(finalEp2.published, true, "Scenario 6: Already-saved Ep 2 must persist published=true");
    assert.ok(finalEp2.publishedAt, "Scenario 6: Ep 2 must have publishedAt populated");

    // Also open the pre-seeded DB anime (not in IndexedDB before) and publish its pre-existing draft episode
    await spaNavigate(page, `/admin/${preseededAnimeId}`);
    const preEp1Card = page.locator('li[data-episode-number="1"]').first();
    await preEp1Card.waitFor({ state: "visible", timeout: 15000 });
    assert.equal(
      await preEp1Card.getByRole("button", { name: "Rascunho" }).getAttribute("aria-pressed"),
      "true",
      "Pre-seeded DB episode must load as Rascunho",
    );
    await preEp1Card.getByRole("button", { name: "Publicado" }).click();
    await page.getByRole("button", { name: /Salvar/i }).first().click();
    await page.waitForTimeout(800);
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      return !btns.some((b) => b.textContent?.includes("Salvando"));
    });
    const preDbAfter = await catMod.executeGetCatalogEpisodes(preseededAnimeId, {
      includeUnpublished: true,
    });
    assert.equal(preDbAfter.episodes[0].published, true, "Scenario 6: Pre-seeded DB episode must publish");
    assert.ok(preDbAfter.episodes[0].publishedAt, "Scenario 6: Pre-seeded DB episode must get publishedAt");

    // =========================================================================
    // SCENARIO 6b: False-positive substring URL (streammax.com) & replaceSources clearing + Screenshots
    // =========================================================================
    console.log("[E2E] Scenario 6b: streammax.com URL, replaceSources clearing & mobile check");
    await spaNavigate(page, `/admin/${animeId}`);
    const ep1Reload2 = page.locator('li[data-episode-number="1"]').first();
    await ep1Reload2.waitFor({ state: "visible", timeout: 15000 });
    const ep1Player1Input = ep1Reload2.locator('input[placeholder*="URL do vídeo"]').first();
    await ep1Player1Input.fill("https://streammax.com/ep1.mp4");
    await ep1Reload2.getByRole("button", { name: "Publicado" }).click();
    assert.equal(
      await ep1Reload2.getByRole("button", { name: "Publicado" }).getAttribute("aria-pressed"),
      "true",
      "Scenario 6b: streammax.com must be accepted",
    );

    await page.screenshot({ path: "screenshots/e2e-publish-desktop.png", fullPage: false });

    await page.getByRole("button", { name: /Salvar/i }).first().click();
    await page.waitForTimeout(800);
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      return !btns.some((b) => b.textContent?.includes("Salvando"));
    });

    const afterMaxSubstr = await catMod.executeGetCatalogEpisodes(animeId, {
      includeUnpublished: true,
    });
    const ep1AfterMaxSubstr = afterMaxSubstr.episodes.find((e) => e.number === 1);
    assert.equal(ep1AfterMaxSubstr.published, true);
    assert.equal(ep1AfterMaxSubstr.videoUrl, "https://streammax.com/ep1.mp4");

    // Clear URL, revert to Rascunho, save, and confirm DB videoUrl is NULL
    await ep1Reload2.getByRole("button", { name: "Rascunho" }).click();
    await ep1Player1Input.fill("");
    await page.getByRole("button", { name: /Salvar/i }).first().click();
    await page.waitForTimeout(800);
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      return !btns.some((b) => b.textContent?.includes("Salvando"));
    });

    const afterClearDb = await catMod.executeGetCatalogEpisodes(animeId, {
      includeUnpublished: true,
    });
    const ep1Cleared = afterClearDb.episodes.find((e) => e.number === 1);
    assert.equal(ep1Cleared.published, false);
    assert.equal(ep1Cleared.videoUrl, null, "replaceSources=true must clear deleted videoUrl in PostgreSQL");

    // Mobile 390px check
    const mobilePage = await context.newPage();
    await mobilePage.setViewportSize({ width: 390, height: 844 });
    await mobilePage.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await spaNavigate(mobilePage, `/admin/${animeId}`);
    await mobilePage.locator('li[data-episode-number="2"]').first().waitFor({ state: "visible", timeout: 15000 });
    const mobileOverflow = await mobilePage.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    assert.equal(mobileOverflow, false, "Mobile 390px editor must not overflow horizontally");
    await mobilePage.screenshot({ path: "screenshots/e2e-publish-mobile.png", fullPage: false });
    await mobilePage.close();

    // =========================================================================
    // SCENARIO 7c & 7d: Direct API validation (400 without valid source, default draft)
    // =========================================================================
    console.log("[E2E] Scenarios 7c & 7d: Direct API validation checks");
    const cookieHeader = `${authMod.SESSION_TOKEN_COOKIE}=${encodeURIComponent(signedCookieValue)}`;

    const badApiRes = await fetch(`${BASE_URL}/api/admin/catalog-episode`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookieHeader,
        origin: BASE_URL,
      },
      body: JSON.stringify({
        id: `api-bad-${randomUUID()}`,
        animeId,
        seasonNumber: 1,
        number: 99,
        title: "Sem fonte via API",
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        published: true,
      }),
    });
    assert.equal(badApiRes.status, 400, "API must return 400 when published=true without valid playable source");

    const omittedApiId = `api-omitted-${randomUUID()}`;
    const omittedApiRes = await fetch(`${BASE_URL}/api/admin/catalog-episode`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookieHeader,
        origin: BASE_URL,
      },
      body: JSON.stringify({
        id: omittedApiId,
        animeId,
        seasonNumber: 1,
        number: 100,
        title: "Published omitido via API",
        videoUrl: "https://cdn.example.com/ep100.mp4",
      }),
    });
    assert.equal(omittedApiRes.status, 200);
    const omittedJson = await omittedApiRes.json();
    assert.equal(omittedJson.published, false, "API must NEVER auto-publish when published is omitted");

    assert.equal(pageErrors.length, 0, `Unexpected uncaught page errors: ${pageErrors.join("; ")}`);
    console.log("[E2E] ALL 7 MANDATORY SCENARIOS PASSED!");
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
}

main().catch((err) => {
  console.error("[E2E] FAILED:", err);
  process.exit(1);
});
