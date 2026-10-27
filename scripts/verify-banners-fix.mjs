import { chromium } from "playwright";
import fs from "node:fs";

const TARGETS = [
  { id: "918", name: "Gintama-T1" },
  { id: "9969", name: "Gintama-T2" },
  { id: "98034", name: "Saiki-K-T2" },
  { id: "21399", name: "Kizumonogatari-2" },
  { id: "21400", name: "Kizumonogatari-3" },
  { id: "195604", name: "Black-Clover-S2" },
  { id: "5081", name: "Bakemonogatari" },
];

async function run() {
  const browser = await chromium.launch({
    executablePath: "/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const results = [];

  for (const target of TARGETS) {
    console.log(`\n=== Testing ${target.name} (${target.id}) ===`);
    const entry = { id: target.id, name: target.name, mobile: {}, desktop: {} };

    // --- MOBILE VIEWPORT (390 x 844) ---
    {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
      });
      const page = await context.newPage();
      try {
        await page.goto(`http://localhost:3000/anime/${target.id}`, { waitUntil: "domcontentloaded", timeout: 15000 });
        // Aguarda resolução da imagem alternativa
        await page.waitForTimeout(4500);

        const bannerData = await page.evaluate(() => {
          // Localiza a imagem do banner principal na página do anime
          const images = Array.from(document.querySelectorAll("img"));
          const bannerImg = images.find(img => {
            const h = img.naturalHeight;
            const w = img.naturalWidth;
            const cls = (img.className || "");
            const alt = (img.alt || "");
            const src = img.src || "";
            return (cls.includes("object-cover") || cls.includes("banner") || alt.includes("Banner")) &&
              (src.includes("kitsu") || src.includes("anilist") || src.includes("banner") || src.includes("cover"));
          }) || images.find(img => img.naturalWidth > 600 && img.className.includes("object-cover"));

          if (!bannerImg) {
            return { found: false };
          }

          const computed = window.getComputedStyle(bannerImg);
          return {
            found: true,
            src: bannerImg.src,
            naturalWidth: bannerImg.naturalWidth,
            naturalHeight: bannerImg.naturalHeight,
            aspect: bannerImg.naturalHeight > 0 ? (bannerImg.naturalWidth / bannerImg.naturalHeight).toFixed(3) : null,
            objectPosition: computed.objectPosition,
            className: bannerImg.className,
          };
        });

        const screenshotPath = `screenshots/fixed-${target.name}-mobile.png`;
        await page.screenshot({ path: screenshotPath, fullPage: false });

        entry.mobile = { ...bannerData, screenshot: screenshotPath };
        console.log(`Mobile:`, bannerData);
      } catch (err) {
        console.error(`Error testing mobile for ${target.id}:`, err.message);
        entry.mobile = { error: err.message };
      } finally {
        await context.close();
      }
    }

    // --- DESKTOP VIEWPORT (1280 x 800) ---
    {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        isMobile: false,
      });
      const page = await context.newPage();
      try {
        await page.goto(`http://localhost:3000/anime/${target.id}`, { waitUntil: "domcontentloaded", timeout: 15000 });
        await page.waitForTimeout(3000);

        const bannerData = await page.evaluate(() => {
          const images = Array.from(document.querySelectorAll("img"));
          const bannerImg = images.find(img => {
            const cls = (img.className || "");
            const alt = (img.alt || "");
            const src = img.src || "";
            return (cls.includes("object-cover") || cls.includes("banner") || alt.includes("Banner")) &&
              (src.includes("anilist") || src.includes("kitsu") || src.includes("banner"));
          }) || images.find(img => img.naturalWidth > 600 && img.className.includes("object-cover"));

          if (!bannerImg) {
            return { found: false };
          }

          const computed = window.getComputedStyle(bannerImg);
          return {
            found: true,
            src: bannerImg.src,
            naturalWidth: bannerImg.naturalWidth,
            naturalHeight: bannerImg.naturalHeight,
            aspect: bannerImg.naturalHeight > 0 ? (bannerImg.naturalWidth / bannerImg.naturalHeight).toFixed(3) : null,
            objectPosition: computed.objectPosition,
            className: bannerImg.className,
          };
        });

        const screenshotPath = `screenshots/fixed-${target.name}-desktop.png`;
        await page.screenshot({ path: screenshotPath, fullPage: false });

        entry.desktop = { ...bannerData, screenshot: screenshotPath };
        console.log(`Desktop:`, bannerData);
      } catch (err) {
        console.error(`Error testing desktop for ${target.id}:`, err.message);
        entry.desktop = { error: err.message };
      } finally {
        await context.close();
      }
    }

    results.push(entry);
  }

  await browser.close();

  fs.writeFileSync("screenshots/verification-results.json", JSON.stringify(results, null, 2));
  console.log("\nSaved results to screenshots/verification-results.json");
}

run().catch(console.error);
