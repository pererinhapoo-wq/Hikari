import { chromium } from "playwright";

async function setAnimeStatus(page, animeId, statusText) {
  console.log(`Configurando status "${statusText}" para o anime ${animeId}...`);
  await page.goto(`http://127.0.0.1:3000/anime/${animeId}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(1200);

  const colecaoBtn = page
    .locator('button:has-text("Minha Coleção"), button:has-text("Coleção"), button:has-text("Gerenciar")')
    .first();
  if (await colecaoBtn.isVisible()) {
    await colecaoBtn.click();
    await page.waitForTimeout(800);

    const modal = page.locator('[role="dialog"]');
    const statusBtn = modal.locator(`button:has-text("${statusText}")`).first();
    if (await statusBtn.isVisible()) {
      await statusBtn.click();
      await page.waitForTimeout(400);

      const saveBtn = modal.locator('button:has-text("Salvar Alterações"), button:has-text("Salvar na Coleção")').first();
      if (await saveBtn.isVisible()) {
        await saveBtn.click();
        await page.waitForTimeout(1200);
        console.log(`Status "${statusText}" salvo com sucesso para anime ${animeId}!`);
      }
    }
  }
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      "/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();

  // 1. One Piece -> Assistindo
  await setAnimeStatus(page, "21", "Assistindo");

  // 2. Attack on Titan -> Concluído (status 'completed' -> 'Assistido')
  await setAnimeStatus(page, "16498", "Concluído");

  // 3. Frieren -> Em espera
  await setAnimeStatus(page, "154587", "Em espera");

  // 4. Demon Slayer -> Abandonado
  await setAnimeStatus(page, "101922", "Abandonado");

  // 5. Hunter x Hunter -> Planejado
  await setAnimeStatus(page, "11061", "Planejado");

  await browser.close();
  console.log("Todas as atividades de status foram criadas!");
}

main().catch(console.error);
