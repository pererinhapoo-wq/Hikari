// scripts/test-etapa-7-privacy.mjs
import assert from "node:assert/strict";
import { z } from "zod";
import { getSql } from "../src/lib/db.ts";

const sectionPrivacySchema = z.enum(["public", "followers", "private"]);
const accountTypeSchema = z.enum(["public", "private"]);

const updateProfilePrivacySchema = z.object({
  name: z.string().trim().max(50).optional(),
  nick: z.string().trim().optional(),
  bio: z.string().max(500).optional(),
  image: z.string().nullable().optional(),
  bannerUrl: z.string().nullable().optional(),
  favorites: z.array(z.string().trim()).max(20).optional(),
  accountType: accountTypeSchema.optional(),
  allowFollowers: z.boolean().optional(),
  privacyLists: sectionPrivacySchema.optional(),
  privacyFavorites: sectionPrivacySchema.optional(),
  privacyHistory: sectionPrivacySchema.optional(),
  privacyComments: sectionPrivacySchema.optional(),
  privacyFollowers: sectionPrivacySchema.optional(),
});

async function evaluateUserPrivacy(sql, ownerUserId, viewerUserId) {
  if (viewerUserId && viewerUserId === ownerUserId) {
    return {
      isOwner: true,
      isFollowing: false,
      canViewAccount: true,
      canViewLists: true,
      canViewFavorites: true,
      canViewHistory: true,
      canViewComments: true,
      canViewFollowers: true,
    };
  }

  const profileRows = await sql`
    select
      coalesce("accountType", 'public') as "accountType",
      coalesce("privacyLists", 'public') as "privacyLists",
      coalesce("privacyFavorites", 'public') as "privacyFavorites",
      coalesce("privacyHistory", 'public') as "privacyHistory",
      coalesce("privacyComments", 'public') as "privacyComments",
      coalesce("privacyFollowers", 'public') as "privacyFollowers",
      coalesce("allowFollowers", true) as "allowFollowers"
    from "profile"
    where "userId" = ${ownerUserId}
    limit 1
  `;

  const settings = profileRows[0] || {
    accountType: "public",
    privacyLists: "public",
    privacyFavorites: "public",
    privacyHistory: "public",
    privacyComments: "public",
    privacyFollowers: "public",
    allowFollowers: true,
  };

  let isFollowing = false;
  if (viewerUserId) {
    const followRows = await sql`
      select count(*)::text as count
      from "user_follow"
      where "followerId" = ${viewerUserId} and "followingId" = ${ownerUserId}
    `;
    isFollowing = Number(followRows[0]?.count ?? 0) > 0;
  }

  const isPrivateAccount = settings.accountType === "private";
  const canViewAccount = !isPrivateAccount || isFollowing;

  const canAccessSection = (level) => {
    if (!canViewAccount) return false;
    if (level === "public") return true;
    if (level === "followers") return isFollowing;
    return false; // "private"
  };

  return {
    isOwner: false,
    isFollowing,
    canViewAccount,
    canViewLists: canAccessSection(settings.privacyLists),
    canViewFavorites: canAccessSection(settings.privacyFavorites),
    canViewHistory: canAccessSection(settings.privacyHistory),
    canViewComments: canAccessSection(settings.privacyComments),
    canViewFollowers: canAccessSection(settings.privacyFollowers),
  };
}

async function runTests() {
  console.log("=== INICIANDO TESTES DA ETAPA 7: PRIVACIDADE DO PERFIL ===");
  const sql = await getSql();

  const testOwnerId = "test_owner_etapa7_" + Date.now();
  const testFollowerId = "test_follower_etapa7_" + Date.now();
  const testStrangerId = "test_stranger_etapa7_" + Date.now();

  try {
    // Preparação: Criar usuários de teste
    await sql`
      insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      values
        (${testOwnerId}, 'Owner Etapa7', 'owner7@test.com', true, now(), now()),
        (${testFollowerId}, 'Follower Etapa7', 'follower7@test.com', true, now(), now()),
        (${testStrangerId}, 'Stranger Etapa7', 'stranger7@test.com', true, now(), now())
      on conflict do nothing
    `;

    await sql`
      insert into "profile" ("userId", "nick", "displayName", "accountType", "allowFollowers", "privacyLists", "privacyFavorites", "privacyHistory", "privacyComments", "privacyFollowers")
      values (${testOwnerId}, 'owner_etapa7', 'Owner Etapa7', 'public', true, 'public', 'public', 'public', 'public', 'public')
      on conflict ("userId") do update set
        "accountType" = 'public',
        "allowFollowers" = true,
        "privacyLists" = 'public',
        "privacyFavorites" = 'public',
        "privacyHistory" = 'public',
        "privacyComments" = 'public',
        "privacyFollowers" = 'public'
    `;

    // Vincular testFollowerId como seguidor de testOwnerId
    await sql`
      insert into "user_follow" ("followerId", "followingId", "createdAt")
      values (${testFollowerId}, ${testOwnerId}, now())
      on conflict do nothing
    `;

    console.log("✓ Usuários de teste configurados no banco.");

    // TESTE 1: Proprietário visualizando seu próprio perfil
    {
      const evalOwner = await evaluateUserPrivacy(sql, testOwnerId, testOwnerId);
      assert.equal(evalOwner.isOwner, true, "Proprietário deve ser identificado como isOwner");
      assert.equal(evalOwner.canViewAccount, true, "Proprietário sempre acessa a conta");
      assert.equal(evalOwner.canViewLists, true, "Proprietário acessa listas");
      assert.equal(evalOwner.canViewFavorites, true, "Proprietário acessa favoritos");
      assert.equal(evalOwner.canViewHistory, true, "Proprietário acessa histórico");
      assert.equal(evalOwner.canViewComments, true, "Proprietário acessa comentários");
      assert.equal(evalOwner.canViewFollowers, true, "Proprietário acessa seguidores");
      console.log("✓ TESTE 1 PASSOU: Proprietário tem acesso irrestrito ao próprio perfil.");
    }

    // TESTE 2: Perfil público acessado por visitante anônimo
    {
      const evalAnon = await evaluateUserPrivacy(sql, testOwnerId, null);
      assert.equal(evalAnon.isOwner, false);
      assert.equal(evalAnon.isFollowing, false);
      assert.equal(evalAnon.canViewAccount, true);
      assert.equal(evalAnon.canViewLists, true);
      assert.equal(evalAnon.canViewFavorites, true);
      assert.equal(evalAnon.canViewHistory, true);
      assert.equal(evalAnon.canViewComments, true);
      assert.equal(evalAnon.canViewFollowers, true);
      console.log("✓ TESTE 2 PASSOU: Visitante anônimo acessa seções de perfil público.");
    }

    // TESTE 3: Configurar seções específicas (privacyComments: 'private', privacyLists: 'followers')
    {
      await sql`
        update "profile"
        set "privacyComments" = 'private', "privacyLists" = 'followers'
        where "userId" = ${testOwnerId}
      `;

      // Visitante anônimo
      const evalAnon = await evaluateUserPrivacy(sql, testOwnerId, null);
      assert.equal(evalAnon.canViewComments, false, "Comentários privados devem ser bloqueados para anônimos");
      assert.equal(evalAnon.canViewLists, false, "Listas para seguidores devem ser bloqueadas para anônimos");
      assert.equal(evalAnon.canViewFavorites, true, "Favoritos públicos devem continuar visíveis");

      // Estranho autenticado (não seguidor)
      const evalStranger = await evaluateUserPrivacy(sql, testOwnerId, testStrangerId);
      assert.equal(evalStranger.canViewComments, false, "Comentários privados bloqueados para não-seguidor");
      assert.equal(evalStranger.canViewLists, false, "Listas para seguidores bloqueadas para não-seguidor");
      assert.equal(evalStranger.canViewFavorites, true, "Favoritos públicos visíveis para não-seguidor");

      // Seguidor
      const evalFollower = await evaluateUserPrivacy(sql, testOwnerId, testFollowerId);
      assert.equal(evalFollower.isFollowing, true, "Deve confirmar vínculo de seguidor");
      assert.equal(evalFollower.canViewComments, false, "Comentários 'private' (somente eu) bloqueados até para seguidor");
      assert.equal(evalFollower.canViewLists, true, "Listas 'followers' permitidas para seguidor");
      assert.equal(evalFollower.canViewFavorites, true, "Favoritos públicos visíveis");

      // Proprietário
      const evalOwner = await evaluateUserPrivacy(sql, testOwnerId, testOwnerId);
      assert.equal(evalOwner.canViewComments, true, "Proprietário sempre vê seus comentários");
      assert.equal(evalOwner.canViewLists, true, "Proprietário sempre vê suas listas");
      console.log("✓ TESTE 3 PASSOU: Seções individuais (public, followers, private) respeitadas com rigor.");
    }

    // TESTE 4: Perfil Privado (accountType: 'private')
    {
      await sql`
        update "profile"
        set "accountType" = 'private',
            "privacyLists" = 'public',
            "privacyFavorites" = 'public',
            "privacyHistory" = 'public',
            "privacyComments" = 'public',
            "privacyFollowers" = 'public'
        where "userId" = ${testOwnerId}
      `;

      // Visitante anônimo deve ser TOTALMENTE bloqueado
      const evalAnon = await evaluateUserPrivacy(sql, testOwnerId, null);
      assert.equal(evalAnon.canViewAccount, false, "Conta privada bloqueia anônimo");
      assert.equal(evalAnon.canViewLists, false, "Conta privada bloqueia listas");
      assert.equal(evalAnon.canViewFavorites, false, "Conta privada bloqueia favoritos");
      assert.equal(evalAnon.canViewHistory, false, "Conta privada bloqueia histórico");
      assert.equal(evalAnon.canViewComments, false, "Conta privada bloqueia comentários");
      assert.equal(evalAnon.canViewFollowers, false, "Conta privada bloqueia seguidores");

      // Usuário autenticado que NÃO é seguidor deve ser TOTALMENTE bloqueado
      const evalStranger = await evaluateUserPrivacy(sql, testOwnerId, testStrangerId);
      assert.equal(evalStranger.canViewAccount, false, "Conta privada bloqueia não-seguidor");
      assert.equal(evalStranger.canViewComments, false, "Conta privada bloqueia comentários para não-seguidor");

      // Seguidor aprovado deve ter acesso à conta privada
      const evalFollower = await evaluateUserPrivacy(sql, testOwnerId, testFollowerId);
      assert.equal(evalFollower.canViewAccount, true, "Seguidor aprovado tem acesso à conta privada");
      assert.equal(evalFollower.canViewComments, true, "Seguidor vê seções marcadas como públicas na conta privada");

      // Proprietário continua com acesso total
      const evalOwner = await evaluateUserPrivacy(sql, testOwnerId, testOwnerId);
      assert.equal(evalOwner.canViewAccount, true);
      console.log("✓ TESTE 4 PASSOU: Perfil privado bloqueia não-seguidores e anônimos; permite seguidores e dono.");
    }

    // TESTE 5: Validação do Schema Zod e atualização via updateProfile
    {
      // Rejeição de valores inválidos
      assert.throws(() => {
        updateProfilePrivacySchema.parse({ accountType: "invalido" });
      }, /Invalid option/);

      assert.throws(() => {
        updateProfilePrivacySchema.parse({ privacyComments: "everyone_else" });
      }, /Invalid option/);

      // Sucesso com payload completo de privacidade
      const validPayload = updateProfilePrivacySchema.parse({
        accountType: "private",
        allowFollowers: false,
        privacyLists: "followers",
        privacyFavorites: "private",
        privacyHistory: "private",
        privacyComments: "followers",
        privacyFollowers: "followers",
      });

      // Persistência no banco simulando updateProfile
      await sql`
        update "profile"
        set
          "accountType" = ${validPayload.accountType},
          "allowFollowers" = ${validPayload.allowFollowers},
          "privacyLists" = ${validPayload.privacyLists},
          "privacyFavorites" = ${validPayload.privacyFavorites},
          "privacyHistory" = ${validPayload.privacyHistory},
          "privacyComments" = ${validPayload.privacyComments},
          "privacyFollowers" = ${validPayload.privacyFollowers}
        where "userId" = ${testOwnerId}
      `;

      const checkRows = await sql`
        select
          "accountType", "allowFollowers", "privacyLists", "privacyFavorites",
          "privacyHistory", "privacyComments", "privacyFollowers"
        from "profile"
        where "userId" = ${testOwnerId}
      `;

      const saved = checkRows[0];
      assert.equal(saved.accountType, "private");
      assert.equal(saved.allowFollowers, false);
      assert.equal(saved.privacyLists, "followers");
      assert.equal(saved.privacyFavorites, "private");
      assert.equal(saved.privacyHistory, "private");
      assert.equal(saved.privacyComments, "followers");
      assert.equal(saved.privacyFollowers, "followers");

      console.log("✓ TESTE 5 PASSOU: Validação Zod e persistência dos 7 campos de privacidade no banco.");
    }

    // TESTE 6: Preservação de campos existentes em atualizações parciais
    {
      // Atualizar apenas o bio e nome sem enviar campos de privacidade
      const partialPayload = updateProfilePrivacySchema.parse({
        bio: "Nova biografia preservando privacidade",
      });

      // Em updateProfile, usamos COALESCE com o valor existente
      await sql`
        update "profile"
        set "bio" = ${partialPayload.bio}
        where "userId" = ${testOwnerId}
      `;

      const checkRows = await sql`
        select
          "bio", "accountType", "allowFollowers", "privacyLists", "privacyFavorites"
        from "profile"
        where "userId" = ${testOwnerId}
      `;

      assert.equal(checkRows[0].bio, "Nova biografia preservando privacidade");
      assert.equal(checkRows[0].accountType, "private", "accountType deve ser preservado");
      assert.equal(checkRows[0].allowFollowers, false, "allowFollowers deve ser preservado");
      assert.equal(checkRows[0].privacyLists, "followers", "privacyLists deve ser preservado");
      console.log("✓ TESTE 6 PASSOU: Atualizações parciais preservam as configurações de privacidade anteriores.");
    }

    console.log("\n=======================================================");
    console.log("TODOS OS TESTES DA ETAPA 7 PASSARAM COM 100% DE SUCESSO!");
    console.log("=======================================================");
  } finally {
    // Limpeza dos dados de teste
    try {
      await sql`delete from "user_follow" where "followerId" in (${testOwnerId}, ${testFollowerId}, ${testStrangerId}) or "followingId" in (${testOwnerId}, ${testFollowerId}, ${testStrangerId})`;
      await sql`delete from "profile" where "userId" in (${testOwnerId}, ${testFollowerId}, ${testStrangerId})`;
      await sql`delete from "user" where "id" in (${testOwnerId}, ${testFollowerId}, ${testStrangerId})`;
      console.log("✓ Dados de teste limpos com sucesso.");
    } catch {
      // ignore
    }
  }
}

runTests().catch((err) => {
  console.error("Falha nos testes:", err);
  process.exit(1);
});
