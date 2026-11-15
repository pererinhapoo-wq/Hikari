import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE_URL = "http://127.0.0.1:3000";
const EXECUTABLE_PATH =
  "/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell";

mkdirSync("/app/applet/screenshots", { recursive: true });

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
    throw new Error(`Sign-up failed (${res.status}) for ${email}: ${text}`);
  }
  const data = JSON.parse(text);
  const headerToken = res.headers.get("set-auth-token");
  const token = data?.token || headerToken;
  if (!token || !data?.user?.id) {
    throw new Error(`Missing token/user in sign-up response: ${text}`);
  }
  return { userId: data.user.id, token };
}

async function createAuthedContext(browser, token, viewport) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript((bearer) => {
    try {
      window.sessionStorage.setItem("grok-auth.bearer-token", bearer);
    } catch {
      // ignore
    }
  }, token);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(`console.error: ${msg.text()}`);
    }
  });
  return { context, page, errors };
}

async function scrollToCommentsAndExpand(page, expand = true) {
  const expandBtn = page.locator("button:has-text('Ver comentários')");
  for (let i = 0; i < 12; i++) {
    if (await expandBtn.isVisible().catch(() => false)) break;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(450);
  }
  await expandBtn.waitFor({ state: "visible", timeout: 15000 });
  await expandBtn.scrollIntoViewIfNeeded();
  if (expand) {
    await expandBtn.click();
    await page
      .locator("textarea[placeholder*='Escreva um comentário']")
      .waitFor({ state: "visible", timeout: 15000 });
  }
}

async function main() {
  const ts = Date.now();
  console.log("1) Creating two real Better Auth accounts...");
  const accountA = await signUpUser(
    "Conta Teste A",
    `typing_a_${ts}@example.com`,
    "Password123!",
  );
  const accountB = await signUpUser(
    "Conta Teste B",
    `typing_b_${ts}@example.com`,
    "Password123!",
  );
  console.log(`Account A: ${accountA.userId}`);
  console.log(`Account B: ${accountB.userId}`);
  assert(accountA.userId !== accountB.userId, "Account A and B must have distinct userIds");

  const browser = await chromium.launch({
    executablePath: EXECUTABLE_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const ctxA = await createAuthedContext(browser, accountA.token, {
      width: 1280,
      height: 800,
    });
    const ctxB = await createAuthedContext(browser, accountB.token, {
      width: 1280,
      height: 800,
    });

    // =========================================================================
    // TEST 1: Anime details page (/anime/16498) - A expanded & types, B collapsed -> sees indicator -> expands -> sees indicator
    // =========================================================================
    console.log("2) Navigating A and B to /anime/16498 (Desktop)...");
    await Promise.all([
      ctxA.page.goto(`${BASE_URL}/anime/16498`, { waitUntil: "domcontentloaded" }),
      ctxB.page.goto(`${BASE_URL}/anime/16498`, { waitUntil: "domcontentloaded" }),
    ]);

    await scrollToCommentsAndExpand(ctxA.page, true);
    await scrollToCommentsAndExpand(ctxB.page, false);

    // Give SSE connection on B 500ms to establish
    await ctxB.page.waitForTimeout(500);

    const textareaA = ctxA.page.locator("textarea[placeholder*='Escreva um comentário']");
    await textareaA.click();
    await textareaA.fill("Testando indicador em tempo real...");

    // Wait for B (collapsed) to receive SSE typing indicator
    const indicatorB = ctxB.page.locator("[data-testid='comment-typing-indicator']");
    await indicatorB.waitFor({ state: "visible", timeout: 5000 });
    const textBCollapsed = await indicatorB.innerText();
    console.log("   B (collapsed) indicator text:", JSON.stringify(textBCollapsed));
    assert(textBCollapsed.includes("Alguém está digitando"), "Expected 'Alguém está digitando' on collapsed card");

    // Verify A NEVER sees its own typing indicator
    const indicatorACount = await ctxA.page.locator("[data-testid='comment-typing-indicator']").count();
    assert(indicatorACount === 0, `Account A must NOT see own indicator (found ${indicatorACount})`);

    await ctxB.page.screenshot({ path: "/app/applet/screenshots/typing_desktop_collapsed_b.png" });

    // Now expand B while A keeps typing (heartbeat)
    await ctxB.page.locator("button:has-text('Ver comentários')").click();
    await ctxB.page
      .locator("textarea[placeholder*='Escreva um comentário']")
      .waitFor({ state: "visible", timeout: 15000 });
    await textareaA.type(" mais texto");
    await indicatorB.waitFor({ state: "visible", timeout: 5000 });
    await ctxB.page.screenshot({ path: "/app/applet/screenshots/typing_desktop_expanded_b.png" });
    await ctxA.page.screenshot({ path: "/app/applet/screenshots/typing_desktop_expanded_a.png" });

    // =========================================================================
    // TEST 2: Room isolation (anime room vs episode room)
    // =========================================================================
    console.log("3) Verifying Anime vs Episode room isolation (/watch/16498/ep-1)...");
    const ctxC = await createAuthedContext(browser, accountB.token, {
      width: 1280,
      height: 800,
    });
    await ctxC.page.goto(`${BASE_URL}/watch/16498/ep-1`, { waitUntil: "domcontentloaded" });
    await scrollToCommentsAndExpand(ctxC.page, true);
    await textareaA.type(" ainda no anime");
    await ctxC.page.waitForTimeout(800);
    const indicatorWatchCount = await ctxC.page.locator("[data-testid='comment-typing-indicator']").count();
    assert(
      indicatorWatchCount === 0,
      `Episode room must NOT show typing from anime room (found ${indicatorWatchCount})`,
    );

    // =========================================================================
    // TEST 3: Erase all text -> indicator disappears immediately for B
    // =========================================================================
    console.log("4) Testing erase text -> indicator disappears for B...");
    await textareaA.fill("");
    await indicatorB.waitFor({ state: "hidden", timeout: 3000 });
    console.log("   Indicator disappeared promptly after A erased text.");

    // =========================================================================
    // TEST 4: Stop typing (inactivity / TTL expiration) -> disappears automatically
    // =========================================================================
    console.log("5) Testing stop typing -> automatic TTL/inactivity disappearance...");
    await textareaA.fill("Parando de digitar agora");
    await indicatorB.waitFor({ state: "visible", timeout: 5000 });
    // Wait up to 6.5s for inactivity (2.8s) + server TTL/sweep
    await indicatorB.waitFor({ state: "hidden", timeout: 7500 });
    console.log("   Indicator disappeared automatically after A stopped typing.");

    // =========================================================================
    // TEST 5: Publishing comment still works normally and clears indicator
    // =========================================================================
    console.log("6) Testing comment publication + indicator clearing...");
    const uniqueMsg = `Comentário real E2E ${ts}`;
    await textareaA.fill(uniqueMsg);
    await indicatorB.waitFor({ state: "visible", timeout: 5000 });
    await textareaA.press("Enter");
    // A sees their published comment
    await ctxA.page.locator(`text=${uniqueMsg}`).waitFor({ state: "visible", timeout: 10000 });
    // Indicator clears for B
    await indicatorB.waitFor({ state: "hidden", timeout: 3500 });
    console.log("   Comment published and indicator cleared.");

    // =========================================================================
    // TEST 6: Mobile viewport + Episode Watch room (/watch/16498/ep-1)
    // =========================================================================
    console.log("7) Testing Mobile (390x844) on /watch/16498/ep-1...");
    const mobA = await createAuthedContext(browser, accountA.token, {
      width: 390,
      height: 844,
    });
    const mobB = await createAuthedContext(browser, accountB.token, {
      width: 390,
      height: 844,
    });

    await Promise.all([
      mobA.page.goto(`${BASE_URL}/watch/16498/ep-1`, { waitUntil: "domcontentloaded" }),
      mobB.page.goto(`${BASE_URL}/watch/16498/ep-1`, { waitUntil: "domcontentloaded" }),
    ]);

    await scrollToCommentsAndExpand(mobA.page, true);
    await scrollToCommentsAndExpand(mobB.page, true);
    await mobB.page.waitForTimeout(500);

    const mobTextareaA = mobA.page.locator("textarea[placeholder*='Escreva um comentário']");
    await mobTextareaA.click();
    await mobTextareaA.fill("Digitando no episódio pelo celular");

    const mobIndicatorB = mobB.page.locator("[data-testid='comment-typing-indicator']");
    await mobIndicatorB.waitFor({ state: "visible", timeout: 5000 });
    const mobACount = await mobA.page.locator("[data-testid='comment-typing-indicator']").count();
    assert(mobACount === 0, "Mobile Account A must NOT see own indicator");

    // Check no horizontal overflow on mobile
    const overflowB = await mobB.page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    assert(!overflowB, "Mobile viewport must not have horizontal overflow");

    await mobB.page.screenshot({ path: "/app/applet/screenshots/typing_mobile_watch_b.png" });

    // Clear text on mobile and check disappearance
    await mobTextareaA.fill("");
    await mobIndicatorB.waitFor({ state: "hidden", timeout: 3000 });

    const allErrors = [
      ...ctxA.errors,
      ...ctxB.errors,
      ...ctxC.errors,
      ...mobA.errors,
      ...mobB.errors,
    ];
    console.log("Console/Page errors count:", allErrors.length);
    if (allErrors.length > 0) {
      console.log("Errors:", allErrors);
    }

    await ctxC.context.close();
    await mobA.context.close();
    await mobB.context.close();
    await ctxA.context.close();
    await ctxB.context.close();

    console.log("ALL REAL-TIME TWO-ACCOUNT TYPING TESTS PASSED!");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
