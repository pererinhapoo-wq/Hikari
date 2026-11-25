import { createHash } from "node:crypto";
import type { Sql } from "@/lib/db";
import { getEnvAdminUserIds } from "@/lib/auth/admin-guard";
import { isHikariAdmin } from "@/lib/auth/admin";
import {
  formatBanDateTime,
  isBanActiveAt,
  isPermanentBan,
  resolveBanDuration,
  type ActiveUserBan,
  type BanDurationPreset,
  type BanHistoryEntry,
  type EnrichedActiveUserBan,
} from "@/lib/moderation-ban-types";
import { executeCreateNotification } from "@/lib/notification-create.server";

export const COMMENT_BAN_KEY_PREFIX = "comment_ban:";
export const COMMENT_BAN_LOG_KEY_PREFIX = "comment_ban_log:";

const userBanTransitionLocks = new Map<string, Promise<unknown>>();

async function withUserBanLock<T>(
  userId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const lockKey = userId.trim();
  if (!lockKey) return fn();

  const previous = userBanTransitionLocks.get(lockKey) ?? Promise.resolve();
  let release: () => void = () => {};
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  userBanTransitionLocks.set(
    lockKey,
    previous.then(
      () => current,
      () => current,
    ),
  );

  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (userBanTransitionLocks.get(lockKey) === current) {
      userBanTransitionLocks.delete(lockKey);
    }
  }
}

export const BAN_ENDED_NOTIFICATION_MESSAGE =
  "Banimento encerrado: Seu banimento foi encerrado e sua conta está liberada. Você já pode voltar a utilizar o Hikari normalmente.";

export function buildBanAppliedNotificationMessage(ban: ActiveUserBan): string {
  const cleanReason = typeof ban.reason === "string" ? ban.reason.trim() : "";

  if (isPermanentBan(ban)) {
    return cleanReason
      ? `Conta banida: Sua conta foi banida permanentemente. Motivo: ${cleanReason}`
      : "Conta banida: Sua conta foi banida permanentemente.";
  }

  const durationPart = ban.durationLabel?.trim()
    ? `por ${ban.durationLabel.trim()}`
    : "temporariamente";
  const untilPart =
    typeof ban.expiresAt === "number" && Number.isFinite(ban.expiresAt)
      ? ` (até ${formatBanDateTime(ban.expiresAt)})`
      : "";
  const reasonPart = cleanReason ? ` Motivo: ${cleanReason}` : "";

  return `Conta banida: Sua conta foi banida temporariamente ${durationPart}${untilPart}.${reasonPart}`;
}

export class ModerationBanError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ModerationBanError";
    this.status = status;
  }
}

export function buildActiveBanKey(userId: string): string {
  const clean = userId.trim();
  const direct = `${COMMENT_BAN_KEY_PREFIX}${clean}`;
  if (direct.length <= 128) return direct;
  const digest = createHash("sha256").update(clean).digest("hex").slice(0, 32);
  return `${COMMENT_BAN_KEY_PREFIX}h:${digest}`;
}

function buildBanLogKey(timestampMs: number): string {
  const padded = String(Math.max(0, Math.floor(timestampMs))).padStart(15, "0");
  const rand = Math.random().toString(36).slice(2, 8);
  const key = `${COMMENT_BAN_LOG_KEY_PREFIX}${padded}-${rand}`;
  return key.length <= 128 ? key : key.slice(0, 128);
}

function parseActiveBanJson(rawValue: string): ActiveUserBan | null {
  try {
    const parsed = JSON.parse(rawValue) as Partial<ActiveUserBan>;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.userId !== "string" || !parsed.userId.trim()) {
      return null;
    }

    const permanent =
      parsed.isPermanent === true ||
      parsed.durationPreset === "permanent" ||
      parsed.expiresAt === null;

    const hasFiniteExpiry =
      typeof parsed.expiresAt === "number" && Number.isFinite(parsed.expiresAt);

    if (!permanent && !hasFiniteExpiry) {
      return null;
    }

    const expiresAt = permanent ? null : (parsed.expiresAt as number);
    const bannedAt =
      typeof parsed.bannedAt === "number" && Number.isFinite(parsed.bannedAt)
        ? parsed.bannedAt
        : expiresAt ?? Date.now();

    return {
      banId:
        typeof parsed.banId === "string" && parsed.banId.trim()
          ? parsed.banId.trim()
          : `ban-${parsed.userId.trim()}`,
      userId: parsed.userId.trim(),
      reason:
        typeof parsed.reason === "string" && parsed.reason.trim()
          ? parsed.reason.trim()
          : "Violação das diretrizes da comunidade.",
      durationPreset: permanent
        ? "permanent"
        : (parsed.durationPreset as BanDurationPreset) || "custom",
      durationLabel:
        typeof parsed.durationLabel === "string" && parsed.durationLabel.trim()
          ? parsed.durationLabel.trim()
          : permanent
            ? "Permanente"
            : "Temporário",
      durationMs: permanent
        ? null
        : typeof parsed.durationMs === "number" && Number.isFinite(parsed.durationMs)
          ? parsed.durationMs
          : Math.max(0, (expiresAt ?? bannedAt) - bannedAt),
      isPermanent: permanent,
      bannedAt,
      expiresAt,
      bannedBy:
        typeof parsed.bannedBy === "string" ? parsed.bannedBy.trim() : "",
      bannedByName:
        typeof parsed.bannedByName === "string" ? parsed.bannedByName.trim() : null,
    };
  } catch {
    return null;
  }
}

function parseBanHistoryJson(rawValue: string): BanHistoryEntry | null {
  try {
    const parsed = JSON.parse(rawValue) as Partial<BanHistoryEntry>;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.userId !== "string" || !parsed.userId.trim()) return null;

    return {
      id: typeof parsed.id === "string" ? parsed.id : `log-${Date.now()}`,
      banId: typeof parsed.banId === "string" ? parsed.banId : "",
      action:
        parsed.action === "unban" || parsed.action === "expired"
          ? parsed.action
          : "ban",
      userId: parsed.userId.trim(),
      userName: typeof parsed.userName === "string" ? parsed.userName : null,
      userNick: typeof parsed.userNick === "string" ? parsed.userNick : null,
      userEmail: typeof parsed.userEmail === "string" ? parsed.userEmail : null,
      reason:
        typeof parsed.reason === "string" && parsed.reason.trim()
          ? parsed.reason.trim()
          : "Violação das diretrizes da comunidade.",
      durationPreset: (parsed.durationPreset as BanDurationPreset) ?? null,
      durationLabel:
        typeof parsed.durationLabel === "string" ? parsed.durationLabel : null,
      durationMs:
        typeof parsed.durationMs === "number" ? parsed.durationMs : null,
      isPermanent:
        parsed.isPermanent === true || parsed.durationPreset === "permanent",
      bannedAt: typeof parsed.bannedAt === "number" ? parsed.bannedAt : null,
      expiresAt: typeof parsed.expiresAt === "number" ? parsed.expiresAt : null,
      actorId: typeof parsed.actorId === "string" ? parsed.actorId : "",
      actorName: typeof parsed.actorName === "string" ? parsed.actorName : null,
      createdAt:
        typeof parsed.createdAt === "number" && Number.isFinite(parsed.createdAt)
          ? parsed.createdAt
          : Date.now(),
    };
  } catch {
    return null;
  }
}

async function appendBanHistoryEntry(sql: Sql, entry: BanHistoryEntry): Promise<void> {
  const key = buildBanLogKey(entry.createdAt);
  await sql.query(
    `INSERT INTO "admin_settings" ("key", "value", "createdAt", "updatedAt")
     VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT ("key") DO UPDATE
     SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP;`,
    [key, JSON.stringify(entry)],
  );
}

/**
 * Verifica sem mutações se ainda existe algum banimento ativo para o usuário no banco.
 */
async function hasAnyActiveBanForUser(
  sql: Sql,
  userId: string,
  nowMs = Date.now(),
): Promise<boolean> {
  const cleanUserId = userId.trim();
  if (!cleanUserId) return false;

  const rows = await sql.query<{ key: string; value: string }>(
    `SELECT "key", "value" FROM "admin_settings" WHERE "key" LIKE $1;`,
    [`${COMMENT_BAN_KEY_PREFIX}%`],
  );

  for (const row of rows ?? []) {
    const parsed = parseActiveBanJson(row.value);
    if (!parsed) continue;
    if (parsed.userId === cleanUserId && isBanActiveAt(parsed, nowMs)) {
      return true;
    }
  }
  return false;
}

/**
 * Envia a notificação de encerramento de banimento somente se não houver nenhum outro ban ativo.
 * Usa dedupKey único por (userId, banId) com ON CONFLICT DO NOTHING para garantir unicidade absoluta.
 */
async function notifyBanEndedIfNoOtherActiveBan(
  sql: Sql,
  ban: ActiveUserBan,
  nowMs: number,
): Promise<boolean> {
  const stillBanned = await hasAnyActiveBanForUser(sql, ban.userId, nowMs).catch(
    () => true,
  );
  if (stillBanned) {
    return false;
  }

  const result = await executeCreateNotification(sql, {
    userId: ban.userId,
    actorId: null,
    type: "account_unbanned",
    message: BAN_ENDED_NOTIFICATION_MESSAGE,
    dedupKey: `ban_ended:${ban.userId}:${ban.banId}`,
    ignoreOnConflict: true,
  }).catch((err) => {
    console.warn("[moderation-bans] Falha ao criar notificação de liberação:", err);
    return { success: false };
  });

  return Boolean(result.success);
}

/**
 * Transiciona atomicamente um banimento temporário expirado:
 * remove a chave somente se o JSON ainda for exatamente o mesmo,
 * grava no histórico e notifica o usuário apenas uma vez.
 */
async function expireBanRowAtomically(
  sql: Sql,
  key: string,
  rawValue: string,
  parsed: ActiveUserBan,
  nowMs: number,
): Promise<boolean> {
  if (isPermanentBan(parsed)) {
    return false;
  }
  if (isBanActiveAt(parsed, nowMs)) {
    return false;
  }

  const deletedRows = await sql
    .query<{ key: string }>(
      `DELETE FROM "admin_settings"
       WHERE "key" = $1 AND "value" = $2
       RETURNING "key";`,
      [key, rawValue],
    )
    .catch(() => [] as Array<{ key: string }>);

  if (!deletedRows || deletedRows.length === 0) {
    return false;
  }

  await appendBanHistoryEntry(sql, {
    id: `log-${nowMs}-${Math.random().toString(36).slice(2, 7)}`,
    banId: parsed.banId,
    action: "expired",
    userId: parsed.userId,
    reason: parsed.reason,
    durationPreset: parsed.durationPreset,
    durationLabel: parsed.durationLabel,
    durationMs: parsed.durationMs,
    isPermanent: false,
    bannedAt: parsed.bannedAt,
    expiresAt: parsed.expiresAt,
    actorId: "system",
    actorName: "Expiração automática",
    createdAt: nowMs,
  }).catch(() => undefined);

  await notifyBanEndedIfNoOtherActiveBan(sql, parsed, nowMs);
  return true;
}

/**
 * Obtém o banimento ativo de um usuário no PostgreSQL.
 * Se o prazo temporário já tiver expirado, remove o registro vencido atomicamente,
 * notifica o usuário uma única vez (caso não haja outro banimento ativo) e retorna null.
 */
export async function getActiveUserBan(
  sql: Sql,
  userId: string | null | undefined,
  nowMs = Date.now(),
): Promise<ActiveUserBan | null> {
  const cleanUserId = typeof userId === "string" ? userId.trim() : "";
  if (!cleanUserId) return null;

  return withUserBanLock(cleanUserId, async () => {
    const key = buildActiveBanKey(cleanUserId);
    const rows = await sql.query<{ key: string; value: string }>(
      `SELECT "key", "value" FROM "admin_settings" WHERE "key" = $1 LIMIT 1;`,
      [key],
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    const rawValue = rows[0].value;
    const parsed = parseActiveBanJson(rawValue);
    if (!parsed) {
      return null;
    }

    if (isPermanentBan(parsed)) {
      return parsed;
    }

    if (!isBanActiveAt(parsed, nowMs)) {
      await expireBanRowAtomically(sql, key, rawValue, parsed, nowMs);
      return null;
    }

    return parsed;
  });
}

/**
 * Reconcilia em lote todos os banimentos temporários expirados em admin_settings.
 */
export async function reconcileExpiredUserBans(
  sql: Sql,
  nowMs = Date.now(),
): Promise<number> {
  const rows = await sql.query<{ key: string; value: string }>(
    `SELECT "key", "value" FROM "admin_settings" WHERE "key" LIKE $1;`,
    [`${COMMENT_BAN_KEY_PREFIX}%`],
  );

  let expiredCount = 0;
  for (const row of rows ?? []) {
    const parsed = parseActiveBanJson(row.value);
    if (!parsed) continue;
    if (isPermanentBan(parsed)) continue;
    if (!isBanActiveAt(parsed, nowMs)) {
      const transitioned = await withUserBanLock(parsed.userId, () =>
        expireBanRowAtomically(sql, row.key, row.value, parsed, nowMs),
      );
      if (transitioned) {
        expiredCount++;
      }
    }
  }
  return expiredCount;
}

export function buildBannedCommentResponse(
  ban: ActiveUserBan,
  nowMs = Date.now(),
): Response {
  if (isPermanentBan(ban)) {
    return Response.json(
      {
        error: `Sua conta está permanentemente impedida de interagir nos comentários. Motivo: ${ban.reason}`,
        code: "USER_COMMENT_BANNED",
        isPermanent: true,
        banReason: ban.reason,
        bannedUntil: null,
        expiresAt: null,
        remainingMs: null,
      },
      {
        status: 403,
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      },
    );
  }

  const expiresAt = ban.expiresAt ?? nowMs;
  const remainingMs = Math.max(0, expiresAt - nowMs);
  const untilLabel = formatBanDateTime(expiresAt);
  return Response.json(
    {
      error: `Sua conta está temporariamente impedida de interagir nos comentários até ${untilLabel}. Motivo: ${ban.reason}`,
      code: "USER_COMMENT_BANNED",
      isPermanent: false,
      banReason: ban.reason,
      bannedUntil: new Date(expiresAt).toISOString(),
      expiresAt,
      remainingMs,
    },
    {
      status: 403,
      headers: {
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    },
  );
}

/**
 * Carrega mapa de banimentos ativos (somente leitura, sem DELETE síncrono na listagem).
 */
export async function listActiveBansMap(
  sql: Sql,
  nowMs = Date.now(),
): Promise<Map<string, ActiveUserBan>> {
  const map = new Map<string, ActiveUserBan>();
  const rows = await sql.query<{ key: string; value: string }>(
    `SELECT "key", "value" FROM "admin_settings" WHERE "key" LIKE $1;`,
    [`${COMMENT_BAN_KEY_PREFIX}%`],
  );

  for (const row of rows ?? []) {
    const parsed = parseActiveBanJson(row.value);
    if (!parsed) continue;
    if (!isBanActiveAt(parsed, nowMs)) {
      continue;
    }
    map.set(parsed.userId, parsed);
  }

  return map;
}

export function isSystemProtectedAdmin(params: {
  userId: string;
  email?: string | null;
}): boolean {
  const cleanId = params.userId.trim();
  if (!cleanId) return false;
  if (getEnvAdminUserIds().includes(cleanId)) return true;
  if (params.email && isHikariAdmin(params.email)) return true;
  return false;
}

export async function applyTemporaryUserBan(
  sql: Sql,
  input: {
    targetUserId: string;
    preset?: string | null;
    customAmount?: number | string | null;
    customUnit?: string | null;
    isPermanent?: boolean;
    reason: string;
    actorId: string;
    actorEmail?: string | null;
    actorName?: string | null;
    nowMs?: number;
  },
): Promise<ActiveUserBan> {
  const targetUserId = input.targetUserId.trim();
  if (!targetUserId) {
    throw new ModerationBanError("ID do usuário é obrigatório.", 400);
  }

  if (targetUserId === input.actorId) {
    throw new ModerationBanError("Você não pode banir sua própria conta.", 400);
  }

  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw new ModerationBanError(
      "Informe um motivo com pelo menos 3 caracteres.",
      400,
    );
  }
  if (reason.length > 500) {
    throw new ModerationBanError(
      "O motivo do banimento não pode ultrapassar 500 caracteres.",
      400,
    );
  }

  let resolvedDuration: {
    preset: BanDurationPreset;
    durationMs: number | null;
    durationLabel: string;
    isPermanent: boolean;
  };
  try {
    resolvedDuration = resolveBanDuration({
      preset: input.preset,
      customAmount: input.customAmount,
      customUnit: input.customUnit,
      isPermanent: input.isPermanent,
    });
  } catch (err) {
    throw new ModerationBanError(
      err instanceof Error ? err.message : "Duração de banimento inválida.",
      400,
    );
  }

  const targetRows = await sql.query<{
    id: string;
    name: string | null;
    email: string | null;
    nick: string | null;
    role: string | null;
  }>(
    `SELECT
       u."id",
       u."name",
       u."email",
       p."nick",
       COALESCE(p."role", 'user') as "role"
     FROM "user" u
     LEFT JOIN "profile" p ON p."userId" = u."id"
     WHERE u."id" = $1
     LIMIT 1;`,
    [targetUserId],
  );

  const target = targetRows[0];
  if (!target) {
    throw new ModerationBanError("Usuário não encontrado.", 404);
  }

  if (isSystemProtectedAdmin({ userId: target.id, email: target.email })) {
    throw new ModerationBanError(
      "Não é permitido banir esta conta: trata-se de um administrador protegido do sistema.",
      403,
    );
  }

  const targetIsDbAdmin = target.role?.trim().toLowerCase() === "admin";
  const actorIsSystemAdmin = isSystemProtectedAdmin({
    userId: input.actorId,
    email: input.actorEmail,
  });

  if (targetIsDbAdmin && !actorIsSystemAdmin) {
    throw new ModerationBanError(
      "Apenas administradores principais do sistema podem suspender outra conta administrativa.",
      403,
    );
  }

  const nowMs =
    typeof input.nowMs === "number" && Number.isFinite(input.nowMs)
      ? input.nowMs
      : Date.now();
  const expiresAt = resolvedDuration.isPermanent
    ? null
    : nowMs + (resolvedDuration.durationMs ?? 0);
  const banId = `ban-${nowMs}-${Math.random().toString(36).slice(2, 8)}`;

  const banRecord: ActiveUserBan = {
    banId,
    userId: target.id,
    reason,
    durationPreset: resolvedDuration.preset,
    durationLabel: resolvedDuration.durationLabel,
    durationMs: resolvedDuration.durationMs,
    isPermanent: resolvedDuration.isPermanent,
    bannedAt: nowMs,
    expiresAt,
    bannedBy: input.actorId,
    bannedByName: input.actorName?.trim() || input.actorEmail || "Administrador",
  };

  const key = buildActiveBanKey(target.id);
  await sql.query(
    `INSERT INTO "admin_settings" ("key", "value", "createdAt", "updatedAt")
     VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT ("key") DO UPDATE
     SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP;`,
    [key, JSON.stringify(banRecord)],
  );

  await appendBanHistoryEntry(sql, {
    id: `log-${nowMs}-${Math.random().toString(36).slice(2, 7)}`,
    banId,
    action: "ban",
    userId: target.id,
    userName: target.name,
    userNick: target.nick,
    userEmail: target.email,
    reason,
    durationPreset: resolvedDuration.preset,
    durationLabel: resolvedDuration.durationLabel,
    durationMs: resolvedDuration.durationMs,
    isPermanent: resolvedDuration.isPermanent,
    bannedAt: nowMs,
    expiresAt,
    actorId: input.actorId,
    actorName: banRecord.bannedByName,
    createdAt: nowMs,
  });

  // Notificação criada somente após o banimento ter sido efetivamente persistido no banco
  await executeCreateNotification(sql, {
    userId: target.id,
    actorId: null,
    type: "account_banned",
    message: buildBanAppliedNotificationMessage(banRecord),
    dedupKey: `ban_applied:${target.id}:${banRecord.banId}`,
    ignoreOnConflict: true,
  }).catch((err) => {
    console.warn("[moderation-bans] Falha ao criar notificação de banimento:", err);
  });

  return banRecord;
}

export const applyUserBan = applyTemporaryUserBan;

export async function revokeUserBan(
  sql: Sql,
  input: {
    targetUserId: string;
    actorId: string;
    actorName?: string | null;
    actorEmail?: string | null;
    revokeReason?: string | null;
    nowMs?: number;
  },
): Promise<{ ok: true; revokedBan: ActiveUserBan }> {
  const targetUserId = input.targetUserId.trim();
  if (!targetUserId) {
    throw new ModerationBanError("ID do usuário é obrigatório.", 400);
  }

  const nowMs =
    typeof input.nowMs === "number" && Number.isFinite(input.nowMs)
      ? input.nowMs
      : Date.now();
  const key = buildActiveBanKey(targetUserId);

  return withUserBanLock(targetUserId, async () => {
    const existingRows = await sql.query<{ key: string; value: string }>(
      `SELECT "key", "value" FROM "admin_settings" WHERE "key" = $1 LIMIT 1;`,
      [key],
    );

    const rawValue = existingRows[0]?.value;
    const activeBan = rawValue ? parseActiveBanJson(rawValue) : null;

    if (!activeBan || !isBanActiveAt(activeBan, nowMs)) {
      if (activeBan && rawValue && !isPermanentBan(activeBan)) {
        await expireBanRowAtomically(sql, key, rawValue, activeBan, nowMs);
      }
      throw new ModerationBanError(
        "Este usuário não possui um banimento ativo.",
        404,
      );
    }

    const deletedRows = await sql.query<{ key: string }>(
      `DELETE FROM "admin_settings"
       WHERE "key" = $1 AND "value" = $2
       RETURNING "key";`,
      [key, rawValue],
    );

    if (!deletedRows || deletedRows.length === 0) {
      throw new ModerationBanError(
        "Este usuário não possui um banimento ativo.",
        404,
      );
    }

    const userRows = await sql.query<{
      id: string;
      name: string | null;
      email: string | null;
      nick: string | null;
    }>(
      `SELECT u."id", u."name", u."email", p."nick"
       FROM "user" u
       LEFT JOIN "profile" p ON p."userId" = u."id"
       WHERE u."id" = $1
       LIMIT 1;`,
      [targetUserId],
    );
    const target = userRows[0];

    await appendBanHistoryEntry(sql, {
      id: `log-${nowMs}-${Math.random().toString(36).slice(2, 7)}`,
      banId: activeBan.banId,
      action: "unban",
      userId: targetUserId,
      userName: target?.name ?? null,
      userNick: target?.nick ?? null,
      userEmail: target?.email ?? null,
      reason:
        input.revokeReason?.trim() ||
        `Banimento encerrado antecipadamente (motivo original: ${activeBan.reason})`,
      durationPreset: activeBan.durationPreset,
      durationLabel: activeBan.durationLabel,
      durationMs: activeBan.durationMs,
      isPermanent: isPermanentBan(activeBan),
      bannedAt: activeBan.bannedAt,
      expiresAt: activeBan.expiresAt,
      actorId: input.actorId,
      actorName: input.actorName?.trim() || input.actorEmail || "Administrador",
      createdAt: nowMs,
    });

    await notifyBanEndedIfNoOtherActiveBan(sql, activeBan, nowMs);

    return { ok: true, revokedBan: activeBan };
  });
}

export async function listBansAndHistory(
  sql: Sql,
  nowMs = Date.now(),
): Promise<{
  activeBans: EnrichedActiveUserBan[];
  history: BanHistoryEntry[];
}> {
  await reconcileExpiredUserBans(sql, nowMs).catch(() => 0);

  const activeMap = await listActiveBansMap(sql, nowMs);
  const activeList = Array.from(activeMap.values()).sort(
    (a, b) => b.bannedAt - a.bannedAt,
  );

  const historyRows = await sql.query<{ key: string; value: string }>(
    `SELECT "key", "value"
     FROM "admin_settings"
     WHERE "key" LIKE $1
     ORDER BY "key" DESC
     LIMIT 120;`,
    [`${COMMENT_BAN_LOG_KEY_PREFIX}%`],
  );

  const history = (historyRows ?? [])
    .map((r) => parseBanHistoryJson(r.value))
    .filter((entry): entry is BanHistoryEntry => Boolean(entry));

  const userIdsSet = new Set<string>();
  for (const b of activeList) userIdsSet.add(b.userId);
  for (const h of history) {
    if (!h.userName || !h.userEmail) userIdsSet.add(h.userId);
  }

  const userMetaMap = new Map<
    string,
    {
      name: string;
      nick: string | null;
      email: string | null;
      image: string | null;
    }
  >();

  const ids = Array.from(userIdsSet);
  if (ids.length > 0) {
    const userRows = await sql.query<{
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
      nick: string | null;
      avatarUrl: string | null;
    }>(
      `SELECT u."id", u."name", u."email", u."image", p."nick", p."avatarUrl"
       FROM "user" u
       LEFT JOIN "profile" p ON p."userId" = u."id"
       WHERE u."id" = ANY($1::text[]);`,
      [ids],
    );
    for (const u of userRows ?? []) {
      userMetaMap.set(u.id, {
        name: u.name || u.nick || "Usuário",
        nick: u.nick ?? null,
        email: u.email ?? null,
        image: u.avatarUrl || u.image || null,
      });
    }
  }

  const activeBans: EnrichedActiveUserBan[] = activeList.map((ban) => {
    const meta = userMetaMap.get(ban.userId);
    const permanent = isPermanentBan(ban);
    return {
      ...ban,
      userName: meta?.name || "Usuário",
      userNick: meta?.nick ?? null,
      userEmail: meta?.email ?? null,
      userImage: meta?.image ?? null,
      remainingMs:
        permanent || ban.expiresAt === null
          ? null
          : Math.max(0, ban.expiresAt - nowMs),
    };
  });

  const enrichedHistory: BanHistoryEntry[] = history.map((entry) => {
    const meta = userMetaMap.get(entry.userId);
    return {
      ...entry,
      userName: entry.userName || meta?.name || "Usuário",
      userNick: entry.userNick ?? meta?.nick ?? null,
      userEmail: entry.userEmail ?? meta?.email ?? null,
    };
  });

  return {
    activeBans,
    history: enrichedHistory,
  };
}
