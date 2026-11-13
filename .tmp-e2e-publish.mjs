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

    // Verify seeded admin user exists (from 0025_seed_pererinha.sql)
    const users = await sql.query(
      `SELECT "id", "email" FROM "user" WHERE "id" = 'pererinha_id' LIMIT 1;`,
    );
    assert.equal(users.length, 1, "Seeded admin user pererinha_id must exist in PGLite");

    await sql.query(
      `INSERT INTO "session" ("id", "expiresAt", "token", "createdAt", "updatedAt", "userId")
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'pererinha_id');`,
      [sessionId, expiresAt, sessionToken],
    );

    // Confirm Better Auth accepts our signed cookie
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

    // Warm up routes via SSR
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
    page.on("pageerror", (err) => pageErrors.push(err.message));

    const testAnimeTitle = "E2E Publish Flow Anime";

    // =========================================================================
    // SCENARIO 1: Criar episódio como rascunho
    // =========================================================================
    console.log("[E2E] Scenario 1: Navigate to /admin/new and add Episode 1 as Rascunho");
    await page.goto(`${BASE_URL}/admin/new`, { waitUntil: "networkidle" });
    await page.waitForSelector('input[placeholder*="Sousou no Frieren"], input[placeholder*="Título"]', {
      timeout: 15000,
    });

    // Fill anime title (first input in metadata is usually Romaji or find by label)
    const romajiInput = page.locator("label", { hasText: /Romaji/i }).locator("input").first();
    await romajiInput.fill(testAnimeTitle);

    // Click Adicionar Episódio
    await page.getByRole("button", { name: /Adicionar Episódio/i }).click();

    const ep1Card = page.locator('li[data-episode-number="1"]').first();
    await ep1Card.waitFor({ state: "visible" });

    const ep1DraftBtn = ep1Card.getByRole("button", { name: "Rascunho" });
    const ep1PubBtn = ep1Card.getByRole("button", { name: "Publicado" });
    assert.equal(
      await ep1DraftBtn.getAttribute("aria-pressed"),
      "true",
      "Scenario 1: New episode must default to Rascunho (aria-pressed=true)",
    );
    assert.equal(
      await ep1PubBtn.getAttribute("aria-pressed"),
      "false",
      "Scenario 1: New episode must NOT default to Publicado",
    );

    // =========================================================================
    // SCENARIO 2: Salvar e reabrir como rascunho
    // =========================================================================
    console.log("[E2E] Scenario 2: Save draft (with a valid URL while still Rascunho) & reopen");
    // Even if it has a valid URL, if kept as Rascunho, it MUST stay published=false!
    const ep1Player1 = ep1Card.locator('input[placeholder*="URL do vídeo"]').first();
    await ep1Player1.fill("https://cdn.example.com/hikari-ep1-draft.mp4");

    // Verify still Rascunho
    assert.equal(await ep1DraftBtn.getAttribute("aria-pressed"), "true");

    // Click Salvar
    await page.getByRole("button", { name: /Salvar/i }).first().click();

    // Wait for URL to navigate from /admin/new to /admin/local-...
    await page.waitForURL(/\/admin\/local-/, { timeout: 15000 });
    const animeUrl = page.url();
    const animeId = animeUrl.split("/admin/")[1].split("?")[0];
    console.log("[E2E] Saved new animeId:", animeId);

    // Wait for PostgreSQL confirmation toast or sync state
    await page.waitForFunction(
      () => document.body.innerText.includes("confirmados no PostgreSQL") || document.body.innerText.includes("Sincronizado"),
      { timeout: 10000 },
    );

    // Verify DB state via executeGetCatalogEpisodes & executeGetPublicCatalogEpisodes
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

    // Reopen /admin/$id via full page reload AND via SPA navigation
    await page.reload({ waitUntil: "networkidle" });
    const ep1CardAfterReload = page.locator('li[data-episode-number="1"]').first();
    await ep1CardAfterReload.waitFor({ state: "visible" });
    assert.equal(
      await ep1CardAfterReload.getByRole("button", { name: "Rascunho" }).getAttribute("aria-pressed"),
      "true",
      "Scenario 2: Episode must remain Rascunho after full reload",
    );

    // =========================================================================
    // SCENARIO 7 (UI blocking checks): Episode without valid source CANNOT be published
    // =========================================================================
    console.log("[E2E] Scenario 7: Verify UI blocks publishing without valid source");
    // Add Episode 2 without source first
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

    // 7b: YouTube / Crunchyroll / FTP / invalid text
    const ep2Player1 = ep2Card.locator('input[placeholder*="URL do vídeo"]').first();
    for (const invalidUrl of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.crunchyroll.com/watch/123",
      "ftp://cdn.example.com/ep2.mp4",
      "https://",
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

    // Clear invalid URL so Ep 2 saves cleanly as Rascunho (for Scenario 6!)
    await ep2Player1.fill("");

    // =========================================================================
    // SCENARIO 3 & 4: Marcar episódio 1 como publicado, salvar e confirmar
    // =========================================================================
    console.log("[E2E] Scenarios 3 & 4: Publish Episode 1 & verify DB + public query + Home");
    await ep1CardAfterReload.getByRole("button", { name: "Publicado" }).click();
    assert.equal(
      await ep1CardAfterReload.getByRole("button", { name: "Publicado" }).getAttribute("aria-pressed"),
      "true",
      "Scenario 3: Ep 1 toggle should switch to Publicado",
    );

    await page.getByRole("button", { name: /Salvar/i }).first().click();
    await page.waitForTimeout(1000);

    // Wait for DB state update
    await page.waitForFunction(async (id) => {
      // Just wait briefly for save button to re-enable
      const btns = Array.from(document.querySelectorAll("button"));
      return !btns.some((b) => b.textContent?.includes("Salvando"));
    }, animeId);

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

    // Also check Home page shows RecentEpisodesSection with Ep 1!
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await page.waitForFunction(
      (title) => document.body.innerText.includes(title),
      testAnimeTitle,
      { timeout: 10000 },
    );
    console.log("[E2E] Confirmed published episode appears on Home!");

    // =========================================================================
    // SCENARIO 5 & 6: Reabrir /admin/$id (SPA nav & reload), confirmar Ep 1 Publicado,
    // e publicar Ep 2 que já estava cadastrado como rascunho no banco!
    // =========================================================================
    console.log("[E2E] Scenarios 5 & 6: SPA navigate to /admin -> /admin/$id, check Ep 1, publish already-saved Ep 2");
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    await page.getByText(testAnimeTitle).first().click();
    await page.waitForURL(new RegExp(`/admin/${animeId}`), { timeout: 15000 });

    const ep1Spa = page.locator('li[data-episode-number="1"]').first();
    const ep2Spa = page.locator('li[data-episode-number="2"]').first();
    await ep1Spa.waitFor({ state: "visible" });
    await ep2Spa.waitFor({ state: "visible" });

    assert.equal(
      await ep1Spa.getByRole("button", { name: "Publicado" }).getAttribute("aria-pressed"),
      "true",
      "Scenario 5 (SPA nav): Ep 1 must still be Publicado",
    );
    assert.equal(
      await ep2Spa.getByRole("button", { name: "Rascunho" }).getAttribute("aria-pressed"),
      "true",
      "Scenario 6 pre-check (SPA nav): Ep 2 must still be Rascunho",
    );

    // Full reload check too
    await page.reload({ waitUntil: "networkidle" });
    const ep1Reload = page.locator('li[data-episode-number="1"]').first();
    const ep2Reload = page.locator('li[data-episode-number="2"]').first();
    await ep1Reload.waitFor({ state: "visible" });
    assert.equal(
      await ep1Reload.getByRole("button", { name: "Publicado" }).getAttribute("aria-pressed"),
      "true",
      "Scenario 5 (full reload): Ep 1 must remain Publicado",
    );

    // Scenario 6: Publish already-registered Ep 2 with HTTPS:// uppercase URL!
    await ep2Reload
      .locator('input[placeholder*="URL do vídeo"]')
      .first()
      .fill("HTTPS://cdn.example.com/hikari-ep2.m3u8");
    await ep2Reload.getByRole("button", { name: "Publicado" }).click();
    assert.equal(
      await ep2Reload.getByRole("button", { name: "Publicado" }).getAttribute("aria-pressed"),
      "true",
      "Scenario 6: Ep 2 must switch to Publicado with uppercase HTTPS:// source",
    );

    // Also test reverting Ep 1 back to Rascunho at the same time to verify bidirectional persistence
    await ep1Reload.getByRole("button", { name: "Rascunho" }).click();

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

    // Reopen after reload to confirm both states survived
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(
      await page
        .locator('li[data-episode-number="1"]')
        .first()
        .getByRole("button", { name: "Rascunho" })
        .getAttribute("aria-pressed"),
      "true",
      "Reverted Ep 1 must remain Rascunho after reload",
    );
    assert.equal(
      await page
        .locator('li[data-episode-number="2"]')
        .first()
        .getByRole("button", { name: "Publicado" })
        .getAttribute("aria-pressed"),
      "true",
      "Scenario 6: Published Ep 2 must remain Publicado after reload",
    );

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
