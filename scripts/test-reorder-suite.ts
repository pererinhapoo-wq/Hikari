import { getSql } from "../src/lib/db";

// Replicate the exact atomic query and validation logic used in reorderProfileFavorites
const atomicReorderQuery = `
  WITH user_lock AS (
    SELECT "id" FROM "user" WHERE "id" = $1 FOR UPDATE
  ),
  incoming AS (
    SELECT elem AS id, (ord - 1)::int AS new_pos
    FROM unnest($2::text[]) WITH ORDINALITY AS t(elem, ord)
  ),
  current_favs AS (
    SELECT uf."id"
    FROM "user_favorite" uf
    JOIN user_lock ul ON uf."userId" = ul."id"
    WHERE uf."targetType" = $3
  ),
  validation AS (
    SELECT
      (SELECT count(*) FROM user_lock)::int AS user_count,
      (SELECT count(*) FROM incoming)::int AS incoming_count,
      (SELECT count(DISTINCT id) FROM incoming)::int AS unique_incoming_count,
      (SELECT count(*) FROM current_favs)::int AS current_count,
      (
        SELECT count(*)
        FROM current_favs cf
        JOIN incoming inc ON inc.id = cf."id"
      )::int AS matched_count,
      (
        SELECT inc.id
        FROM incoming inc
        LEFT JOIN current_favs cf ON cf."id" = inc.id
        WHERE cf."id" IS NULL
        LIMIT 1
      ) AS invalid_id
  ),
  updated_rows AS (
    UPDATE "user_favorite" uf
    SET "position" = inc.new_pos
    FROM incoming inc, user_lock ul, validation v
    WHERE v.user_count = 1
      AND v.incoming_count = v.unique_incoming_count
      AND v.incoming_count = v.current_count
      AND v.matched_count = v.current_count
      AND uf."id" = inc.id
      AND uf."userId" = ul."id"
      AND uf."targetType" = $3
    RETURNING uf."id", uf."position"
  )
  SELECT
    v.user_count,
    v.incoming_count,
    v.unique_incoming_count,
    v.current_count,
    v.matched_count,
    v.invalid_id,
    (SELECT count(*)::int FROM updated_rows) AS updated_count
  FROM validation v;
`;

async function executeReorder(
  userId: string,
  targetType: string,
  orderedFavoriteIds: string[]
) {
  // 1. Rejeita duplicados na lista em JS
  const uniqueIds = new Set(orderedFavoriteIds);
  if (uniqueIds.size !== orderedFavoriteIds.length) {
    throw new Error("A lista de reordenação contém IDs duplicados.");
  }

  const sql = await getSql();
  const results = await sql.query<{
    user_count: number;
    incoming_count: number;
    unique_incoming_count: number;
    current_count: number;
    matched_count: number;
    invalid_id: string | null;
    updated_count: number;
  }>(atomicReorderQuery, [userId, orderedFavoriteIds, targetType]);

  const result = results[0];
  if (!result || result.user_count === 0) {
    throw new Error("Usuário não encontrado.");
  }

  if (result.incoming_count !== result.unique_incoming_count) {
    throw new Error("A lista de reordenação contém IDs duplicados.");
  }

  if (result.invalid_id) {
    throw new Error(
      `O favorito '${result.invalid_id}' é inválido ou não pertence aos seus favoritos desta categoria.`
    );
  }

  if (
    result.incoming_count !== result.current_count ||
    result.matched_count !== result.current_count
  ) {
    throw new Error(
      `A nova ordem deve conter exatamente todos os ${result.current_count} favoritos dessa categoria.`
    );
  }

  if (result.updated_count !== result.incoming_count) {
    throw new Error("Falha ao atualizar as posições dos favoritos.");
  }

  return {
    success: true,
    targetType,
    updatedCount: result.updated_count,
  };
}

async function run() {
  console.log("============================================================");
  console.log("BATERIA DE TESTES: REORDENAÇÃO ATÔMICA DE FAVORITOS");
  console.log("============================================================");

  const sql = await getSql();

  const user1 = "u-suite-user-1";
  const user2 = "u-suite-user-2";

  // Limpeza
  await sql.query(`DELETE FROM "user_favorite" WHERE "userId" IN ($1, $2)`, [user1, user2]);
  await sql.query(`DELETE FROM "user" WHERE "id" IN ($1, $2)`, [user1, user2]);

  // Criação dos usuários
  await sql.query(
    `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
     VALUES ($1, 'User 1', 'u1@suite.local', true, now(), now()),
            ($2, 'User 2', 'u2@suite.local', true, now(), now())`,
    [user1, user2]
  );

  // Catálogo base
  await sql.query(
    `INSERT INTO "catalog_anime" ("id", "title")
     VALUES ('anime-s1', 'Suite Anime 1'),
            ('anime-s2', 'Suite Anime 2'),
            ('anime-s3', 'Suite Anime 3'),
            ('anime-s4', 'Suite Anime 4')
     ON CONFLICT ("id") DO NOTHING`
  );
  await sql.query(
    `INSERT INTO "catalog_character" ("id", "name")
     VALUES ('char-s1', 'Suite Char 1')
     ON CONFLICT ("id") DO NOTHING`
  );

  // Setup: User 1 tem 3 animes (pos 0, 1, 2) e 1 personagem (pos 0)
  const u1_fav1 = "u1-fav-anime-1";
  const u1_fav2 = "u1-fav-anime-2";
  const u1_fav3 = "u1-fav-anime-3";
  const u1_char1 = "u1-fav-char-1";

  await sql.query(
    `INSERT INTO "user_favorite" ("id", "userId", "targetType", "animeId", "position")
     VALUES ($1, $2, 'anime', 'anime-s1', 0),
            ($3, $2, 'anime', 'anime-s2', 1),
            ($4, $2, 'anime', 'anime-s3', 2)`,
    [u1_fav1, user1, u1_fav2, u1_fav3]
  );
  await sql.query(
    `INSERT INTO "user_favorite" ("id", "userId", "targetType", "characterId", "position")
     VALUES ($1, $2, 'character', 'char-s1', 0)`,
    [u1_char1, user1]
  );

  // Setup: User 2 tem 1 anime (pos 0)
  const u2_fav1 = "u2-fav-anime-1";
  await sql.query(
    `INSERT INTO "user_favorite" ("id", "userId", "targetType", "animeId", "position")
     VALUES ($1, $2, 'anime', 'anime-s4', 0)`,
    [u2_fav1, user2]
  );

  let passed = 0;
  let total = 0;

  function check(name: string, condition: boolean) {
    total++;
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}`);
      throw new Error(`Falha no teste: ${name}`);
    }
  }

  // 1. Reordenação normal
  console.log("\n--- TESTE 1: Reordenação normal (inversão [u1_fav3, u1_fav2, u1_fav1]) ---");
  const res1 = await executeReorder(user1, "anime", [u1_fav3, u1_fav2, u1_fav1]);
  check("Retornou success: true e updatedCount: 3", res1.success === true && res1.updatedCount === 3);

  const check1 = await sql.query<{ id: string; position: number }>(
    `SELECT "id", "position" FROM "user_favorite" WHERE "userId" = $1 AND "targetType" = 'anime' ORDER BY "position" ASC`,
    [user1]
  );
  check("Posição 0 é u1_fav3", check1[0].id === u1_fav3 && check1[0].position === 0);
  check("Posição 1 é u1_fav2", check1[1].id === u1_fav2 && check1[1].position === 1);
  check("Posição 2 é u1_fav1", check1[2].id === u1_fav1 && check1[2].position === 2);

  // Verificar que favoritos de outra categoria e de outro usuário não foram tocados
  const charCheck = await sql.query<{ position: number }>(
    `SELECT "position" FROM "user_favorite" WHERE "id" = $1`,
    [u1_char1]
  );
  check("Categoria character de User 1 inalterada (pos 0)", charCheck[0].position === 0);

  const u2Check = await sql.query<{ position: number }>(
    `SELECT "position" FROM "user_favorite" WHERE "id" = $1`,
    [u2_fav1]
  );
  check("Favorito de User 2 inalterado (pos 0)", u2Check[0].position === 0);

  // 2. Lista incompleta (omite u1_fav1)
  console.log("\n--- TESTE 2: Lista incompleta (passa apenas [u1_fav3, u1_fav2]) ---");
  let err2: any = null;
  try {
    await executeReorder(user1, "anime", [u1_fav3, u1_fav2]);
  } catch (e: any) {
    err2 = e;
  }
  check(
    "Rejeitou lista incompleta com mensagem clara",
    err2 !== null && err2.message.includes("A nova ordem deve conter exatamente todos os 3 favoritos")
  );

  // 3. IDs duplicados
  console.log("\n--- TESTE 3: IDs duplicados ([u1_fav3, u1_fav3, u1_fav1]) ---");
  let err3: any = null;
  try {
    await executeReorder(user1, "anime", [u1_fav3, u1_fav3, u1_fav1]);
  } catch (e: any) {
    err3 = e;
  }
  check(
    "Rejeitou IDs duplicados",
    err3 !== null && err3.message.includes("contém IDs duplicados")
  );

  // 4. IDs inexistentes
  console.log("\n--- TESTE 4: IDs inexistentes ([u1_fav3, u1_fav2, 'id-inexistente-123']) ---");
  let err4: any = null;
  try {
    await executeReorder(user1, "anime", [u1_fav3, u1_fav2, "id-inexistente-123"]);
  } catch (e: any) {
    err4 = e;
  }
  check(
    "Rejeitou ID inexistente identificando o id inválido",
    err4 !== null && err4.message.includes("id-inexistente-123") && err4.message.includes("inválido")
  );

  // 5. Tentativa de reordenar favoritos de outro usuário (User 2)
  console.log("\n--- TESTE 5: Tentativa de usar ID de outro usuário ([u1_fav3, u1_fav2, u2_fav1]) ---");
  let err5: any = null;
  try {
    await executeReorder(user1, "anime", [u1_fav3, u1_fav2, u2_fav1]);
  } catch (e: any) {
    err5 = e;
  }
  check(
    "Rejeitou ID de outro usuário",
    err5 !== null && err5.message.includes(u2_fav1) && err5.message.includes("inválido")
  );

  // 6. Tentativa de usar ID de outra categoria do próprio usuário ([u1_fav3, u1_fav2, u1_char1])
  console.log("\n--- TESTE 6: Tentativa de usar ID de outra categoria ([u1_fav3, u1_fav2, u1_char1]) ---");
  let err6: any = null;
  try {
    await executeReorder(user1, "anime", [u1_fav3, u1_fav2, u1_char1]);
  } catch (e: any) {
    err6 = e;
  }
  check(
    "Rejeitou ID de outra categoria",
    err6 !== null && err6.message.includes(u1_char1) && err6.message.includes("inválido")
  );

  // 7. Duas requisições simultâneas do mesmo usuário
  console.log("\n--- TESTE 7: Duas requisições simultâneas do mesmo usuário ---");
  const orderA = [u1_fav1, u1_fav2, u1_fav3];
  const orderB = [u1_fav2, u1_fav3, u1_fav1];

  const [concA, concB] = await Promise.all([
    executeReorder(user1, "anime", orderA),
    executeReorder(user1, "anime", orderB),
  ]);

  check("Ambas as requisições concorrentes retornaram sucesso", concA.success && concB.success);

  const finalOrder = await sql.query<{ id: string; position: number }>(
    `SELECT "id", "position" FROM "user_favorite" WHERE "userId" = $1 AND "targetType" = 'anime' ORDER BY "position" ASC`,
    [user1]
  );
  check("Final manteve exatamente 3 favoritos", finalOrder.length === 3);
  check("Posições finais são 0, 1, 2 sem gaps ou duplicatas",
    finalOrder[0].position === 0 && finalOrder[1].position === 1 && finalOrder[2].position === 2
  );
  console.log("  Ordem final no banco:", finalOrder.map(r => `${r.id} (#${r.position})`).join(" -> "));

  // Limpeza
  await sql.query(`DELETE FROM "user_favorite" WHERE "userId" IN ($1, $2)`, [user1, user2]);
  await sql.query(`DELETE FROM "user" WHERE "id" IN ($1, $2)`, [user1, user2]);

  console.log(`\n============================================================`);
  console.log(`RESULTADO FINAL: ${passed}/${total} TESTES PASSARAM COM SUCESSO!`);
  console.log(`============================================================`);

  process.exit(0);
}

run().catch((err) => {
  console.error("Erro na suíte de testes:", err);
  process.exit(1);
});
