import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { fromCrossJSON, toCrossJSON } from "seroval";

const BASE_URL = "http://127.0.0.1:3000";
const EXEC_PATH =
  "/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell";
const SCREENSHOTS_DIR = path.resolve(process.cwd(), "screenshots");

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

function parseServerFnExport(url) {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split("/_serverFn/");
    if (parts.length < 2) return null;
    const raw = parts[1].split("?")[0];
    const decoded = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    return decoded?.export ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: EXEC_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const consoleErrors = [];
  const pageErrors = [];

  try {
    // -----------------------------------------------------------------------
    // PARTE A: Teste real contra o servidor em execução (sem mocks)
    // -----------------------------------------------------------------------
    {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
      });
      const page = await context.newPage();
      await page.route("**/pagead2.googlesyndication.com/**", (route) =>
        route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
      );
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(`[A] ${msg.text()}`);
      });
      page.on("pageerror", (err) => pageErrors.push(`[A] ${err.message}`));

      await page.goto(`${BASE_URL}/notifications`, { waitUntil: "networkidle" });
      await page.waitForTimeout(700);
      const notifBody = await page.locator("body").innerText();
      assert.ok(notifBody.includes("Notificações"), "/notifications renderizou");

      await page.goto(`${BASE_URL}/profile/hinata_h`, { waitUntil: "networkidle" });
      await page.waitForTimeout(700);
      const profileBody = await page.locator("body").innerText();
      assert.ok(profileBody.includes("Hinata"), "Perfil público Hinata carregado");

      await page.locator("button:has-text('Seguidores')").first().click();
      await page.waitForTimeout(600);
      const modalText = await page
        .locator("div.fixed.inset-0:has(h2:has-text('Conexões da Comunidade'))")
        .first()
        .innerText();
      assert.equal(modalText.includes("Ver perfil"), false, "Botão 'Ver perfil' deve estar ausente");
      assert.equal(
        await page.locator("button[title='Remover seguidor']").count(),
        0,
        "Visitante NUNCA deve ver botão X de remover seguidor",
      );

      await context.close();
      console.log("✓ PARTE A PASSOU: Rotas reais (/notifications, /profile/hinata_h) sem erros.");
    }

    // -----------------------------------------------------------------------
    // PARTE B: Verificação visual e interativa dos 5 cenários multi-conta
    // -----------------------------------------------------------------------
    {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
      });
      const page = await context.newPage();
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(`[B] ${msg.text()}`);
      });
      page.on("pageerror", (err) => pageErrors.push(`[B] ${err.message}`));

      let acceptCalled = false;
      let rejectCalled = false;
      let removeFollowerCalledWith = null;

      await page.route("**/pagead2.googlesyndication.com/**", (route) =>
        route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
      );

      await page.route("**/api/notifications**", async (route) => {
        const req = route.request();
        if (req.method() === "GET") {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              notifications: [
                {
                  id: "notif-req-priv-1",
                  type: "follow_request",
                  message: "Naruto Uzumaki solicitou para seguir você.",
                  read: false,
                  createdAt: new Date().toISOString(),
                  actorId: "actor_naruto",
                  actorName: "Naruto Uzumaki",
                  actorNick: "naruto_u",
                  actorImage: null,
                  commentId: null,
                  animeId: null,
                  episodeId: null,
                  isFollowingActor: false,
                  hasPendingFollowRequestToActor: false,
                },
                {
                  id: "notif-req-priv-2",
                  type: "follow_request",
                  message: "Sasuke Uchiha solicitou para seguir você.",
                  read: false,
                  createdAt: new Date(Date.now() - 30000).toISOString(),
                  actorId: "actor_sasuke",
                  actorName: "Sasuke Uchiha",
                  actorNick: "sasuke_u",
                  actorImage: null,
                  commentId: null,
                  animeId: null,
                  episodeId: null,
                  isFollowingActor: false,
                  hasPendingFollowRequestToActor: false,
                },
                {
                  id: "notif-follower-1",
                  type: "new_follower",
                  message: "Hinata Hyuga começou a seguir você.",
                  read: false,
                  createdAt: new Date(Date.now() - 60000).toISOString(),
                  actorId: "actor_hinata",
                  actorName: "Hinata Hyuga",
                  actorNick: "hinata_h",
                  actorImage: null,
                  commentId: null,
                  animeId: null,
                  episodeId: null,
                  isFollowingActor: false,
                  hasPendingFollowRequestToActor: false,
                },
              ],
              unreadCount: 3,
              totalCount: 3,
              hasMore: false,
              limit: 20,
              offset: 0,
            }),
          });
        }
        return route.continue();
      });

      await page.route("**/_serverFn/**", async (route) => {
        const req = route.request();
        const url = req.url();
        const exportName = parseServerFnExport(url) || "";

        if (exportName.startsWith("acceptFollowRequest")) {
          acceptCalled = true;
          const payload = toCrossJSON({ result: { success: true } });
          return route.fulfill({
            status: 200,
            headers: {
              "content-type": "application/json",
              "x-tss-serialized": "true",
            },
            body: JSON.stringify(payload),
          });
        }

        if (exportName.startsWith("rejectFollowRequest")) {
          rejectCalled = true;
          const payload = toCrossJSON({ result: { success: true } });
          return route.fulfill({
            status: 200,
            headers: {
              "content-type": "application/json",
              "x-tss-serialized": "true",
            },
            body: JSON.stringify(payload),
          });
        }

        if (exportName.startsWith("removeFollower")) {
          removeFollowerCalledWith = url;
          const payload = toCrossJSON({ result: { success: true, removed: true } });
          return route.fulfill({
            status: 200,
            headers: {
              "content-type": "application/json",
              "x-tss-serialized": "true",
            },
            body: JSON.stringify(payload),
          });
        }

        const res = await route.fetch();
        const text = await res.text();
        let decoded;
        try {
          decoded = fromCrossJSON(JSON.parse(text), { refs: new Map() });
        } catch {
          return route.fulfill({ response: res, body: text });
        }

        if (exportName.startsWith("getPublicProfile_")) {
          if (decoded?.result && typeof decoded.result === "object") {
            decoded.result.isFollowedBy = true;
            decoded.result.isFollowing = false;
            decoded.result.hasPendingRequest = false;
            decoded.result.followersCount = 4;
            decoded.result.followingCount = 2;
            decoded.result.canViewFollowers = true;
            const reencoded = toCrossJSON(decoded);
            return route.fulfill({
              status: res.status(),
              headers: res.headers(),
              body: JSON.stringify(reencoded),
            });
          }
        }

        if (
          exportName.startsWith("getPublicProfileFollowers_") ||
          exportName.startsWith("getPublicProfileFollowing_")
        ) {
          decoded.result = [
            {
              userId: "actor_naruto",
              nick: "naruto_u",
              name: "Naruto Uzumaki",
              image: null,
              isFollowing: false,
              hasPendingRequest: false,
              followsViewer: true,
              followsOpenProfile: true,
            },
            {
              userId: "actor_sasuke",
              nick: "sasuke_u",
              name: "Sasuke Uchiha",
              image: null,
              isFollowing: false,
              hasPendingRequest: false,
              followsViewer: false,
              followsOpenProfile: true,
            },
            {
              userId: "actor_sakura",
              nick: "sakura_h",
              name: "Sakura Haruno",
              image: null,
              isFollowing: true,
              hasPendingRequest: false,
              followsViewer: false,
              followsOpenProfile: true,
            },
            {
              userId: "actor_kiba",
              nick: "kiba_i",
              name: "Kiba Inuzuka",
              image: null,
              isFollowing: false,
              hasPendingRequest: true,
              followsViewer: true,
              followsOpenProfile: true,
            },
          ];
          const reencoded = toCrossJSON(decoded);
          return route.fulfill({
            status: res.status(),
            headers: res.headers(),
            body: JSON.stringify(reencoded),
          });
        }

        if (exportName.startsWith("getProfileFollowers_")) {
          decoded.result = removeFollowerCalledWith
            ? []
            : [
                {
                  userId: "actor_naruto",
                  nick: "naruto_u",
                  name: "Naruto Uzumaki",
                  image: null,
                  isFollowing: false,
                  hasPendingRequest: false,
                  followsViewer: true,
                  followsOpenProfile: true,
                },
              ];
          const reencoded = toCrossJSON(decoded);
          return route.fulfill({
            status: res.status(),
            headers: res.headers(),
            body: JSON.stringify(reencoded),
          });
        }

        return route.fulfill({ response: res, body: text });
      });

      // --- FIX 5: /notifications follow_request Aceitar / Recusar ---
      await page.goto(`${BASE_URL}/notifications`, { waitUntil: "networkidle" });
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "fix5_notifications_desktop.png") });

      assert.equal(await page.locator("button:has-text('Aceitar')").count(), 2, "2 botões 'Aceitar'");
      assert.equal(await page.locator("button:has-text('Recusar')").count(), 2, "2 botões 'Recusar'");

      // Verificar mobile em /notifications
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(300);
      const mobileOverflowNotif = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      assert.equal(mobileOverflowNotif, false, "Sem overflow horizontal mobile em /notifications");
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "fix5_notifications_mobile.png") });
      await page.setViewportSize({ width: 1440, height: 900 });

      // Testar clique interativo em Aceitar e Recusar
      await page.locator("button:has-text('Aceitar')").first().click();
      await page.waitForTimeout(300);
      assert.equal(acceptCalled, true, "acceptFollowRequest deve ser acionado ao clicar em Aceitar");
      assert.ok(
        (await page.locator("body").innerText()).includes("Solicitação aceita"),
        "Feedback 'Solicitação aceita' após clique",
      );

      await page.locator("button:has-text('Recusar')").first().click();
      await page.waitForTimeout(300);
      assert.equal(rejectCalled, true, "rejectFollowRequest deve ser acionado ao clicar em Recusar");
      assert.ok(
        (await page.locator("body").innerText()).includes("Solicitação recusada"),
        "Feedback 'Solicitação recusada' após clique",
      );

      // --- FIX 1, 2, 4: /profile/hinata_h com isFollowedBy: true ---
      await page.goto(`${BASE_URL}/profile/hinata_h`, { waitUntil: "networkidle" });
      await page.waitForTimeout(700);
      const followBackHeaderCount = await page.locator("button:has-text('Seguir de volta')").count();
      assert.ok(followBackHeaderCount >= 1, "Botão 'Seguir de volta' deve aparecer no perfil visitado");
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "fix1_public_profile_follow_back.png") });

      await page.locator("button:has-text('Seguidores')").first().click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "fix2_4_public_connections_modal.png") });

      const modalContainer = page.locator("div.fixed.inset-0:has(h2:has-text('Conexões da Comunidade'))").first();
      const pubModalText = await modalContainer.innerText();
      assert.ok(pubModalText.includes("Naruto Uzumaki"), "Naruto aparece na lista");
      assert.ok(pubModalText.includes("Seguir de volta"), "Naruto segue visitante -> 'Seguir de volta'");
      assert.ok(pubModalText.includes("Sasuke Uchiha"), "Sasuke aparece na lista");
      assert.equal(
        await modalContainer.locator("button[title='Seguir este membro']").count(),
        1,
        "Sasuke não segue visitante -> botão exato 'Seguir'",
      );
      assert.equal(
        await modalContainer.locator("button[title='Seguir este membro de volta']").count(),
        1,
        "Naruto segue visitante -> botão exato 'Seguir de volta'",
      );
      assert.ok(pubModalText.includes("Sakura Haruno") && pubModalText.includes("Seguindo"), "Sakura já seguida -> 'Seguindo'");
      assert.ok(pubModalText.includes("Kiba Inuzuka") && pubModalText.includes("Solicitado"), "Kiba solicitado -> 'Solicitado'");
      assert.equal(pubModalText.includes("Ver perfil"), false, "'Ver perfil' removido da lista");
      assert.equal(
        await modalContainer.locator("button[title='Remover seguidor']").count(),
        0,
        "Visitante não vê botão X de remover seguidor",
      );

      // --- FIX 2 & 3: /account modal de Seguidores + remoção interativa ---
      await page.goto(`${BASE_URL}/account`, { waitUntil: "networkidle" });
      await page.waitForTimeout(700);
      await page.locator("button:has-text('Seguidores')").first().click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "fix3_account_followers_remove.png") });

      const accModal = page.locator("div.fixed.inset-0:has(h2:has-text('Conexões da Comunidade'))").first();
      const accModalText = await accModal.innerText();
      assert.ok(accModalText.includes("Naruto Uzumaki"), "Seguidor aparece na lista do dono");
      assert.ok(accModalText.includes("Seguir de volta"), "Botão 'Seguir de volta' aparece na lista do dono");
      assert.equal(accModalText.includes("Ver perfil"), false, "'Ver perfil' removido na conta própria");
      const ownerRemoveBtn = accModal.locator("button[title='Remover seguidor']");
      assert.equal(await ownerRemoveBtn.count(), 1, "Dono do perfil vê o botão 'X' para remover seguidor");

      // Verificar mobile overflow no modal /account antes de remover
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(300);
      const mobileOverflowAcc = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      assert.equal(mobileOverflowAcc, false, "Sem overflow horizontal mobile no modal /account");
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "fix3_account_followers_mobile.png") });

      // Testar clique interativo no botão X de remover seguidor
      await page.setViewportSize({ width: 1440, height: 900 });
      await ownerRemoveBtn.click();
      await page.waitForTimeout(400);
      assert.ok(removeFollowerCalledWith !== null, "removeFollower foi invocado ao clicar no botão X");
      assert.equal(
        await accModal.locator("text=Naruto Uzumaki").count(),
        0,
        "Seguidor removido some da lista imediatamente",
      );

      await context.close();
      console.log("✓ PARTE B PASSOU: Todos os 5 requisitos de UI validados (Desktop + Mobile + Cliques).");
    }

    assert.equal(consoleErrors.length, 0, `Console errors encontrados: ${consoleErrors.join("; ")}`);
    assert.equal(pageErrors.length, 0, `Page errors encontrados: ${pageErrors.join("; ")}`);
    console.log("✓ Zero console/page errors!");
  } finally {
    await browser.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FALHA NA VERIFICAÇÃO UI:", err);
    process.exit(1);
  });
