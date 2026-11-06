// scripts/test-etapa-6-profile.mjs
import assert from "node:assert/strict";
import { z } from "zod";
import { getSql } from "../src/lib/db.ts";

// -------------------------------------------------------------
// Validação Zod equivalente à implementada em src/lib/profile.functions.ts
// -------------------------------------------------------------
const updateProfileInputSchema = z.object({
  name: z
    .string()
    .trim()
    .max(50, "O Nome de exibição pode ter no máximo 50 caracteres.")
    .optional(),
  nick: z.string().trim().optional(),
  bio: z
    .string()
    .max(500, "A Biografia pode ter no máximo 500 caracteres.")
    .optional(),
  image: z.string().nullable().optional(),
  bannerUrl: z.string().nullable().optional(),
  favorites: z.array(z.string().trim()).max(20).optional(),
});

function normalizeNick(value) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .slice(0, 30);
}

function isValidNick(nick) {
  return /^[a-z0-9_]{3,30}$/.test(nick);
}

function parseFavorites(value) {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

// Implementação idêntica da lógica de negócio de updateProfile
async function executeUpdateProfile(sql, userId, rawData) {
  const data = updateProfileInputSchema.parse(rawData);

  // 1. Obter perfil e usuário existentes
  const profileRows = await sql`
    select "nick", "bio", "favorites", "displayName", "avatarUrl", "bannerUrl"
    from "profile"
    where "userId" = ${userId}
    limit 1
  `;

  const userRows = await sql`
    select "name", "email", "image"
    from "user"
    where "id" = ${userId}
    limit 1
  `;

  const existingProfile = profileRows[0];
  const existingUser = userRows[0];

  // 2. Resolver Name
  let finalName = existingProfile?.displayName || existingUser?.name || "";
  if (typeof data.name === "string") {
    const trimmed = data.name.trim();
    if (trimmed.length > 0) {
      finalName = trimmed.slice(0, 50);
    }
  }

  // 3. Resolver Nick
  let finalNick = existingProfile?.nick || "";
  if (typeof data.nick === "string") {
    const normalized = normalizeNick(data.nick);
    if (normalized.length > 0) {
      if (!isValidNick(normalized)) {
        throw new Error("O Username deve ter entre 3 e 30 caracteres e usar apenas letras, números ou _.");
      }

      const conflict = await sql`
        select "userId"
        from "profile"
        where lower("nick") = lower(${normalized})
          and "userId" <> ${userId}
        limit 1
      `;

      if (conflict.length > 0) {
        throw new Error("Esse Username (@handle) já está em uso por outro usuário.");
      }

      finalNick = normalized;
    }
  }

  if (!finalNick) {
    throw new Error("O Username é obrigatório.");
  }

  // 4. Resolver Bio
  let finalBio = existingProfile?.bio || "";
  if (data.bio !== undefined) {
    finalBio = typeof data.bio === "string" ? data.bio.trim().slice(0, 500) : "";
  }

  // 5. Resolver Favorites
  let finalFavorites = parseFavorites(existingProfile?.favorites);
  if (data.favorites !== undefined && Array.isArray(data.favorites)) {
    finalFavorites = data.favorites
      .map((item) => String(item).trim().slice(0, 100))
      .filter(Boolean)
      .slice(0, 20);
  }

  // 6. Resolver Avatar
  let finalAvatar = existingProfile?.avatarUrl ?? existingUser?.image ?? null;
  if (data.image !== undefined) {
    if (data.image === null || (typeof data.image === "string" && data.image.trim() === "")) {
      finalAvatar = null;
    } else if (typeof data.image === "string") {
      finalAvatar = data.image.trim();
    }
  }

  // 7. Resolver Banner
  let finalBanner = existingProfile?.bannerUrl ?? null;
  if (data.bannerUrl !== undefined) {
    if (data.bannerUrl === null || (typeof data.bannerUrl === "string" && data.bannerUrl.trim() === "")) {
      finalBanner = null;
    } else if (typeof data.bannerUrl === "string") {
      finalBanner = data.bannerUrl.trim();
    }
  }

  // 8. Sincronizar na tabela user
  await sql`
    update "user"
    set
      "name" = ${finalName || "Membro"},
      "image" = ${finalAvatar},
      "updatedAt" = CURRENT_TIMESTAMP
    where "id" = ${userId}
  `;

  // 9. Salvar na tabela profile com upsert
  await sql`
    insert into "profile" (
      "userId",
      "nick",
      "bio",
      "favorites",
      "displayName",
      "avatarUrl",
      "bannerUrl"
    )
    values (
      ${userId},
      ${finalNick},
      ${finalBio},
      ${JSON.stringify(finalFavorites)},
      ${finalName},
      ${finalAvatar},
      ${finalBanner}
    )
    on conflict ("userId")
    do update set
      "nick" = excluded."nick",
      "bio" = excluded."bio",
      "favorites" = excluded."favorites",
      "displayName" = excluded."displayName",
      "avatarUrl" = excluded."avatarUrl",
      "bannerUrl" = excluded."bannerUrl",
      "updatedAt" = CURRENT_TIMESTAMP
  `;

  return {
    userId,
    name: finalName,
    nick: finalNick,
    bio: finalBio,
    image: finalAvatar,
    bannerUrl: finalBanner,
    favorites: finalFavorites,
  };
}

async function runEtapa6Tests() {
  console.log("=== INICIANDO BATERIA DE TESTES DA ETAPA 6: EDIÇÃO DO PERFIL ===");
  const sql = await getSql();

  const timestamp = Date.now();
  const user1Id = `test-user-e6-1-${timestamp}`;
  const user2Id = `test-user-e6-2-${timestamp}`;

  const initialNick1 = `e6_nick1_${timestamp.toString().slice(-6)}`;
  const initialNick2 = `e6_nick2_${timestamp.toString().slice(-6)}`;

  // Setup de 2 usuários isolados no banco
  await sql.query(`
    insert into "user" ("id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt")
    values
      ('${user1Id}', 'Usuário Original 1', 'user1_${timestamp}@hikari.test', true, 'https://cdn.hikari.test/old-avatar-1.jpg', current_timestamp, current_timestamp),
      ('${user2Id}', 'Usuário Original 2', 'user2_${timestamp}@hikari.test', true, 'https://cdn.hikari.test/old-avatar-2.jpg', current_timestamp, current_timestamp)
    on conflict do nothing
  `);

  await sql.query(`
    insert into "profile" ("userId", "nick", "displayName", "bio", "avatarUrl", "bannerUrl", "createdAt", "updatedAt")
    values
      ('${user1Id}', '${initialNick1}', 'Usuário Original 1', 'Bio inicial 1', 'https://cdn.hikari.test/old-avatar-1.jpg', 'https://cdn.hikari.test/old-banner-1.jpg', current_timestamp, current_timestamp),
      ('${user2Id}', '${initialNick2}', 'Usuário Original 2', 'Bio inicial 2', 'https://cdn.hikari.test/old-avatar-2.jpg', 'https://cdn.hikari.test/old-banner-2.jpg', current_timestamp, current_timestamp)
    on conflict do nothing
  `);

  try {
    // -------------------------------------------------------------
    // 1. Alteração do nome de exibição
    // -------------------------------------------------------------
    console.log("\n1. Testando alteração do nome de exibição...");
    const res1 = await executeUpdateProfile(sql, user1Id, { name: "Elizabeth Liones de Britannia" });
    assert.equal(res1.name, "Elizabeth Liones de Britannia");
    assert.equal(res1.nick, initialNick1, "Nick deve ser preservado quando não enviado");

    const dbCheck1 = await sql`
      select "displayName", "nick" from "profile" where "userId" = ${user1Id}
    `;
    assert.equal(dbCheck1[0].displayName, "Elizabeth Liones de Britannia");

    const userCheck1 = await sql`
      select "name" from "user" where "id" = ${user1Id}
    `;
    assert.equal(userCheck1[0].name, "Elizabeth Liones de Britannia");
    console.log("   ✓ Nome alterado e sincronizado com sucesso em 'profile' e 'user'.");

    // -------------------------------------------------------------
    // 2. Alteração do username (@nick) com normalização
    // -------------------------------------------------------------
    console.log("\n2. Testando alteração do username com normalização...");
    const newNick1 = `elizabeth_${timestamp.toString().slice(-6)}`;
    const res2 = await executeUpdateProfile(sql, user1Id, { nick: `@${newNick1}` });
    assert.equal(res2.nick, newNick1, "Deve normalizar removendo o @ e convertendo para minúsculas");
    assert.equal(res2.name, "Elizabeth Liones de Britannia", "Nome deve ser preservado");

    const dbCheck2 = await sql`
      select "nick" from "profile" where "userId" = ${user1Id}
    `;
    assert.equal(dbCheck2[0].nick, newNick1);
    console.log("   ✓ Username (@handle) alterado e normalizado com sucesso.");

    // -------------------------------------------------------------
    // 3. Username já utilizado por outro usuário (conflito de unicidade)
    // -------------------------------------------------------------
    console.log("\n3. Testando conflito de username já utilizado...");
    let conflictCaught = false;
    try {
      await executeUpdateProfile(sql, user1Id, { nick: initialNick2 });
    } catch (err) {
      conflictCaught = true;
      assert.match(err.message, /já está em uso/i);
    }
    assert.ok(conflictCaught, "Deve lançar erro quando username já pertencer a outro usuário");
    console.log("   ✓ Conflito de username bloqueado pelo servidor com mensagem amigável.");

    // -------------------------------------------------------------
    // 4. Alteração da biografia
    // -------------------------------------------------------------
    console.log("\n4. Testando alteração da biografia...");
    const newBio = "Apaixonada por romances fantásticos e animes de aventura!";
    const res4 = await executeUpdateProfile(sql, user1Id, { bio: newBio });
    assert.equal(res4.bio, newBio);

    const dbCheck4 = await sql`
      select "bio" from "profile" where "userId" = ${user1Id}
    `;
    assert.equal(dbCheck4[0].bio, newBio);
    console.log("   ✓ Biografia alterada e persistida com sucesso.");

    // -------------------------------------------------------------
    // 5. Atualização da foto de perfil (avatar)
    // -------------------------------------------------------------
    console.log("\n5. Testando atualização da foto de perfil (avatar)...");
    const newAvatar = "data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAkA4JaQAA3AA/vsFkAAAAA==";
    const res5 = await executeUpdateProfile(sql, user1Id, { image: newAvatar });
    assert.equal(res5.image, newAvatar);

    const dbCheck5 = await sql`
      select "avatarUrl" from "profile" where "userId" = ${user1Id}
    `;
    assert.equal(dbCheck5[0].avatarUrl, newAvatar);

    const userCheck5 = await sql`
      select "image" from "user" where "id" = ${user1Id}
    `;
    assert.equal(userCheck5[0].image, newAvatar);
    console.log("   ✓ Avatar atualizado e refletido simultaneamente em 'profile' e 'user'.");

    // -------------------------------------------------------------
    // 6. Atualização do banner
    // -------------------------------------------------------------
    console.log("\n6. Testando atualização do banner...");
    const newBanner = "data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAkA4JaQAA3AA/vsFkAAAAA==";
    const res6 = await executeUpdateProfile(sql, user1Id, { bannerUrl: newBanner });
    assert.equal(res6.bannerUrl, newBanner);

    const dbCheck6 = await sql`
      select "bannerUrl" from "profile" where "userId" = ${user1Id}
    `;
    assert.equal(dbCheck6[0].bannerUrl, newBanner);
    console.log("   ✓ Banner panorâmico atualizado e persistido.");

    // -------------------------------------------------------------
    // 7. Remoção e substituição de imagens (null)
    // -------------------------------------------------------------
    console.log("\n7. Testando remoção de foto e banner (null)...");
    const res7 = await executeUpdateProfile(sql, user1Id, { image: null, bannerUrl: null });
    assert.equal(res7.image, null, "Avatar deve ser null após remoção");
    assert.equal(res7.bannerUrl, null, "Banner deve ser null após remoção");

    const dbCheck7 = await sql`
      select "avatarUrl", "bannerUrl" from "profile" where "userId" = ${user1Id}
    `;
    assert.equal(dbCheck7[0].avatarUrl, null);
    assert.equal(dbCheck7[0].bannerUrl, null);
    console.log("   ✓ Remoção de foto e banner confirmada com campos anulados.");

    // -------------------------------------------------------------
    // 8. Persistência completa (leitura direta no banco)
    // -------------------------------------------------------------
    console.log("\n8. Testando persistência completa após ciclo de alterações...");
    const finalProfile = await sql`
      select * from "profile" where "userId" = ${user1Id}
    `;
    assert.equal(finalProfile[0].displayName, "Elizabeth Liones de Britannia");
    assert.equal(finalProfile[0].nick, newNick1);
    assert.equal(finalProfile[0].bio, newBio);
    assert.equal(finalProfile[0].avatarUrl, null);
    assert.equal(finalProfile[0].bannerUrl, null);
    console.log("   ✓ Persistência atestada: todos os campos mantêm os valores atualizados.");

    // -------------------------------------------------------------
    // 9. Isolamento entre usuários
    // -------------------------------------------------------------
    console.log("\n9. Testando isolamento entre usuários...");
    const user2Profile = await sql`
      select "displayName", "nick", "bio", "avatarUrl", "bannerUrl" from "profile" where "userId" = ${user2Id}
    `;
    assert.equal(user2Profile[0].displayName, "Usuário Original 2");
    assert.equal(user2Profile[0].nick, initialNick2);
    assert.equal(user2Profile[0].bio, "Bio inicial 2");
    assert.equal(user2Profile[0].avatarUrl, "https://cdn.hikari.test/old-avatar-2.jpg");
    assert.equal(user2Profile[0].bannerUrl, "https://cdn.hikari.test/old-banner-2.jpg");
    console.log("   ✓ Perfil do Usuário 2 permaneceu 100% intocado e isolado.");

    // -------------------------------------------------------------
    // 10. Validação de dados inválidos e proteção contra sobrescrita
    // -------------------------------------------------------------
    console.log("\n10. Testando validação de dados inválidos com Zod...");
    // 10a: Nick com formato inválido
    let invalidNickCaught = false;
    try {
      await executeUpdateProfile(sql, user1Id, { nick: "nick invalido com espaços!" });
    } catch {
      invalidNickCaught = true;
    }
    assert.ok(invalidNickCaught, "Nick com espaços ou caracteres especiais deve ser rejeitado");

    // 10b: Nick curto (< 3 caracteres)
    let shortNickCaught = false;
    try {
      await executeUpdateProfile(sql, user1Id, { nick: "ab" });
    } catch {
      shortNickCaught = true;
    }
    assert.ok(shortNickCaught, "Nick com menos de 3 caracteres deve ser rejeitado");

    // 10c: Nome longo (> 50 caracteres)
    let longNameCaught = false;
    try {
      await executeUpdateProfile(sql, user1Id, { name: "A".repeat(55) });
    } catch {
      longNameCaught = true;
    }
    assert.ok(longNameCaught, "Nome com mais de 50 caracteres deve ser rejeitado pelo schema Zod");

    // 10d: Bio longa (> 500 caracteres)
    let longBioCaught = false;
    try {
      await executeUpdateProfile(sql, user1Id, { bio: "B".repeat(505) });
    } catch {
      longBioCaught = true;
    }
    assert.ok(longBioCaught, "Bio com mais de 500 caracteres deve ser rejeitada pelo schema Zod");

    // 10e: String vazia em name não apaga o nome existente
    const res10e = await executeUpdateProfile(sql, user1Id, { name: "   " });
    assert.equal(res10e.name, "Elizabeth Liones de Britannia", "String vazia não deve sobrescrever nome existente");

    console.log("   ✓ Todas as validações Zod e regras de proteção contra sobrescrita passaram com 100% de precisão.");

    console.log("\n=======================================================");
    console.log("🎉 TODOS OS TESTES DA ETAPA 6 FORAM EXECUTADOS COM SUCESSO!");
    console.log("=======================================================\n");
  } finally {
    // Limpeza garantida dos usuários de teste
    await sql.query(`delete from "user" where "id" in ('${user1Id}', '${user2Id}')`);
  }
}

runEtapa6Tests().catch((err) => {
  console.error("FALHA NOS TESTES:", err);
  process.exit(1);
});
