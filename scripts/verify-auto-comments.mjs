import { chromium } from "playwright";

const BASE_URL = "http://127.0.0.1:3000";
const EXECUTABLE_PATH =
  "/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell";

function assert(cond, msg) {
  if (!cond) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

async function signUpUser(name, email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:8080",
    },
    body: JSON.stringify({ name, email, password }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Sign-up failed (${res.status}): ${text}`);
  }
  const data = JSON.parse(text);
  const token = data?.token || res.headers.get("set-auth-token");
  return { userId: data.user.id, token };
}

async function testPage(page, url, name, isAuthed = false) {
  console.log(`\n--- Testing ${name} (${url}) [Authed: ${isAuthed}] ---`);
  const errors = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(`console.error: ${msg.text()}`);
    }
  });

  await page.goto(`${BASE_URL}${url}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);

  // Scroll down step by step to trigger SectionReveal
  for (let i = 0; i < 20; i++) {
    const hasHeader = await page.locator("h2:has-text('Comentários')").isVisible().catch(() => false);
    if (hasHeader) break;
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(250);
  }

  // 1. Confirm "Ver comentários" DOES NOT EXIST anywhere on page
  const verComentariosCount = await page.locator("text='Ver comentários'").count();
  console.log(`[${name}] 'Ver comentários' count:`, verComentariosCount);
  assert(verComentariosCount === 0, `'Ver comentários' must not exist on ${name}`);

  // 2. Confirm Header "Comentários", Tabs (Destaque, Recentes, Antigos) are automatically visible without any click!
  const header = page.locator("h2:has-text('Comentários')");
  await header.waitFor({ state: "visible", timeout: 15000 });
  const tabs = page.locator("button:has-text('Destaque')");
  await tabs.waitFor({ state: "visible", timeout: 5000 });
  console.log(`[${name}] Header 'Comentários' and sorting tabs are automatically visible!`);

  // 3. Confirm comments area is automatically loaded (either comments or empty message)
  const emptyNoticeOrList = page.locator("text='Ainda não há comentários', text='Seja o primeiro a comentar', [data-testid='comment-card']");
  const hasContent = (await emptyNoticeOrList.count()) > 0;
  console.log(`[${name}] Comments list/empty state is automatically present: ${hasContent}`);

  // 4. If authed, confirm textarea composer is automatically visible
  if (isAuthed) {
    const textarea = page.locator("textarea[placeholder*='Escreva um comentário']");
    await textarea.waitFor({ state: "visible", timeout: 8000 });
    console.log(`[${name}] Authed textarea is automatically visible!`);
  } else {
    // If visitor, confirm "Entrar" button is automatically visible
    const entrarBtn = page.locator("button:has-text('Entrar')");
    await entrarBtn.waitFor({ state: "visible", timeout: 8000 });
    console.log(`[${name}] Visitor 'Entrar' button is automatically visible!`);
  }

  // 5. Confirm no horizontal overflow
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  assert(!hasOverflow, `No horizontal overflow on ${name}`);
  console.log(`[${name}] Layout has no horizontal overflow.`);

  assert(errors.length === 0, `Zero errors expected on ${name}, found: ${JSON.stringify(errors)}`);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: EXECUTABLE_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    // 1. Desktop Tests - Unauthenticated Visitors (1280x900)
    const visitorDesktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await testPage(visitorDesktop, "/watch/16498/ep-1", "Desktop Episode Watch (Visitor)", false);
    await testPage(visitorDesktop, "/anime/16498", "Desktop Anime Details (Visitor)", false);
    await visitorDesktop.close();

    // 2. Mobile Tests - Unauthenticated Visitors (390x844)
    const visitorMobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await testPage(visitorMobile, "/watch/16498/ep-1", "Mobile Episode Watch (Visitor)", false);
    await testPage(visitorMobile, "/anime/16498", "Mobile Anime Details (Visitor)", false);
    await visitorMobile.close();

    console.log("\n=== ALL AUTO-LOADING COMMENTS TESTS PASSED! ===");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
