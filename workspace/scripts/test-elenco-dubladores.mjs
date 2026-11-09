import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('Browser error:', msg.text());
  });

  console.log('Navigating to homepage...');
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Find any anime link
  const hrefs = await page.$$eval('a[href*="/anime/"]', els => els.map(e => e.getAttribute('href')));
  console.log('Found anime links:', hrefs.slice(0, 5));

  const targetHref = hrefs[0] || '/anime/1';
  console.log('Navigating to anime page:', targetHref);
  await page.goto(`http://127.0.0.1:3000${targetHref}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Scroll down progressively to trigger SectionReveal
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(800);
  }

  // Check Personagens heading and cards
  const personagensHeading = await page.$('h2:text("Personagens")');
  console.log('Personagens heading present:', Boolean(personagensHeading));

  const dubladoresHeading = await page.$('h2:text("Dubladores")');
  console.log('Dubladores heading present:', Boolean(dubladoresHeading));

  // Extract text from cards in both sections
  const sectionsData = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h2'));
    const pHeading = headings.find(h => h.textContent?.includes('Personagens'));
    const dHeading = headings.find(h => h.textContent?.includes('Dubladores'));

    const pCards = pHeading?.closest('section')?.querySelectorAll('.group') ?? [];
    const dCards = dHeading?.closest('section')?.querySelectorAll('.group') ?? [];

    const pCardTexts = Array.from(pCards).slice(0, 4).map(c => c.textContent?.trim());
    const dCardTexts = Array.from(dCards).slice(0, 4).map(c => c.textContent?.trim());

    return {
      personagensCount: pCards.length,
      dubladoresCount: dCards.length,
      pCardTexts,
      dCardTexts
    };
  });

  console.log('Sections extraction:', JSON.stringify(sectionsData, null, 2));

  // Screenshot desktop
  await page.screenshot({ path: 'screenshots/elenco_dubladores_desktop.png' });
  console.log('Saved screenshots/elenco_dubladores_desktop.png');

  // Test mobile viewport
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 1000));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/elenco_dubladores_mobile.png' });
  console.log('Saved screenshots/elenco_dubladores_mobile.png');

  await browser.close();
}

run().catch(err => {
  console.error('Test script error:', err);
  process.exit(1);
});
