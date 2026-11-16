/**
 * Suite de Testes da Etapa 4:
 * Loaders agregados, avaliação única de privacidade, segurança SSR/Preview,
 * carregamento progressivo de atividades/comentários e invalidação de cache.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getSql, dbSource } from "@/lib/db";
import {
  executeGetPublicProfileBundle,
  executeGetAccountProfileBundle,
  executeGetUserActivities,
  executeGetComments,
  evaluateUserPrivacy,
} from "@/lib/profile.functions";
import {
  getCachedPublicProfileBundle,
  setCachedPublicProfileBundle,
  invalidatePublicProfileCache,
  invalidatePublicProfileCacheByUserId,
  getCachedAccountProfileBundle,
  setCachedAccountProfileBundle,
  invalidateAccountProfileCache,
  fetchProfileMetaOnce,
  invalidateAllProfileCaches,
  setKnownViewerId,
  PROFILE_CACHE_TTL_MS,
} from "@/lib/profile-client-cache";

type QueryRecord = {
  sql: string;
};

function createCountingSql(baseSql: Awaited<ReturnType<typeof getSql>>) {
  const queries: QueryRecord[] = [];
  const proxy = new Proxy(baseSql as unknown as (...args: unknown[]) => unknown, {
    apply(target, thisArg, argArray) {
      const strings = argArray[0];
      if (Array.isArray(strings)) {
        const text = strings.join("?").replace(/\s+/g, " ").trim();
        queries.push({ sql: text });
      }
      return Reflect.apply(target, thisArg, argArray);
    },
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop === "query" && typeof value === "function") {
        return (queryText: string, params?: unknown[]) => {
          queries.push({ sql: String(queryText).replace(/\s+/g, " ").trim() });
          return value.call(target, queryText, params);
        };
      }
      return value;
    },
  }) as unknown as typeof baseSql;
  return { sql: proxy, queries };
}

async function runEtapa4ServerTests() {
  console.log("=== ETAPA 4: TESTES DE LOADERS AGREGADOS, PRIVACIDADE E CACHE ===");
  console.log(`Backend de banco ativo: ${dbSource.toUpperCase()}`);

  const baseSql = await getSql();
  const ts = Date.now();
  const ownerId = `e4_alice_${ts}`;
  const followerId = `e4_bob_${ts}`;
  const strangerId = `e4_charlie_${ts}`;
  const blockedId = `e4_dave_${ts}`;
  const requesterId = `e4_eve_${ts}`;

  const ownerNick = `alice_e4_${String(ts).slice(-6)}`;
  const followerNick = `bob_e4_${String(ts).slice(-6)}`;
  const strangerNick = `charlie_e4_${String(ts).slice(-6)}`;
  const blockedNick = `dave_e4_${String(ts).slice(-6)}`;
  const requesterNick = `eve_e4_${String(ts).slice(-6)}`;

  const animeId = `kitsu-e4-${ts}`;

  try {
    // 0. Preparar usuários, perfis, tracking, favoritos, atividades, comentários e relações
    await baseSql`
      insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      values
        (${ownerId}, 'Alice E4', ${ownerId + "@test.com"}, true, now(), now()),
        (${followerId}, 'Bob E4', ${followerId + "@test.com"}, true, now(), now()),
        (${strangerId}, 'Charlie E4', ${strangerId + "@test.com"}, true, now(), now()),
        (${blockedId}, 'Dave E4', ${blockedId + "@test.com"}, true, now(), now()),
        (${requesterId}, 'Eve E4', ${requesterId + "@test.com"}, true, now(), now())
      on conflict do nothing
    `;

    await baseSql`
      insert into "profile" (
        "userId", "nick", "displayName", "bio", "bannerUrl",
        "accountType", "allowFollowers",
        "privacyLists", "privacyFavorites", "privacyHistory", "privacyComments", "privacyFollowers"
      )
      values
        (${ownerId}, ${ownerNick}, 'Alice E4', 'Bio secreta da Alice', 'https://example.com/banner.jpg', 'public', true, 'public', 'public', 'public', 'public', 'public'),
        (${followerId}, ${followerNick}, 'Bob E4', '', null, 'public', true, 'public', 'public', 'public', 'public', 'public'),
        (${strangerId}, ${strangerNick}, 'Charlie E4', '', null, 'public', true, 'public', 'public', 'public', 'public', 'public'),
        (${blockedId}, ${blockedNick}, 'Dave E4', '', null, 'public', true, 'public', 'public', 'public', 'public', 'public'),
        (${requesterId}, ${requesterNick}, 'Eve E4', '', null, 'public', true, 'public', 'public', 'public', 'public', 'public')
      on conflict ("userId") do nothing
    `;

    await baseSql`
      insert into "catalog_anime" ("id", "title", "createdAt", "updatedAt")
      values (${animeId}, 'Frieren E4', now(), now())
      on conflict ("id") do nothing
    `;

    // Tracking
    await baseSql`
      insert into "user_anime_tracking" ("userId", "animeId", "status", "score", "episodesWatched", "animeSnapshot", "createdAt", "updatedAt")
      values (
        ${ownerId},
        ${animeId},
        'watching',
        9.5,
        12,
        ${JSON.stringify({ title: "Frieren E4", cover: "https://example.com/frieren.jpg", episodesCount: 28 })},
        now() - interval '30 minutes',
        now() - interval '30 minutes'
      )
    `;

    await baseSql`
      insert into "catalog_character" ("id", "name", "imageUrl", "createdAt", "updatedAt")
      values (${`char-e4-${ts}`}, 'Frieren', 'https://example.com/f.jpg', now(), now())
      on conflict ("id") do nothing
    `;
    await baseSql`
      insert into "catalog_studio" ("id", "name", "createdAt", "updatedAt")
      values (${`studio-e4-${ts}`}, ${`Madhouse E4 ${ts}`}, now(), now())
      on conflict ("id") do nothing
    `;

    // Favoritos (anime, character, studio)
    await baseSql`
      insert into "user_favorite" ("id", "userId", "targetType", "animeId", "createdAt")
      values
        (${`fav-a-${ts}`}, ${ownerId}, 'anime', ${animeId}, now() - interval '25 minutes')
    `;
    await baseSql`
      insert into "user_favorite" ("id", "userId", "targetType", "characterId", "createdAt")
      values
        (${`fav-c-${ts}`}, ${ownerId}, 'character', ${`char-e4-${ts}`}, now() - interval '24 minutes')
    `;
    await baseSql`
      insert into "user_favorite" ("id", "userId", "targetType", "studioId", "createdAt")
      values
        (${`fav-s-${ts}`}, ${ownerId}, 'studio', ${`studio-e4-${ts}`}, now() - interval '23 minutes')
    `;

    // Atividades (8 eventos para testar preview limit 6 + hasMore=true)
    for (let i = 1; i <= 7; i++) {
      await baseSql`
        insert into "user_watched_episode" ("userId", "animeId", "episodeId", "episodeNumber", "origin", "watchedAt")
        values (${ownerId}, ${animeId}, ${`ep-e4-${i}`}, ${i}, 'playback', now() - ${`${i} minutes`}::interval)
      `;
    }

    // Comentários (2)
    await baseSql`
      insert into "comment" ("id", "userId", "animeId", "episodeId", "content", "isSpoiler", "createdAt", "updatedAt")
      values
        (${`c1-${ts}`}, ${ownerId}, ${animeId}, 'ep-e4-1', 'Episódio excelente!', false, now() - interval '10 minutes', now() - interval '10 minutes'),
        (${`c2-${ts}`}, ${ownerId}, ${animeId}, 'ep-e4-2', 'Animação absurda!', false, now() - interval '5 minutes', now() - interval '5 minutes')
    `;

    // Seguidores / Bloqueio / Solicitação pendente
    await baseSql`
      insert into "user_follow" ("followerId", "followingId", "createdAt")
      values (${followerId}, ${ownerId}, now())
      on conflict do nothing
    `;
    await baseSql`
      insert into "user_block" ("blockerId", "blockedId", "createdAt")
      values (${ownerId}, ${blockedId}, now())
      on conflict do nothing
    `;
    await baseSql`
      insert into "user_follow_request" ("requesterId", "targetId", "status", "createdAt", "updatedAt")
      values (${requesterId}, ${ownerId}, 'pending', now(), now())
      on conflict do nothing
    `;

    // 1. Verificar contrato de segurança: getPublicProfileBundle não aceita viewerUserId do cliente
    {
      const src = fs.readFileSync(
        path.resolve(process.cwd(), "src/lib/profile.functions.ts"),
        "utf8",
      );
      const bundleFnSection = src.slice(
        src.indexOf("const publicProfileBundleSchema"),
        src.indexOf("export async function executeGetAccountProfileBundle"),
      );
      assert.ok(
        bundleFnSection.includes("publicProfileBundleSchema = z.object({\n  nick:"),
        "Schema de getPublicProfileBundle deve aceitar apenas nick",
      );
      assert.ok(
        !bundleFnSection.includes("data.viewerUserId") &&
          !bundleFnSection.includes("d?.viewerUserId"),
        "getPublicProfileBundle nunca deve ler viewerUserId enviado pelo cliente",
      );
      console.log("✓ 1. Verificado que getPublicProfileBundle ignora qualquer viewerUserId do cliente.");
    }

    // 2. Perfil público para visitante anônimo: bundle agregado + 1 única avaliação de privacidade
    {
      const { sql, queries } = createCountingSql(baseSql);
      const bundle = await executeGetPublicProfileBundle(sql, ownerNick, null);

      assert.equal(bundle.viewerUserId, null);
      assert.equal(bundle.privacy.isOwner, false);
      assert.equal(bundle.privacy.canViewAccount, true);
      assert.equal(bundle.profile.bio, "Bio secreta da Alice");
      assert.equal(bundle.profile.commentCount, 2);
      assert.equal(bundle.profile.followersCount, 1);
      assert.equal(bundle.trackingItems.length, 1);
      assert.equal(bundle.favoritesGrouped.anime.length, 1);
      assert.equal(bundle.favoritesGrouped.character.length, 1);
      assert.equal(bundle.favoritesGrouped.studio.length, 1);

      const blockQueries = queries.filter((q) => q.sql.includes('"user_block"'));
      const profileLookups = queries.filter(
        (q) => q.sql.includes('from "profile"') && q.sql.includes('"accountType"'),
      );
      assert.equal(blockQueries.length, 0, "Visitante anônimo não precisa consultar user_block");
      assert.ok(
        profileLookups.length <= 1,
        `Privacidade de profile não deve ser re-consultada (encontrado ${profileLookups.length})`,
      );
      console.log("✓ 2. Bundle público anônimo retornou dados completos sem consultas repetidas de privacidade.");
    }

    // 3. Visitante autenticado (não-seguidor) em perfil público: exatamente 1 query em user_block (reutilizada)
    {
      const { sql, queries } = createCountingSql(baseSql);
      const bundle = await executeGetPublicProfileBundle(sql, ownerNick, strangerId);

      assert.equal(bundle.viewerUserId, strangerId);
      assert.equal(bundle.trackingItems.length, 1);
      assert.equal(bundle.favoritesGrouped.anime.length, 1);

      const blockQueries = queries.filter((q) => q.sql.includes('"user_block"'));
      assert.equal(
        blockQueries.length,
        1,
        `Avaliação de bloqueio deve ocorrer apenas 1 vez por requisição (ocorreu ${blockQueries.length})`,
      );
      console.log("✓ 3. Avaliação de bloqueio/privacidade executada exatamente 1 vez na requisição agregada.");
    }

    // 4. Próprio dono acessando perfil público -> payload leve de redirecionamento para /account
    {
      const { sql, queries } = createCountingSql(baseSql);
      const bundle = await executeGetPublicProfileBundle(sql, ownerNick, ownerId);

      assert.equal(bundle.privacy.isOwner, true);
      assert.equal(bundle.profile.isOwner, true);
      assert.equal(bundle.trackingItems.length, 0, "Não deve buscar tracking público no redirect do dono");
      assert.equal(bundle.favoritesGrouped.anime.length, 0, "Não deve buscar favoritos públicos no redirect do dono");

      const skippedTables = ['"user_anime_tracking"', '"user_favorite"', '"comment"'];
      for (const tbl of skippedTables) {
        assert.equal(
          queries.some((q) => q.sql.includes(tbl)),
          false,
          `Redirect do próprio perfil não deveria consultar ${tbl}`,
        );
      }
      console.log("✓ 4. Acesso ao próprio perfil público retorna payload mínimo imediato para redirect para /account.");
    }

    // 5. Usuário bloqueado não recebe dados protegidos
    {
      const { sql, queries } = createCountingSql(baseSql);
      const bundle = await executeGetPublicProfileBundle(sql, ownerNick, blockedId);

      assert.equal(bundle.privacy.isBlocked, true);
      assert.equal(bundle.privacy.canViewLists, false);
      assert.equal(bundle.privacy.canViewFavorites, false);
      assert.equal(bundle.privacy.canViewHistory, false);
      assert.equal(bundle.privacy.canViewComments, false);
      assert.equal(bundle.privacy.canViewFollowers, false);
      assert.equal(bundle.profile.isBlocked, true);
      assert.equal(bundle.profile.bio, "");
      assert.equal(bundle.profile.bannerUrl, null);
      assert.equal(bundle.trackingItems.length, 0);
      assert.equal(bundle.favoritesGrouped.anime.length, 0);
      assert.equal(
        queries.some((q) => q.sql.includes('"user_anime_tracking"') || q.sql.includes('"user_favorite"')),
        false,
        "Não deve buscar tracking/favoritos quando visitante está bloqueado",
      );
      console.log("✓ 5. Visitante bloqueado é barrado antes de recuperar qualquer dado protegido.");
    }

    // 6. Perfil privado: anônimo e não-seguidor bloqueados; seguidor aprovado autorizado
    {
      await baseSql`
        update "profile"
        set "accountType" = 'private'
        where "userId" = ${ownerId}
      `;

      // 6a. Anônimo
      {
        const { sql, queries } = createCountingSql(baseSql);
        const bundleAnon = await executeGetPublicProfileBundle(sql, ownerNick, null);
        assert.equal(bundleAnon.privacy.canViewAccount, false);
        assert.equal(bundleAnon.profile.bio, "");
        assert.equal(bundleAnon.profile.bannerUrl, null);
        assert.equal(bundleAnon.profile.commentCount, 0);
        assert.equal(bundleAnon.profile.followersCount, 0);
        assert.equal(bundleAnon.trackingItems.length, 0);
        assert.equal(bundleAnon.favoritesGrouped.anime.length, 0);
        assert.equal(
          queries.some((q) => q.sql.includes('"user_anime_tracking"') || q.sql.includes('"user_favorite"')),
          false,
        );
      }

      // 6b. Não-seguidor autenticado
      {
        const { sql } = createCountingSql(baseSql);
        const bundleStranger = await executeGetPublicProfileBundle(sql, ownerNick, strangerId);
        assert.equal(bundleStranger.privacy.canViewAccount, false);
        assert.equal(bundleStranger.profile.isFollowing, false);
        assert.equal(bundleStranger.trackingItems.length, 0);
        assert.equal(bundleStranger.favoritesGrouped.anime.length, 0);
      }

      // 6c. Seguidor aprovado
      {
        const { sql } = createCountingSql(baseSql);
        const bundleFollower = await executeGetPublicProfileBundle(sql, ownerNick, followerId);
        assert.equal(bundleFollower.privacy.canViewAccount, true);
        assert.equal(bundleFollower.profile.isFollowing, true);
        assert.equal(bundleFollower.profile.bio, "Bio secreta da Alice");
        assert.equal(bundleFollower.trackingItems.length, 1);
        assert.equal(bundleFollower.favoritesGrouped.anime.length, 1);
      }
      console.log("✓ 6. Perfil privado bloqueia anônimo/não-seguidor e libera para seguidor aprovado.");
    }

    // 7. Privacidade granular por seção ('followers' e 'private')
    {
      await baseSql`
        update "profile"
        set
          "accountType" = 'public',
          "privacyLists" = 'private',
          "privacyFavorites" = 'followers',
          "privacyHistory" = 'followers',
          "privacyComments" = 'private',
          "privacyFollowers" = 'followers'
        where "userId" = ${ownerId}
      `;

      const bundleStranger = await executeGetPublicProfileBundle(baseSql, ownerNick, strangerId);
      assert.equal(bundleStranger.privacy.canViewAccount, true);
      assert.equal(bundleStranger.privacy.canViewLists, false, "Listas privadas bloqueadas para não-seguidor");
      assert.equal(bundleStranger.privacy.canViewHistory, false, "Histórico followers bloqueado para não-seguidor");
      assert.equal(bundleStranger.trackingItems.length, 1, "Anime Stats segue visibilidade da conta pública");
      assert.equal(bundleStranger.favoritesGrouped.anime.length, 0, "Favoritos followers bloqueados para não-seguidor");
      assert.equal(bundleStranger.profile.commentCount, 0);
      assert.equal(bundleStranger.profile.followersCount, 0);

      const bundleFollower = await executeGetPublicProfileBundle(baseSql, ownerNick, followerId);
      assert.equal(bundleFollower.privacy.canViewLists, false, "Listas 'private' bloqueadas até para seguidor");
      assert.equal(bundleFollower.privacy.canViewHistory, true, "Histórico 'followers' liberado para seguidor");
      assert.equal(bundleFollower.favoritesGrouped.anime.length, 1, "Favoritos 'followers' visíveis para seguidor");
      assert.equal(bundleFollower.profile.commentCount, 0, "Comentários 'private' ocultos para seguidor");
      assert.equal(bundleFollower.profile.followersCount, 1, "Seguidores 'followers' visíveis para seguidor");

      // Restaurar público
      await baseSql`
        update "profile"
        set
          "accountType" = 'public',
          "privacyLists" = 'public',
          "privacyFavorites" = 'public',
          "privacyHistory" = 'public',
          "privacyComments" = 'public',
          "privacyFollowers" = 'public'
        where "userId" = ${ownerId}
      `;
      console.log("✓ 7. Privacidade granular por seção preservada no loader agregado.");
    }

    // 8. Loader agregado do próprio perfil (/account): getAccountProfileBundle
    {
      const { sql, queries } = createCountingSql(baseSql);
      const accountBundle = await executeGetAccountProfileBundle(sql, ownerId);

      assert.equal(accountBundle.profile.userId, ownerId);
      assert.equal(accountBundle.profile.nick, ownerNick);
      assert.equal(accountBundle.trackingItems.length, 1);
      assert.equal(accountBundle.favoritesItems.length, 3);
      assert.equal(accountBundle.favoritesGrouped.anime.length, 1);
      assert.equal(accountBundle.requestsCount, 1, "Deve retornar apenas a contagem de solicitações (1)");

      const reqQueries = queries.filter((q) => q.sql.includes('"user_follow_request"'));
      assert.equal(reqQueries.length, 1);
      assert.ok(
        reqQueries[0].sql.toLowerCase().includes("count(*)"),
        "Consulta de solicitações na abertura do /account deve ser apenas count(*)",
      );
      assert.ok(
        !reqQueries[0].sql.includes('"avatarUrl"') && !reqQueries[0].sql.includes('"displayName"'),
        "Não deve carregar lista completa de perfis solicitantes no bundle inicial",
      );
      console.log("✓ 8. Bundle do próprio perfil (/account) reúne dados essenciais e apenas count(*) de solicitações.");
    }

    // 9. Carregamento progressivo de atividades (preview=true vs full) e comentários
    {
      const { sql: sqlPreview, queries: qPreview } = createCountingSql(baseSql);
      const previewRes = await executeGetUserActivities(sqlPreview, ownerId, true, 1, 6, {
        preview: true,
      });
      assert.equal(previewRes.items.length, 6, "Preview da Visão Geral deve retornar até 6 itens");
      assert.equal(previewRes.hasMore, true, "Com 6 itens no preview, hasMore deve ser true");
      assert.equal(previewRes.total, 6, "Preview pula countQuery pesado e mantém total igual ao tamanho do lote");
      assert.equal(qPreview.length, 1, "Preview deve executar exatamente 1 query (sem countQuery)");

      const { sql: sqlFullPage6, queries: qFullPage6 } = createCountingSql(baseSql);
      const fullPage6 = await executeGetUserActivities(sqlFullPage6, ownerId, true, 1, 6, {
        preview: false,
      });
      assert.equal(fullPage6.items.length, 6);
      assert.equal(fullPage6.total, 11);
      assert.equal(fullPage6.hasMore, true);
      assert.equal(qFullPage6.length, 2, "Listagem completa paginada executa select + countQuery quando lota a página");

      const { sql: sqlFull } = createCountingSql(baseSql);
      const fullRes = await executeGetUserActivities(sqlFull, ownerId, true, 1, 15, {
        preview: false,
      });
      assert.equal(fullRes.items.length, 11, "Modo completo deve retornar todas as 11 atividades (7 ep + 1 tracking + 3 fav)");
      assert.equal(fullRes.total, 11);
      assert.equal(fullRes.hasMore, false);

      // Verificar ordem cronológica DESC
      for (let i = 0; i < fullRes.items.length - 1; i++) {
        assert.ok(
          new Date(fullRes.items[i].createdAt).getTime() >=
            new Date(fullRes.items[i + 1].createdAt).getTime(),
          "Atividades devem manter ordem cronológica decrescente",
        );
      }

      const commentsRes = await executeGetComments(baseSql, ownerId, followerId, true, 1, 15);
      assert.equal(commentsRes.items.length, 2);
      assert.equal(commentsRes.total, 2);
      console.log("✓ 9. Atividades (preview otimizado + paginação completa) e comentários validados.");
    }

    // 10. Cache em memória no cliente: isolamento por visitante, TTL, deduplicação e invalidação
    {
      // Simular window mínimo para testar módulo client-side em Node
      const hadWindow = typeof (globalThis as { window?: unknown }).window !== "undefined";
      if (!hadWindow) {
        (globalThis as { window: unknown }).window = globalThis;
      }

      try {
        invalidateAllProfileCaches();
        const samplePriv = await evaluateUserPrivacy(baseSql, ownerId, followerId);
        const samplePublicBundle = await executeGetPublicProfileBundle(baseSql, ownerNick, followerId);
        const sampleAccountBundle = await executeGetAccountProfileBundle(baseSql, ownerId);

        assert.equal(samplePriv.canViewAccount, true);
        setCachedPublicProfileBundle(followerId, ownerNick, samplePublicBundle);

        // Isolamento por viewer
        assert.ok(getCachedPublicProfileBundle(followerId, ownerNick) !== null);
        assert.equal(
          getCachedPublicProfileBundle(strangerId, ownerNick),
          null,
          "Cache público deve ser estritamente isolado por viewerUserId",
        );
        assert.equal(
          getCachedPublicProfileBundle(null, ownerNick),
          null,
          "Cache público autenticado não deve vazar para anônimo",
        );

        // Invalidação por userId
        invalidatePublicProfileCacheByUserId(ownerId);
        assert.equal(getCachedPublicProfileBundle(followerId, ownerNick), null);

        // Invalidação por nick
        setCachedPublicProfileBundle(followerId, ownerNick, samplePublicBundle);
        invalidatePublicProfileCache(ownerNick);
        assert.equal(getCachedPublicProfileBundle(followerId, ownerNick), null);

        // Cache de conta + isolamento ao trocar viewer
        setCachedAccountProfileBundle(sampleAccountBundle);
        assert.ok(getCachedAccountProfileBundle(ownerId) !== null);
        setKnownViewerId(followerId);
        assert.equal(
          getCachedAccountProfileBundle(ownerId),
          null,
          "Troca de viewer deve limpar cache da conta anterior",
        );

        setCachedAccountProfileBundle(sampleAccountBundle);
        invalidateAccountProfileCache(ownerId);
        assert.equal(getCachedAccountProfileBundle(ownerId), null);

        // Deduplicação de metadados do header
        let fetchCount = 0;
        const fetcher = async () => {
          fetchCount += 1;
          await new Promise((r) => setTimeout(r, 20));
          return { image: "https://example.com/a.jpg", nick: ownerNick };
        };
        const [m1, m2] = await Promise.all([
          fetchProfileMetaOnce(ownerId, fetcher),
          fetchProfileMetaOnce(ownerId, fetcher),
        ]);
        assert.equal(fetchCount, 1, "Chamadas concorrentes de meta do header devem ser deduplicadas");
        assert.equal(m1?.nick, ownerNick);
        assert.equal(m2?.nick, ownerNick);

        // TTL constante (2 min)
        assert.equal(PROFILE_CACHE_TTL_MS, 120000);
        invalidateAllProfileCaches();
      } finally {
        if (!hadWindow) {
          delete (globalThis as { window?: unknown }).window;
        }
      }
      console.log("✓ 10. Cache em memória validado (isolamento de sessão, deduplicação e invalidação).");
    }

    console.log("\n=== TODOS OS TESTES SERVER-SIDE DA ETAPA 4 PASSARAM COM SUCESSO! ===");
  } finally {
    // Limpeza completa
    await baseSql`delete from "comment" where "userId" = ${ownerId}`;
    await baseSql`delete from "user_watched_episode" where "userId" = ${ownerId}`;
    await baseSql`delete from "user_favorite" where "userId" = ${ownerId}`;
    await baseSql`delete from "user_anime_tracking" where "userId" = ${ownerId}`;
    await baseSql`delete from "user_follow" where "followerId" = ${followerId} or "followingId" = ${ownerId}`;
    await baseSql`delete from "user_block" where "blockerId" = ${ownerId}`;
    await baseSql`delete from "user_follow_request" where "targetId" = ${ownerId}`;
    await baseSql`delete from "profile" where "userId" in (${ownerId}, ${followerId}, ${strangerId}, ${blockedId}, ${requesterId})`;
    await baseSql`delete from "user" where "id" in (${ownerId}, ${followerId}, ${strangerId}, ${blockedId}, ${requesterId})`;
    await baseSql`delete from "catalog_anime" where "id" = ${animeId}`;
    await baseSql`delete from "catalog_character" where "id" = ${`char-e4-${ts}`}`;
    await baseSql`delete from "catalog_studio" where "id" = ${`studio-e4-${ts}`}`;
  }
}

runEtapa4ServerTests().catch((err) => {
  console.error("ERRO NOS TESTES DA ETAPA 4:", err);
  process.exit(1);
});
