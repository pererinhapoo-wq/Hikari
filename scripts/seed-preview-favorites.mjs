import { chromium } from "playwright";

async function main() {
  console.log("Iniciando seed de favoritos via browser...");
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      "/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();

  // 1. Favoritar animes adicionais
  const animeIds = ["16498", "154587", "101922", "11061", "5114"];
  for (const id of animeIds) {
    try {
      await page.goto(`http://127.0.0.1:3000/anime/${id}`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForTimeout(1000);
      const favBtn = page.locator('button:has-text("Favoritar")').first();
      if (await favBtn.isVisible()) {
        await favBtn.click();
        console.log(`Anime ${id} favoritado.`);
        await page.waitForTimeout(800);
      }
    } catch (err) {
      console.warn(`Erro ao favoritar anime ${id}:`, err);
    }
  }

  // 2. Favoritar entidades em /anime/21 (One Piece)
  try {
    await page.goto("http://127.0.0.1:3000/anime/21", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(1500);

    for (let i = 0; i < 9; i++) {
      await page.evaluate(() => window.scrollBy(0, 700));
      await page.waitForTimeout(200);
    }

    const entitiesToFav = [
      "Luffy Monkey",
      "Robin Nico",
      "Zoro Roronoa",
      "Sanji",
      "Toei Animation",
      "Mayumi Tanaka",
      "Eiichirou Oda",
      "Kounosuke Uda",
    ];

    for (const name of entitiesToFav) {
      const btn = page.locator(`button[aria-label="Adicionar ${name} aos favoritos"]`).first();
      if (await btn.isVisible()) {
        await btn.click();
        console.log(`Entidade ${name} favoritada.`);
        await page.waitForTimeout(600);
      } else {
        console.log(`Botão para ${name} não visível ou já favoritado.`);
      }
    }
  } catch (err) {
    console.warn("Erro ao favoritar entidades de One Piece:", err);
  }

  await browser.close();
  console.log("Seed concluído com sucesso!");
}

main().catch(console.error);
