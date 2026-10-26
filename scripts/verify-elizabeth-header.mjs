import { chromium } from "playwright";

async function run() {
  const browser = await chromium.launch({
    executablePath: "/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  // 1. Mobile verification (390 x 844)
  console.log("--- 1. MOBILE TESTS (390x844) ---");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage();

  await mobilePage.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  await mobilePage.waitForTimeout(3000);

  const mobileMeasurements = await mobilePage.evaluate(() => {
    const header = document.querySelector("header");
    const menuBtn = document.querySelector("button[aria-label='Abrir menu']");
    const charImg = document.querySelector("header img[src*='hikari-elizabeth-character']");
    const wordmarkImg = document.querySelector("header img[src*='hikari-wordmark']");
    const logoContainer = charImg?.parentElement;
    const searchBtn = document.querySelector("header button[aria-label='Pesquisar']");

    const headerBox = header?.getBoundingClientRect();
    const menuBox = menuBtn?.getBoundingClientRect();
    const charBox = charImg?.getBoundingClientRect();
    const wordmarkBox = wordmarkImg?.getBoundingClientRect();
    const containerBox = logoContainer?.getBoundingClientRect();
    const searchBox = searchBtn?.getBoundingClientRect();

    return {
      header: headerBox ? { height: headerBox.height, width: headerBox.width, top: headerBox.top, bottom: headerBox.bottom } : null,
      menu: menuBox ? { right: menuBox.right, width: menuBox.width, height: menuBox.height } : null,
      container: containerBox ? { top: containerBox.top, bottom: containerBox.bottom, left: containerBox.left, right: containerBox.right, width: containerBox.width, height: containerBox.height } : null,
      character: charBox ? { top: charBox.top, bottom: charBox.bottom, left: charBox.left, right: charBox.right, width: charBox.width, height: charBox.height } : null,
      wordmark: wordmarkBox ? { top: wordmarkBox.top, bottom: wordmarkBox.bottom, left: wordmarkBox.left, right: wordmarkBox.right, width: wordmarkBox.width, height: wordmarkBox.height } : null,
      search: searchBox ? { left: searchBox.left, width: searchBox.width } : null,
      containedInHeader: (containerBox && headerBox) ? (containerBox.top >= headerBox.top && containerBox.bottom <= headerBox.bottom) : null,
      gapLeft: (containerBox && menuBox) ? containerBox.left - menuBox.right : null,
      gapRight: (searchBox && containerBox) ? searchBox.left - containerBox.right : null,
      overflowIntoBanner: (containerBox && headerBox) ? Math.max(0, containerBox.bottom - headerBox.bottom) : null,
      elizabethAboveLetters: (charBox && wordmarkBox) ? wordmarkBox.top - charBox.top : null,
    };
  });
  console.log("Mobile layout measurements:", JSON.stringify(mobileMeasurements, null, 2));

  await mobilePage.screenshot({ path: "screenshots/verify-step2-mobile-home.png", fullPage: false });

  // Test scroll behavior
  await mobilePage.evaluate(() => window.scrollBy(0, 400));
  await mobilePage.waitForTimeout(600);
  await mobilePage.screenshot({ path: "screenshots/verify-step2-mobile-scrolled-down.png", fullPage: false });

  await mobilePage.evaluate(() => window.scrollBy(0, -200));
  await mobilePage.waitForTimeout(600);
  await mobilePage.screenshot({ path: "screenshots/verify-step2-mobile-scrolled-up.png", fullPage: false });

  // Test on anime detail page
  await mobilePage.goto("http://localhost:3000/anime/21", { waitUntil: "domcontentloaded" });
  await mobilePage.waitForTimeout(3000);
  await mobilePage.screenshot({ path: "screenshots/verify-step2-mobile-anime21.png", fullPage: false });

  // 2. Desktop verification (1280 x 800)
  console.log("--- 2. DESKTOP TESTS (1280x800) ---");
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const desktopPage = await desktopContext.newPage();

  await desktopPage.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  await desktopPage.waitForTimeout(3000);

  const desktopMeasurements = await desktopPage.evaluate(() => {
    const header = document.querySelector("header");
    const menuBtn = document.querySelector("button[aria-label='Abrir menu']");
    const charImg = document.querySelector("header img[src*='hikari-elizabeth-character']");
    const wordmarkImg = document.querySelector("header img[src*='hikari-wordmark']");
    const logoContainer = charImg?.parentElement;
    const searchBtn = document.querySelector("header button[aria-label='Pesquisar']");

    const headerBox = header?.getBoundingClientRect();
    const menuBox = menuBtn?.getBoundingClientRect();
    const charBox = charImg?.getBoundingClientRect();
    const wordmarkBox = wordmarkImg?.getBoundingClientRect();
    const containerBox = logoContainer?.getBoundingClientRect();
    const searchBox = searchBtn?.getBoundingClientRect();

    return {
      header: headerBox ? { height: headerBox.height, width: headerBox.width, top: headerBox.top, bottom: headerBox.bottom } : null,
      menu: menuBox ? { right: menuBox.right, width: menuBox.width } : null,
      container: containerBox ? { top: containerBox.top, bottom: containerBox.bottom, left: containerBox.left, right: containerBox.right, width: containerBox.width, height: containerBox.height } : null,
      character: charBox ? { top: charBox.top, bottom: charBox.bottom, left: charBox.left, right: charBox.right, width: charBox.width, height: charBox.height } : null,
      wordmark: wordmarkBox ? { top: wordmarkBox.top, bottom: wordmarkBox.bottom, left: wordmarkBox.left, right: wordmarkBox.right, width: wordmarkBox.width, height: wordmarkBox.height } : null,
      search: searchBox ? { left: searchBox.left } : null,
      containedInHeader: (containerBox && headerBox) ? (containerBox.top >= headerBox.top && containerBox.bottom <= headerBox.bottom) : null,
      gapLeft: (containerBox && menuBox) ? containerBox.left - menuBox.right : null,
      overflowIntoBanner: (containerBox && headerBox) ? Math.max(0, containerBox.bottom - headerBox.bottom) : null,
      elizabethAboveLetters: (charBox && wordmarkBox) ? wordmarkBox.top - charBox.top : null,
    };
  });
  console.log("Desktop layout measurements:", JSON.stringify(desktopMeasurements, null, 2));

  await desktopPage.screenshot({ path: "screenshots/verify-step2-desktop-home.png", fullPage: false });

  // Test scroll behavior on desktop
  await desktopPage.evaluate(() => window.scrollBy(0, 400));
  await desktopPage.waitForTimeout(600);
  await desktopPage.screenshot({ path: "screenshots/verify-step2-desktop-scrolled-down.png", fullPage: false });

  await desktopPage.evaluate(() => window.scrollBy(0, -200));
  await desktopPage.waitForTimeout(600);
  await desktopPage.screenshot({ path: "screenshots/verify-step2-desktop-scrolled-up.png", fullPage: false });

  // Test anime detail on desktop
  await desktopPage.goto("http://localhost:3000/anime/21", { waitUntil: "domcontentloaded" });
  await desktopPage.waitForTimeout(3000);
  await desktopPage.screenshot({ path: "screenshots/verify-step2-desktop-anime21.png", fullPage: false });

  await browser.close();
  console.log("Verification finished successfully!");
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
