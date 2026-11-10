function getRandomHex(bytesCount: number): string {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    const arr = new Uint8Array(bytesCount);
    globalThis.crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return Math.random().toString(16).slice(2, 2 + bytesCount * 2).padEnd(bytesCount * 2, "0");
}
import type { Sql } from "@/lib/db";

/**
 * Gera um nick inicial único, seguro contra colisões.
 * Formato: <slug_base>_<hex6> (ex: "ren_8f32a1", "matheus_c4b12a", "user_5d91e3")
 * Segue a regra do Hikari: /^[a-z0-9_]{3,30}$/
 */
export function generateCandidateNick(name?: string | null): string {
  const clean = (name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 15);

  const base = clean.length >= 3 ? clean : "ren";
  const suffix = getRandomHex(3); // 6 caracteres hexadecimais aleatórios
  return `${base}_${suffix}`.slice(0, 30);
}

/**
 * Provisiona de forma segura e idempotente um registro na tabela "profile"
 * para um usuário, garantindo a existência de um nick inicial único.
 *
 * Tratamento rigoroso de concorrência e idempotência:
 * - Se o perfil já existir com nick, retorna o nick existente imediatamente.
 * - Se houver corrida na criação, 'ON CONFLICT ("userId") DO NOTHING' evita duplicações.
 * - Se houver colisão de nick no índice único parcial, realiza retentativas automáticas.
 * - Preserva os valores padrão de privacidade definidos na Migration 0020.
 */
export async function ensureUserProfile(
  sql: Sql,
  user: {
    id: string;
    name?: string | null;
    image?: string | null;
  },
): Promise<{ nick: string; created: boolean }> {
  if (!user.id) {
    throw new Error("ID do usuário é obrigatório para provisionamento de perfil.");
  }

  // 1. Verificar se já existe perfil para este usuário
  const existingRows = await sql<{
    nick: string | null;
  }>`
    select "nick"
    from "profile"
    where "userId" = ${user.id}
    limit 1
  `;

  if (existingRows.length > 0) {
    const existingNick = existingRows[0]?.nick?.trim();
    if (existingNick) {
      return { nick: existingNick, created: false };
    }

    // Perfil existe mas o nick está nulo ou vazio: preencher nick único
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidateNick = generateCandidateNick(user.name);
      try {
        const updated = await sql<{ nick: string }>`
          update "profile"
          set "nick" = ${candidateNick},
              "updatedAt" = current_timestamp
          where "userId" = ${user.id}
            and ("nick" is null or trim("nick") = '')
          returning "nick"
        `;
        if (updated.length > 0) {
          return { nick: updated[0].nick, created: false };
        }
        // Outro processo concorrente já pode ter preenchido
        const check = await sql<{ nick: string | null }>`
          select "nick" from "profile" where "userId" = ${user.id} limit 1
        `;
        if (check[0]?.nick) {
          return { nick: check[0].nick, created: false };
        }
      } catch (err: any) {
        if (err?.code === "23505" || String(err?.message || "").includes("unique")) {
          continue; // colisão no índice único do nick, tenta novamente
        }
        throw err;
      }
    }
  }

  // 2. Não existe perfil: tentar criar com retry em caso de colisão no índice único de nick
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidateNick = generateCandidateNick(user.name);
    try {
      const inserted = await sql<{ nick: string }>`
        insert into "profile" (
          "userId",
          "nick",
          "displayName",
          "avatarUrl",
          "accountType",
          "allowFollowers",
          "privacyLists",
          "privacyFavorites",
          "privacyHistory",
          "privacyComments",
          "privacyFollowers"
        )
        values (
          ${user.id},
          ${candidateNick},
          ${user.name || null},
          ${user.image || null},
          'public',
          true,
          'public',
          'public',
          'public',
          'public',
          'public'
        )
        on conflict ("userId") do nothing
        returning "nick"
      `;

      if (inserted.length > 0) {
        return { nick: inserted[0].nick, created: true };
      }

      // Se retornou 0 linhas por conflito em ("userId"), recuperar o registro criado pelo processo concorrente
      const existing = await sql<{ nick: string | null }>`
        select "nick" from "profile" where "userId" = ${user.id} limit 1
      `;
      if (existing[0]?.nick) {
        return { nick: existing[0].nick, created: false };
      }
    } catch (err: any) {
      if (err?.code === "23505" || String(err?.message || "").includes("unique")) {
        continue;
      }
      throw err;
    }
  }

  // Fallback seguro caso atinja max tentativas de colisão (altamente improvável)
  const fallbackNick = `user_${Date.now().toString(36)}_${getRandomHex(2)}`.slice(0, 30);
  await sql`
    insert into "profile" (
      "userId",
      "nick",
      "displayName",
      "avatarUrl",
      "accountType",
      "allowFollowers",
      "privacyLists",
      "privacyFavorites",
      "privacyHistory",
      "privacyComments",
      "privacyFollowers"
    )
    values (
      ${user.id},
      ${fallbackNick},
      ${user.name || null},
      ${user.image || null},
      'public',
      true,
      'public',
      'public',
      'public',
      'public',
      'public'
    )
    on conflict ("userId") do nothing
  `;

  const finalCheck = await sql<{ nick: string | null }>`
    select "nick" from "profile" where "userId" = ${user.id} limit 1
  `;
  return { nick: finalCheck[0]?.nick || fallbackNick, created: true };
}

/**
 * Varre com segurança e provisiona contas da tabela "user" que ainda não possuam
 * registro na tabela "profile". Seguro e idempotente.
 */
export async function provisionMissingProfiles(sql: Sql): Promise<number> {
  try {
    const unprovisioned = await sql<{
      id: string;
      name: string | null;
      image: string | null;
    }>`
      select u."id", u."name", u."image"
      from "user" u
      left join "profile" p on p."userId" = u."id"
      where p."userId" is null
    `;

    let count = 0;
    for (const user of unprovisioned) {
      await ensureUserProfile(sql, user);
      count++;
    }
    return count;
  } catch (err) {
    console.error("[profile-provision] Erro ao sincronizar perfis ausentes:", err);
    return 0;
  }
}
