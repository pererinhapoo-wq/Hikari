import { chromium } from "playwright";
import { getSql } from "@/lib/db";
import { executeFollowUser } from "@/lib/profile.functions";

async function runBrowserTest() {
  const sql = await getSql();

  // Create two users
  const user1Id = "test_alice_" + Date.now();
  const user2Id = "test_bob_" + Date.now();
  const user1Nick = "alice_" + Date.now().toString().slice(-5);
  const user2Nick = "bob_" + Date.now().toString().slice(-5);

  try {
    await sql`insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt") values (${user1Id}, 'Alice Test', ${user1Id + '@test.com'}, true, current_timestamp, current_timestamp)`;
    await sql`insert into "profile" ("userId", "nick", "displayName", "accountType", "allowFollowers") values (${user1Id}, ${user1Nick}, 'Alice Test', 'public', true)`;

    await sql`insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt") values (${user2Id}, 'Bob Test', ${user2Id + '@test.com'}, true, current_timestamp, current_timestamp)`;
    await sql`insert into "profile" ("userId", "nick", "displayName", "accountType", "allowFollowers") values (${user2Id}, ${user2Nick}, 'Bob Test', 'public', true)`;

    console.log(`Created users: Alice (${user1Id}, nick: ${user1Nick}), Bob (${user2Id}, nick: ${user2Nick})`);

    // Alice follows Bob
    console.log("Alice follows Bob...");
    await executeFollowUser(sql, user1Id, user2Id);

    // Verify user_follow in DB
    const followRows = await sql`select * from "user_follow" where "followerId" = ${user1Id} and "followingId" = ${user2Id}`;
    console.log("user_follow row in DB:", followRows);

    // Now launch browser with chrome-headless-shell
    const browser = await chromium.launch({
      executablePath: "/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    // Set console listener
    page.on("console", (msg) => console.log("PAGE LOG:", msg.type(), msg.text()));
    page.on("pageerror", (err) => console.error("PAGE ERROR:", err));

    // Bob opens his profile: let's test visiting /profile/$user2Nick
    console.log(`Navigating to http://127.0.0.1:3000/profile/${user2Nick}...`);
    await page.goto(`http://127.0.0.1:3000/profile/${user2Nick}`, { waitUntil: "networkidle" });

    await page.screenshot({ path: "/workspace/screenshots/test_profile_bob.png" });

    // Look for followers button
    console.log("Looking for followers button...");
    const followersBtn = page.locator("button:has-text('Seguidores')");
    const count = await followersBtn.count();
    console.log("Followers button count:", count);

    if (count > 0) {
      await followersBtn.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "/workspace/screenshots/test_modal_bob.png" });

      // Check modal content
      const modalText = await page.locator("body").innerText();
      console.log("Has 'Alice Test':", modalText.includes("Alice Test"));
      console.log("Has 'Seguir de volta':", modalText.includes("Seguir de volta"));
      console.log("Has 'Seguindo':", modalText.includes("Seguindo"));
      console.log("Has 'Ver perfil':", modalText.includes("Ver perfil"));
    }

    // Now let's test /account
    console.log("Navigating to http://127.0.0.1:3000/account...");
    await page.goto("http://127.0.0.1:3000/account", { waitUntil: "networkidle" });
    await page.screenshot({ path: "/workspace/screenshots/test_account.png" });

    const accFollowersBtn = page.locator("button:has-text('Seguidores')");
    const accCount = await accFollowersBtn.count();
    console.log("Account Followers button count:", accCount);
    if (accCount > 0) {
      await accFollowersBtn.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "/workspace/screenshots/test_account_modal.png" });

      const accModalText = await page.locator("body").innerText();
      console.log("Account modal has 'Seguir de volta':", accModalText.includes("Seguir de volta"));
      console.log("Account modal has 'Seguindo':", accModalText.includes("Seguindo"));
    }

    await browser.close();
  } finally {
    // Cleanup
    await sql`delete from "user_follow" where "followerId" in (${user1Id}, ${user2Id}) or "followingId" in (${user1Id}, ${user2Id})`;
    await sql`delete from "profile" where "userId" in (${user1Id}, ${user2Id})`;
    await sql`delete from "user" where "id" in (${user1Id}, ${user2Id})`;
    console.log("Cleanup done.");
  }
}

runBrowserTest().catch(console.error);
