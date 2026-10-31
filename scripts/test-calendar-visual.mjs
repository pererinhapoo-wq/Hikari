import { chromium } from "playwright";
import fs from "node:fs";

async function main() {
  const browser = await chromium.launch({
    executablePath: "/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  if (!fs.existsSync("/screenshots")) {
    fs.mkdirSync("/screenshots", { recursive: true });
  }

  const runTest = async (width, height, name) => {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: width < 600,
    });
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:3000/calendar", {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.waitForTimeout(3000);

    const audit = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("main a[href^=\"/anime/\"]"));
      const header = document.querySelector("main header");
      const weekLabel = Array.from(document.querySelectorAll("span")).find(
        (el) => el.textContent && el.textContent.includes("Semana de")
      );

      let headerBottom = 0;
      let weekTop = 0;
      if (header && weekLabel) {
        headerBottom = header.getBoundingClientRect().bottom;
        weekTop = weekLabel.getBoundingClientRect().top;
      }

      const cardBoxes = cards.slice(0, 6).map((c, i) => {
        const r = c.getBoundingClientRect();
        return {
          index: i,
          x: Math.round(r.x),
          y: Math.round(r.y),
          width: Math.round(r.width),
          height: Math.round(r.height),
        };
      });

      return {
        cardCount: cards.length,
        headerToWeekGap: Math.round(weekTop - headerBottom),
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        cards: cardBoxes,
      };
    });

    console.log(`=== Audit for ${name} (${width}x${height}) ===`);
    console.log(JSON.stringify(audit, null, 2));

    await page.screenshot({
      path: `/screenshots/calendar-${name}.png`,
      fullPage: false,
    });
    await context.close();
  };

  await runTest(390, 844, "mobile-390");
  await runTest(375, 667, "mobile-375");
  await runTest(800, 900, "tablet-800");

  await browser.close();
  console.log("Visual validation completed.");
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
