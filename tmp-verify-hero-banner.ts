import { createServer } from "vite";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

process.env.VITE_AUTH_ENABLED = "false";

const PORT = 3099;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const SCREENSHOTS_DIR = path.resolve(process.cwd(), "screenshots");
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function main() {
  console.log("1. Starting ephemeral Vite dev server for real E2E verification...");
  const vite = await createServer({
    server: {
      host: "127.0.0.1",
      port: PORT,
      strictPort: true,
    },
  });
  await vite.listen();
  console.log(`   Listening at ${BASE_URL}`);

  const browser = await chromium.launch({
    headless: true,
    executablePath: "/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const dbMod = await vite.ssrLoadModule("/src/lib/db.ts");
    await dbMod.ensureDbReady();
    const authMod = await vite.ssrLoadModule("/src/lib/auth/server.ts");
    const authCtx = await authMod.auth.$context;
    const sessionRow = await authCtx.internalAdapter.createSession("pererinha_id", false);
    assert.ok(sessionRow?.token, "Expected real Better Auth session token for seeded admin");
    console.log("2. Created real Better Auth admin session in PGlite for pererinhapoo@gmail.com.");

    const getActiveSlideInfo = async (page) => {
      return page.evaluate(() => {
        const hero = document.querySelector('section[aria-label="Destaque principal"]');
        if (!hero) return null;
        const detailsLink = hero.querySelector('a[href^="/anime/"]');
        const href = detailsLink?.getAttribute("href") || "";
        const id = href.replace(/^\/anime\//, "").split("?")[0];
        const titleHeading = hero.querySelector("h1");
        const title = titleHeading?.textContent?.trim() || "";
        const picture = hero.querySelector("picture");
        const sources = Array.from(picture?.querySelectorAll("source") || []).map((s) => ({
          media: s.getAttribute("media"),
          srcSet: s.getAttribute("srcset") || s.getAttribute("srcSet"),
        }));
        const img = picture?.querySelector("img");
        return {
          id,
          title,
          sources,
          imgSrc: img?.getAttribute("src") || "",
          imgSrcSet: img?.getAttribute("srcset") || "",
          currentSrc: img?.currentSrc || "",
          complete: img?.complete ?? false,
          naturalWidth: img?.naturalWidth ?? 0,
          naturalHeight: img?.naturalHeight ?? 0,
          heroRect: hero.getBoundingClientRect(),
        };
      });
    };

    const waitForHeroImageLoaded = async (page, expectedSubstring?: string) => {
      await page.waitForFunction(
        (sub) => {
          const hero = document.querySelector('section[aria-label="Destaque principal"]');
          if (!hero || !Object.keys(hero).some((k) => k.startsWith("__reactProps$"))) {
            return false;
          }
          const img = hero.querySelector("picture img") as HTMLImageElement | null;
          if (!img) return false;
          const src = img.currentSrc || img.src || "";
          if (sub && !src.includes(sub)) return false;
          return img.complete && img.naturalWidth > 0;
        },
        expectedSubstring,
        { timeout: 30000 },
      );
    };

    const adminCtx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const adminPage = await adminCtx.newPage();

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    adminPage.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    adminPage.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    await adminPage.addInitScript((token) => {
      try {
        window.sessionStorage.setItem("hikari_preview_admin_email", "pererinhapoo@gmail.com");
        window.sessionStorage.setItem("grok-auth.bearer-token", token);
      } catch {}
    }, sessionRow.token);

    console.log("3. Loading homepage (/) and discovering banner anime slides...");
    await adminPage.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await waitForHeroImageLoaded(adminPage);
    await adminPage.waitForTimeout(400);

    const slide0Initial = await getActiveSlideInfo(adminPage);
    assert.ok(slide0Initial?.id, "Hero slide 0 must exist");
    assert.ok(slide0Initial.complete && slide0Initial.naturalWidth > 0, "Hero slide 0 image must load");
    console.log(`   Slide 0: id=${slide0Initial.id}, title="${slide0Initial.title}", currentSrc=${slide0Initial.currentSrc}`);

    // Collect candidate real AniList image URLs from other anime rows on the homepage
    const candidateImages = await adminPage.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll("img"))
        .map((i) => i.currentSrc || i.src)
        .filter((s) => s && s.startsWith("https://s4.anilist.co/") && !s.includes("logo"));
      return Array.from(new Set(imgs));
    });

    console.log("4. Testing pointer drag swipe left to advance to Slide 1...");
    const heroBox = slide0Initial.heroRect;
    const cy = heroBox.top + heroBox.height * 0.25;
    await adminPage.mouse.move(heroBox.left + heroBox.width * 0.7, cy);
    await adminPage.mouse.down();
    await adminPage.mouse.move(heroBox.left + heroBox.width * 0.3, cy, { steps: 10 });
    await adminPage.mouse.up();
    await adminPage.waitForTimeout(2300);

    const slide1Initial = await getActiveSlideInfo(adminPage);
    assert.ok(slide1Initial?.id, "Hero slide 1 must exist");
    assert.notEqual(slide1Initial.id, slide0Initial.id, "Swipe left must advance hero to Slide 1");
    console.log(`   Slide 1: id=${slide1Initial.id}, title="${slide1Initial.title}", currentSrc=${slide1Initial.currentSrc}`);

    // Swipe right back to Slide 0
    await adminPage.mouse.move(heroBox.left + heroBox.width * 0.3, cy);
    await adminPage.mouse.down();
    await adminPage.mouse.move(heroBox.left + heroBox.width * 0.7, cy, { steps: 10 });
    await adminPage.mouse.up();
    await adminPage.waitForTimeout(2300);
    const backTo0 = await getActiveSlideInfo(adminPage);
    assert.equal(backTo0?.id, slide0Initial.id, "Swipe right must return to Slide 0");
    console.log("   Drag swipe prev/next verified!");

    const newBannerForAnime1 = "/assets/hikari-elizabeth-clean.png";
    const newBannerForAnime2 =
      candidateImages.find(
        (u) => !slide1Initial.currentSrc.includes(u) && !u.includes(slide1Initial.id) && !u.includes(slide0Initial.id),
      ) || "/assets/hikari-elizabeth-character.png";
    const newCoverForAnime2 = "/assets/hikari-elizabeth-character.png";

    const waitForPath = async (page, prefixOrExact: string, exact = false, timeout = 25000) => {
      await page.waitForFunction(
        ({ p, ex }) => (ex ? window.location.pathname === p : window.location.pathname.startsWith(p)),
        { p: prefixOrExact, ex: exact },
        { timeout },
      );
    };

    // =========================================================================
    // TEST ANIME #1: Hero "Detalhes" -> /anime/:id -> "Editar" -> /admin/... -> Save -> Back to "/"
    // =========================================================================
    console.log(`\n5. [Anime #1] Opening Detalhes -> Editar for ${slide0Initial.id}...`);
    const detailsBtn = adminPage.locator('section[aria-label="Destaque principal"] a[href^="/anime/"]');
    await detailsBtn.click();
    await adminPage.waitForTimeout(300);
    if (!new URL(adminPage.url()).pathname.startsWith(`/anime/${slide0Initial.id}`)) {
      await detailsBtn.click();
    }
    await waitForPath(adminPage, `/anime/${slide0Initial.id}`, false, 20000);
    console.log(`   Navigated to ${adminPage.url()}`);

    const editLink1 = adminPage.locator('a[href^="/admin/"]').first();
    await editLink1.waitFor({ state: "visible", timeout: 25000 });
    await editLink1.click();
    await waitForPath(adminPage, "/admin/", false, 20000);
    console.log(`   Navigated to ${adminPage.url()}`);

    const bannerInput1 = adminPage.locator(
      'input[placeholder="Cole a URL direta do banner panorâmico (JPG/PNG/WEBP)"]',
    );
    await bannerInput1.waitFor({ state: "visible", timeout: 20000 });
    const oldBannerValue1 = await bannerInput1.inputValue();
    console.log(`   Admin route=${adminPage.url()}, Original banner URL=${oldBannerValue1}`);

    await bannerInput1.fill(newBannerForAnime1);

    const saveResp1Promise = adminPage.waitForResponse(
      (r) => r.url().includes("/api/admin/catalog-anime") && r.request().method() === "POST",
      { timeout: 20000 },
    );
    await adminPage.locator('button:has-text("Salvar")').first().click();
    const saveResp1 = await saveResp1Promise;
    assert.equal(saveResp1.status(), 200, "POST /api/admin/catalog-anime must return 200");
    const saveJson1 = await saveResp1.json();
    console.log(`   Server saved Anime #1: animeId=${saveJson1.animeId}, banner=${saveJson1.banner}, updatedAt=${saveJson1.updatedAt}`);
    assert.equal(saveJson1.banner, newBannerForAnime1);
    await adminPage.waitForTimeout(800);

    console.log("6. Returning to '/' via client navigation and verifying Anime #1 new banner...");
    await adminPage.locator('a:has-text("Voltar ao site público")').click();
    await waitForPath(adminPage, "/", true, 20000);
    await waitForHeroImageLoaded(adminPage, "hikari-elizabeth-clean.png");

    const slide0AfterSave = await getActiveSlideInfo(adminPage);
    console.log(`   Slide 0 after CSR nav: id=${slide0AfterSave?.id}, currentSrc=${slide0AfterSave?.currentSrc}`);
    assert.equal(slide0AfterSave?.id, slide0Initial.id, "Anime ordering in hero must be preserved");
    assert.ok(slide0AfterSave?.currentSrc.includes("hikari-elizabeth-clean.png"));
    assert.ok(slide0AfterSave?.currentSrc.includes("hv="), "Expected ?hv= cache-bust query param on local/custom URL");

    console.log("7. Reloading '/' and confirming new banner persists (no old image return)...");
    await adminPage.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForHeroImageLoaded(adminPage, "hikari-elizabeth-clean.png");
    const slide0AfterReload = await getActiveSlideInfo(adminPage);
    console.log(`   Slide 0 after reload: id=${slide0AfterReload?.id}, currentSrc=${slide0AfterReload?.currentSrc}`);
    assert.equal(slide0AfterReload?.id, slide0Initial.id);
    assert.ok(slide0AfterReload?.currentSrc.includes("hikari-elizabeth-clean.png"));

    console.log("8. Opening '/' in fresh incognito context (SSR + zero IndexedDB)...");
    const incognitoCtx1 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const incPage1 = await incognitoCtx1.newPage();
    await incPage1.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForHeroImageLoaded(incPage1, "hikari-elizabeth-clean.png");
    const incSlide0 = await getActiveSlideInfo(incPage1);
    console.log(`   Incognito Slide 0: id=${incSlide0?.id}, currentSrc=${incSlide0?.currentSrc}`);
    assert.equal(incSlide0?.id, slide0Initial.id);
    assert.ok(incSlide0?.currentSrc.includes("hikari-elizabeth-clean.png"));
    await incPage1.screenshot({ path: path.join(SCREENSHOTS_DIR, "qa-hero-after-anime1.png") });
    await incognitoCtx1.close();

    console.log("8b. Verifying same-URL image replacement updates ?hv= cache-bust version...");
    const hvBeforeMatch = incSlide0?.currentSrc.match(/[?&]hv=(\d+)/);
    const hvBefore = hvBeforeMatch ? Number(hvBeforeMatch[1]) : 0;
    assert.ok(hvBefore > 0, "Expected numeric hv= cache-bust param on custom/local URL");
    await adminPage.goto(`${BASE_URL}/anime/${slide0Initial.id}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    const reEditLink1 = adminPage.locator('a[href^="/admin/"]').first();
    await reEditLink1.waitFor({ state: "visible", timeout: 25000 });
    await reEditLink1.click();
    await waitForPath(adminPage, "/admin/", false, 20000);
    const reSaveRespPromise = adminPage.waitForResponse(
      (r) => r.url().includes("/api/admin/catalog-anime") && r.request().method() === "POST",
      { timeout: 20000 },
    );
    await adminPage.locator('button:has-text("Salvar")').first().click();
    const reSaveResp = await reSaveRespPromise;
    assert.equal(reSaveResp.status(), 200);
    await adminPage.waitForTimeout(400);
    await adminPage.locator('a:has-text("Voltar ao site público")').click();
    await waitForPath(adminPage, "/", true, 20000);
    await waitForHeroImageLoaded(adminPage, "hikari-elizabeth-clean.png");
    const slide0SameUrl = await getActiveSlideInfo(adminPage);
    const hvAfterMatch = slide0SameUrl?.currentSrc.match(/[?&]hv=(\d+)/);
    const hvAfter = hvAfterMatch ? Number(hvAfterMatch[1]) : 0;
    console.log(`   Same-URL save version: hvBefore=${hvBefore} -> hvAfter=${hvAfter}`);
    assert.ok(hvAfter > hvBefore, "Same-URL re-save must advance hv= cache-bust version");

    // =========================================================================
    // TEST ANIME #2: Navigate directly to /anime/:id2 via SPA -> Editar -> Update BOTH banner & cover -> Save
    // =========================================================================
    console.log(`\n9. [Anime #2] Navigating to /anime/${slide1Initial.id} -> Editar...`);
    await adminPage.goto(`${BASE_URL}/anime/${slide1Initial.id}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    const editLink2 = adminPage.locator('a[href^="/admin/"]').first();
    await editLink2.waitFor({ state: "visible", timeout: 25000 });
    await editLink2.click();
    await waitForPath(adminPage, "/admin/", false, 20000);

    const coverInput2 = adminPage.locator(
      'input[placeholder="Cole a URL direta da imagem (JPG/PNG/WEBP)"]',
    );
    const bannerInput2 = adminPage.locator(
      'input[placeholder="Cole a URL direta do banner panorâmico (JPG/PNG/WEBP)"]',
    );
    await bannerInput2.waitFor({ state: "visible", timeout: 20000 });
    await coverInput2.fill(newCoverForAnime2);
    await bannerInput2.fill(newBannerForAnime2);

    const saveResp2Promise = adminPage.waitForResponse(
      (r) => r.url().includes("/api/admin/catalog-anime") && r.request().method() === "POST",
      { timeout: 20000 },
    );
    await adminPage.locator('button:has-text("Salvar")').first().click();
    const saveResp2 = await saveResp2Promise;
    assert.equal(saveResp2.status(), 200, "POST /api/admin/catalog-anime for Anime #2 must return 200");
    const saveJson2 = await saveResp2.json();
    console.log(`   Server saved Anime #2: animeId=${saveJson2.animeId}, banner=${saveJson2.banner}, cover=${saveJson2.cover}`);
    await adminPage.waitForTimeout(800);

    await adminPage.locator('a:has-text("Voltar ao site público")').click();
    await waitForPath(adminPage, "/", true, 20000);
    await waitForHeroImageLoaded(adminPage, "hikari-elizabeth-clean.png");

    console.log("10. Verifying autoplay advances Slide 0 -> Slide 1 with Anime #2's new banner...");
    await adminPage.waitForFunction(
      (targetId) => {
        const link = document.querySelector('section[aria-label="Destaque principal"] a[href^="/anime/"]');
        const href = link?.getAttribute("href") || "";
        return href === `/anime/${targetId}`;
      },
      slide1Initial.id,
      { timeout: 14000 },
    );
    // Wait for 1800ms crossfade transition to complete
    await adminPage.waitForTimeout(2000);
    const expectedBase2 = newBannerForAnime2.split("?")[0];
    await waitForHeroImageLoaded(adminPage, expectedBase2);
    const autoSlide1 = await getActiveSlideInfo(adminPage);
    console.log(`   Autoplay active slide: id=${autoSlide1?.id}, currentSrc=${autoSlide1?.currentSrc}`);
    assert.equal(autoSlide1?.id, slide1Initial.id, "Autoplay must advance from Slide 0 to Slide 1");
    assert.ok(autoSlide1?.currentSrc.includes(expectedBase2));
    await adminPage.screenshot({ path: path.join(SCREENSHOTS_DIR, "qa-hero-after-anime2.png") });

    console.log("11. Reloading '/' in incognito & checking Mobile viewport (390x844) + Anime #2 mobile cover...");
    const mobileCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
    });
    const mobilePage = await mobileCtx.newPage();
    await mobilePage.goto(`${BASE_URL}/`, { waitUntil: "load", timeout: 30000 });
    await waitForHeroImageLoaded(mobilePage);
    await mobilePage.waitForTimeout(1500);

    const mobileSlide0 = await getActiveSlideInfo(mobilePage);
    const mBox = mobileSlide0.heroRect;
    const mCy = mBox.top + mBox.height * 0.25;
    await mobilePage.mouse.move(mBox.left + mBox.width * 0.75, mCy);
    await mobilePage.mouse.down();
    await mobilePage.mouse.move(mBox.left + mBox.width * 0.25, mCy, { steps: 10 });
    await mobilePage.mouse.up();
    await mobilePage.waitForTimeout(2300);

    const mobileSlide1 = await getActiveSlideInfo(mobilePage);
    console.log(`   Mobile Slide 1: id=${mobileSlide1?.id}, currentSrc=${mobileSlide1?.currentSrc}`);
    assert.equal(mobileSlide1?.id, slide1Initial.id);
    assert.ok(
      mobileSlide1?.currentSrc.includes("hikari-elizabeth-character.png"),
      `Expected mobile Hero Slide 1 to show updated cover, got: ${mobileSlide1?.currentSrc}`,
    );

    const mobileCheck = await mobilePage.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      heroVisible: Boolean(document.querySelector('section[aria-label="Destaque principal"] picture img')),
    }));
    assert.equal(mobileCheck.overflow, false, "Mobile viewport must have no horizontal overflow");
    assert.equal(mobileCheck.heroVisible, true, "Mobile hero image must render");
    await mobilePage.screenshot({ path: path.join(SCREENSHOTS_DIR, "qa-hero-mobile.png") });
    await mobileCtx.close();

    assert.equal(pageErrors.length, 0, `Page errors detected: ${pageErrors.join("; ")}`);
    assert.equal(consoleErrors.length, 0, `Console errors detected: ${consoleErrors.join("; ")}`);

    console.log("\nALL LIVE PREVIEW E2E HERO BANNER CHECKS PASSED SUCCESSFULLY!");
    await adminCtx.close();
  } finally {
    await browser.close();
    await vite.close();
  }
}

main().catch((err) => {
  console.error("E2E verification failed:", err);
  process.exit(1);
});
