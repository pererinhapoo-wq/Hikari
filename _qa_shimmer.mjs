import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3000";
const EXECUTABLE = "/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell";

async function run() {
  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const report = {
    desktop: {},
    mobile: {},
    reducedMotion: {},
    errors: [],
  };

  const attachErrorListeners = (page, bucket) => {
    page.on("pageerror", (err) => {
      bucket.push(`pageerror: ${err.message}`);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (
          !text.includes("ERR_FAILED") &&
          !text.includes("404") &&
          !text.includes("WebSocket")
        ) {
          bucket.push(`console.error: ${text}`);
        }
      }
    });
  };

  // =========================================================================
  // 1. DESKTOP (1440x900)
  // =========================================================================
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    attachErrorListeners(page, report.errors);

    let firstHeldRelease = null;
    let firstHeldUrl = null;
    let failedUrl = null;
    let imageReqCount = 0;

    await page.route(/\.(jpg|jpeg|png|webp)(\?.*)?$|anilist|s4\.anilist|cdn\./i, async (route) => {
      const req = route.request();
      if (req.resourceType() !== "image") {
        await route.continue();
        return;
      }
      const url = req.url();
      imageReqCount += 1;

      if (!failedUrl && url.includes("anilist") && imageReqCount >= 3) {
        failedUrl = url;
      }
      if (failedUrl && (url === failedUrl || url.includes(failedUrl.split("/").pop()?.split("?")[0] || "___nope___"))) {
        await route.abort("failed");
        return;
      }

      if (!firstHeldUrl && url.includes("anilist") && imageReqCount >= 1) {
        firstHeldUrl = url;
        await new Promise((resolve) => {
          firstHeldRelease = resolve;
          setTimeout(resolve, 4000);
        });
      }
      await route.continue();
    });

    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('a[href^="/anime/"]', { timeout: 15000 });
    await page.waitForTimeout(700);

    const homeShimmerDuringLoad = await page.evaluate(() => {
      const shimmers = Array.from(document.querySelectorAll('[data-hikari-shimmer="true"]'));
      const first = shimmers[0];
      if (!first) return { count: 0 };
      const cs = getComputedStyle(first);
      const siblingImg = first.parentElement?.querySelector("img");
      const imgCs = siblingImg ? getComputedStyle(siblingImg) : null;
      const box = first.parentElement?.getBoundingClientRect();
      return {
        count: shimmers.length,
        backgroundSize: cs.backgroundSize,
        animationName: cs.animationName,
        animationDuration: cs.animationDuration,
        animationTimingFunction: cs.animationTimingFunction,
        animationIterationCount: cs.animationIterationCount,
        backgroundImageHasLinear: cs.backgroundImage.includes("linear-gradient"),
        filter: cs.filter,
        imgOpacityWhileLoading: imgCs ? imgCs.opacity : null,
        boxWidth: box?.width ?? 0,
        boxHeight: box?.height ?? 0,
      };
    });

    if (firstHeldRelease) firstHeldRelease();
    await page.waitForTimeout(1800);

    const homeAfterLoad = await page.evaluate(() => {
      const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
      const imgs = Array.from(document.querySelectorAll('a[href^="/anime/"] img.hikari-image-fade'));
      const loadedImgs = imgs.filter((img) => getComputedStyle(img).opacity === "1");
      const sampleImg = loadedImgs[0];
      const imgCs = sampleImg ? getComputedStyle(sampleImg) : null;
      const loadedCardsWithShimmer = loadedImgs.filter((img) =>
        img.parentElement?.querySelector('[data-hikari-shimmer="true"]'),
      ).length;
      const fallbacks = Array.from(document.querySelectorAll('[data-image-fallback="true"]'));
      const fallbackWithShimmer = fallbacks.filter((el) =>
        el.parentElement?.querySelector('[data-hikari-shimmer="true"]'),
      ).length;
      const fallbackWithImg = fallbacks.filter((el) => el.parentElement?.querySelector("img")).length;
      const firstCardBox = loadedImgs[0]?.parentElement?.getBoundingClientRect();
      const firstAnimeHref = document.querySelector('a[href^="/anime/"]')?.getAttribute("href");
      const episodeCards = document.querySelectorAll('a[href^="/watch/"] img.hikari-image-fade').length;
      return {
        overflow,
        totalAnimeImgs: imgs.length,
        loadedCount: loadedImgs.length,
        transitionProperty: imgCs?.transitionProperty,
        transitionDuration: imgCs?.transitionDuration,
        loadedCardsWithShimmer,
        fallbackCount: fallbacks.length,
        fallbackWithShimmer,
        fallbackWithImg,
        firstCardBoxWidth: firstCardBox?.width ?? 0,
        firstCardBoxHeight: firstCardBox?.height ?? 0,
        firstAnimeHref,
        episodeCards,
      };
    });

    report.desktop.home = { homeShimmerDuringLoad, homeAfterLoad };
    await page.unrouteAll({ behavior: "ignoreErrors" });

    // Cached image reload test
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.waitForTimeout(800);
    const cachedHomeCheck = await page.evaluate(() => ({
      loadedAnimeImgs: Array.from(document.querySelectorAll('a[href^="/anime/"] img.hikari-image-fade')).filter(
        (img) => getComputedStyle(img).opacity === "1",
      ).length,
      stuckShimmers: document.querySelectorAll('[data-hikari-shimmer="true"]').length,
    }));
    report.desktop.cachedHomeCheck = cachedHomeCheck;

    // Open SearchModal reliably
    const buscarBtn = page.locator('button[aria-label="Buscar"]:visible').first();
    await buscarBtn.waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(400);
    await buscarBtn.click();
    await page.waitForSelector('[role="dialog"] input', { timeout: 10000 });

    await page.route(/\/_serverFn|\/api\//i, async (route) => {
      await new Promise((r) => setTimeout(r, 900));
      await route.continue();
    });

    await page.fill('[role="dialog"] input', "Naruto");
    await page.waitForTimeout(450);

    const searchSkeletonMetrics = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return { found: false };
      const skels = Array.from(dialog.querySelectorAll(".hikari-modal-skeleton-shimmer"));
      const pulses = dialog.querySelectorAll(".animate-pulse").length;
      const blurred = skels.filter((el) => getComputedStyle(el).filter !== "none").length;
      const cs = skels[0] ? getComputedStyle(skels[0]) : null;
      return {
        found: true,
        skeletonCount: skels.length,
        pulseCount: pulses,
        blurredCount: blurred,
        backgroundSize: cs?.backgroundSize,
        animationDuration: cs?.animationDuration,
        animationTimingFunction: cs?.animationTimingFunction,
        animationIterationCount: cs?.animationIterationCount,
        animationName: cs?.animationName,
      };
    });

    await page.waitForTimeout(1200);
    const searchResultsImages = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return 0;
      return dialog.querySelectorAll("img.hikari-image-fade").length;
    });

    await page.keyboard.press("Escape");
    await page.unrouteAll({ behavior: "ignoreErrors" });
    report.desktop.searchModal = { searchSkeletonMetrics, searchResultsImages };

    // Anime Detail & Entity Details
    if (homeAfterLoad.firstAnimeHref) {
      await page.goto(`${BASE}${homeAfterLoad.firstAnimeHref}`, { waitUntil: "load" });
      await page.waitForSelector("h1", { timeout: 15000 });
      await page.waitForTimeout(1000);

      const animeDetailBeforeClick = await page.evaluate(() => {
        const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
        const hikariImgs = document.querySelectorAll("img.hikari-image-fade").length;
        const stuckShimmers = document.querySelectorAll('[data-hikari-shimmer="true"]').length;
        return { overflow, hikariImgs, stuckShimmers };
      });

      let dubladorExpansionCheck = null;
      const dubSection = page.locator("section").filter({ hasText: "Dubladores" }).first();
      const dubCard = dubSection.locator('[role="button"]').first();
      if (await dubCard.count()) {
        await dubCard.scrollIntoViewIfNeeded();
        await dubCard.click();
        await page.waitForTimeout(1200);
        dubladorExpansionCheck = await page.evaluate(() => ({
          hikariImgsTotal: document.querySelectorAll("img.hikari-image-fade").length,
          stuckShimmers: document.querySelectorAll('[data-hikari-shimmer="true"]').length,
        }));
      }

      let staffExpansionCheck = null;
      const staffSection = page.locator("section").filter({ hasText: /Direção|Equipe/i }).first();
      const staffCard = staffSection.locator('[role="button"]').first();
      if (await staffCard.count()) {
        await staffCard.scrollIntoViewIfNeeded();
        await staffCard.click();
        await page.waitForTimeout(1200);
        staffExpansionCheck = await page.evaluate(() => ({
          hikariImgsTotal: document.querySelectorAll("img.hikari-image-fade").length,
          stuckShimmers: document.querySelectorAll('[data-hikari-shimmer="true"]').length,
        }));
      }

      report.desktop.animeDetail = {
        animeDetailBeforeClick,
        dubladorExpansionCheck,
        staffExpansionCheck,
      };
    }

    // Account / Profile / Anime Stats
    await page.goto(`${BASE}/account`, { waitUntil: "load" });
    await page.waitForTimeout(1200);
    const accountCheck = await page.evaluate(() => ({
      url: location.pathname,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      hikariImgs: document.querySelectorAll("img.hikari-image-fade").length,
      stuckShimmers: document.querySelectorAll('[data-hikari-shimmer="true"]').length,
      hasStatsOrLogin: document.body.innerText.slice(0, 200),
    }));

    // Check Anime Stats tab/status
    await page.goto(`${BASE}/account?status=watching`, { waitUntil: "load" });
    await page.waitForTimeout(900);
    const statsCheck = await page.evaluate(() => ({
      url: location.pathname + location.search,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      stuckShimmers: document.querySelectorAll('[data-hikari-shimmer="true"]').length,
      foundStatuses: ["Assistindo", "Concluídos", "Em espera", "Abandonados", "Planejados"].filter((lbl) =>
        document.body.innerText.includes(lbl),
      ),
    }));

    report.desktop.account = { accountCheck, statsCheck };
    await context.close();
  }

  // =========================================================================
  // 2. MOBILE (390x844)
  // =========================================================================
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    attachErrorListeners(page, report.errors);

    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.waitForSelector('a[href^="/anime/"]', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const mobileHome = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      loadedAnimeImgs: Array.from(document.querySelectorAll('a[href^="/anime/"] img.hikari-image-fade')).filter(
        (img) => getComputedStyle(img).opacity === "1",
      ).length,
      stuckShimmers: document.querySelectorAll('[data-hikari-shimmer="true"]').length,
      firstAnimeHref: document.querySelector('a[href^="/anime/"]')?.getAttribute("href"),
    }));

    let mobileDetail = null;
    if (mobileHome.firstAnimeHref) {
      await page.goto(`${BASE}${mobileHome.firstAnimeHref}`, { waitUntil: "load" });
      await page.waitForSelector("h1", { timeout: 15000 });
      await page.waitForTimeout(1000);
      mobileDetail = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        hikariImgs: document.querySelectorAll("img.hikari-image-fade").length,
        stuckShimmers: document.querySelectorAll('[data-hikari-shimmer="true"]').length,
      }));
    }

    report.mobile = { mobileHome, mobileDetail };
    await context.close();
  }

  // =========================================================================
  // 3. PREFERS-REDUCED-MOTION CHECK
  // =========================================================================
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    attachErrorListeners(page, report.errors);

    let releaseImg = null;
    await page.route(/\.(jpg|jpeg|png|webp)(\?.*)?$|anilist|s4\.anilist|cdn\./i, async (route) => {
      if (route.request().resourceType() === "image" && !releaseImg) {
        await new Promise((r) => {
          releaseImg = r;
          setTimeout(r, 3000);
        });
      }
      await route.continue();
    });

    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-hikari-shimmer="true"]', { timeout: 15000 }).catch(() => {});

    const reducedShimmer = await page.evaluate(() => {
      const sh = document.querySelector('[data-hikari-shimmer="true"]');
      const cs = sh ? getComputedStyle(sh) : null;
      return cs
        ? {
            animationName: cs.animationName,
            backgroundImage: cs.backgroundImage,
          }
        : null;
    });

    if (releaseImg) releaseImg();
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.waitForLoadState("load").catch(() => {});
    await page.waitForTimeout(600);

    const buscarBtn = page.locator('button[aria-label="Buscar"]:visible').first();
    await buscarBtn.waitFor({ state: "visible", timeout: 10000 });
    await buscarBtn.click();
    await page.waitForSelector('[role="dialog"] input', { timeout: 10000 });

    await page.route(/\/_serverFn|\/api\//i, async (route) => {
      await new Promise((r) => setTimeout(r, 900));
      await route.continue();
    });
    await page.fill('[role="dialog"] input', "One");
    await page.waitForTimeout(450);

    const reducedModalSkeleton = await page.evaluate(() => {
      const el = document.querySelector('[role="dialog"] .hikari-modal-skeleton-shimmer');
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        animationName: cs.animationName,
        backgroundImage: cs.backgroundImage,
      };
    });

    const reducedFade = await page.evaluate(() => {
      const img = document.querySelector("img.hikari-image-fade");
      if (!img) return null;
      return { transitionDuration: getComputedStyle(img).transitionDuration };
    });

    report.reducedMotion = { reducedShimmer, reducedModalSkeleton, reducedFade };
    await context.close();
  }

  await browser.close();
  console.log(JSON.stringify(report, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
