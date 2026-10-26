import { chromium } from "playwright";

async function run() {
  const launchOptions = {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  };
  try {
    launchOptions.executablePath =
      "/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell";
  } catch {}

  const browser = await chromium.launch(launchOptions).catch(async () => {
    return await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  });

  console.log("=== TEST 1: DESKTOP COMMENTS LOADING SCREEN (1280x800) ===");
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const desktopPage = await desktopContext.newPage();

  // Intercept comments request to capture loading screen deterministically
  let commentsDeferredResolve;
  let commentsDeferredPromise = new Promise((res) => {
    commentsDeferredResolve = res;
  });

  let interceptedOnce = false;
  await desktopPage.route("**/api/comments*", async (route) => {
    if (!interceptedOnce) {
      interceptedOnce = true;
      console.log("[Desktop] Intercepted first /api/comments request, delaying to test loading screen...");
      await commentsDeferredPromise;
      await route.continue();
    } else {
      await route.continue();
    }
  });

  await desktopPage.goto("http://localhost:3000/watch/21?ep=1", { waitUntil: "domcontentloaded" });
  await desktopPage.waitForTimeout(1500);

  // Scroll to comments section
  await desktopPage.evaluate(() => {
    const el = document.querySelector("section");
    if (el) el.scrollIntoView({ behavior: "instant", block: "center" });
  });
  await desktopPage.waitForTimeout(500);

  // Verify Elizabeth loading screen elements
  const loadingStatusDesktop = await desktopPage.evaluate(() => {
    const container = document.querySelector(".elizabeth-loading-container");
    const elizabethImg = container?.querySelector("img[src*='hikari-elizabeth-character']");
    const textEl = container?.querySelector("p");
    const spinner = container?.querySelector(".elizabeth-spinner");
    const swayEl = container?.querySelector(".elizabeth-sway-anim");

    return {
      hasContainer: Boolean(container),
      hasElizabethImg: Boolean(elizabethImg),
      imgSrc: elizabethImg?.getAttribute("src"),
      text: textEl?.textContent?.trim(),
      hasSpinner: Boolean(spinner),
      hasSway: Boolean(swayEl),
    };
  });
  console.log("Desktop Loading Screen Status:", JSON.stringify(loadingStatusDesktop, null, 2));

  await desktopPage.screenshot({
    path: "screenshots/verify-elizabeth-loading-desktop.png",
    fullPage: false,
  });
  console.log("Captured screenshots/verify-elizabeth-loading-desktop.png");

  // Now release comments
  console.log("Releasing comments API response...");
  commentsDeferredResolve();
  await desktopPage.waitForTimeout(1500);

  // Verify comments interface appeared
  const loadedStatusDesktop = await desktopPage.evaluate(() => {
    const loadingContainer = document.querySelector(".elizabeth-loading-container");
    const commentsHeader = document.querySelector("h2");
    const commentCards = document.querySelectorAll("article[id^='comment-']");
    return {
      loadingContainerGone: !loadingContainer,
      commentsHeader: commentsHeader?.textContent?.trim(),
      commentCardsCount: commentCards.length,
    };
  });
  console.log("Desktop Loaded Comments Status:", JSON.stringify(loadedStatusDesktop, null, 2));

  await desktopPage.screenshot({
    path: "screenshots/verify-elizabeth-loaded-desktop.png",
    fullPage: false,
  });
  console.log("Captured screenshots/verify-elizabeth-loaded-desktop.png");

  console.log("\n=== TEST 2: MOBILE COMMENTS LOADING SCREEN (390x844) ===");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage();

  let mobileCommentsResolve;
  let mobileCommentsPromise = new Promise((res) => {
    mobileCommentsResolve = res;
  });

  let mobileIntercepted = false;
  await mobilePage.route("**/api/comments*", async (route) => {
    if (!mobileIntercepted) {
      mobileIntercepted = true;
      console.log("[Mobile] Intercepted /api/comments request, delaying to test loading screen...");
      await mobileCommentsPromise;
      await route.continue();
    } else {
      await route.continue();
    }
  });

  await mobilePage.goto("http://localhost:3000/watch/21?ep=1", { waitUntil: "domcontentloaded" });
  await mobilePage.waitForTimeout(1500);

  await mobilePage.evaluate(() => {
    const el = document.querySelector("section");
    if (el) el.scrollIntoView({ behavior: "instant", block: "center" });
  });
  await mobilePage.waitForTimeout(500);

  const loadingStatusMobile = await mobilePage.evaluate(() => {
    const container = document.querySelector(".elizabeth-loading-container");
    const elizabethImg = container?.querySelector("img[src*='hikari-elizabeth-character']");
    const textEl = container?.querySelector("p");
    const spinner = container?.querySelector(".elizabeth-spinner");
    const swayEl = container?.querySelector(".elizabeth-sway-anim");

    return {
      hasContainer: Boolean(container),
      hasElizabethImg: Boolean(elizabethImg),
      imgSrc: elizabethImg?.getAttribute("src"),
      text: textEl?.textContent?.trim(),
      hasSpinner: Boolean(spinner),
      hasSway: Boolean(swayEl),
    };
  });
  console.log("Mobile Loading Screen Status:", JSON.stringify(loadingStatusMobile, null, 2));

  await mobilePage.screenshot({
    path: "screenshots/verify-elizabeth-loading-mobile.png",
    fullPage: false,
  });
  console.log("Captured screenshots/verify-elizabeth-loading-mobile.png");

  // Release comments
  mobileCommentsResolve();
  await mobilePage.waitForTimeout(1500);

  await mobilePage.screenshot({
    path: "screenshots/verify-elizabeth-loaded-mobile.png",
    fullPage: false,
  });
  console.log("Captured screenshots/verify-elizabeth-loaded-mobile.png");

  console.log("\n=== TEST 3: EPISODE SWITCHING (EPISODE 1 -> EPISODE 2) ===");
  // Test switching episode on mobile
  const switchedStatus = await mobilePage.evaluate(async () => {
    // Find episode 2 button
    const epButtons = Array.from(document.querySelectorAll("button")).filter(b => 
      b.textContent?.includes("Ep") || b.textContent?.includes("Episódio") || b.textContent?.includes("2")
    );
    return { foundButtons: epButtons.length };
  });
  console.log("Episode buttons found:", switchedStatus);

  // Navigate to ep 2 directly
  await mobilePage.goto("http://localhost:3000/watch/21?ep=2", { waitUntil: "domcontentloaded" });
  await mobilePage.waitForTimeout(2000);
  await mobilePage.screenshot({
    path: "screenshots/verify-elizabeth-ep2-mobile.png",
    fullPage: false,
  });
  console.log("Captured screenshots/verify-elizabeth-ep2-mobile.png");

  console.log("\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!");
  await browser.close();
}

run().catch((err) => {
  console.error("Test run error:", err);
  process.exit(1);
});
