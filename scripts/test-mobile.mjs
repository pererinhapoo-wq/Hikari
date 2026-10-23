import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({
    executablePath: "/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  const page = await context.newPage();

  console.log("Navigating to mobile view...");
  await page.goto("http://localhost:3000/anime/195516", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  // Check horizontal overflow on body/html
  const overflow = await page.evaluate(() => {
    return {
      windowWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
    };
  });
  console.log("Mobile viewport widths:", overflow);

  const hasOverflow = overflow.documentWidth > overflow.windowWidth;
  console.log("Has horizontal page overflow:", hasOverflow);

  await page.screenshot({ path: "screenshots/mobile-detail.png", fullPage: false });
  console.log("Saved mobile screenshot: screenshots/mobile-detail.png");

  await browser.close();
}

main().catch(console.error);
