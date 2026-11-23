const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const MAX_RELATIVE_TICK_DELAY_MS = 300_000;
const MIN_RELATIVE_TICK_DELAY_MS = 500;

/**
 * Converte a data/hora real de publicação de um episódio para timestamp UTC (ms),
 * tratando strings ISO/PostgreSQL com ou sem fuso horário explícito.
 * Strings sem sufixo de fuso (ex.: "2026-11-23 15:20:00") são interpretadas em UTC
 * para evitar desvios pelo fuso local do navegador ou servidor.
 */
export function parseEpisodePublicationTimestamp(
  value: string | number | Date | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) && ms > 0 ? ms : null;
  }

  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // Evita interpretar datas incompletas sem horário (ex.: "2026-11-23" ou "23/11/2026")
  // como meia-noite exata, pois não representam hora real de lançamento.
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ||
    /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)
  ) {
    return null;
  }

  // Normaliza separador espaço do PostgreSQL ("YYYY-MM-DD HH:mm:ss...") para ISO ("T")
  let normalized = trimmed.replace(
    /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)/,
    "$1T$2",
  );

  // Normaliza offsets abreviados do PostgreSQL (+00, -03, +0000, -0300) para ±HH:MM
  normalized = normalized
    .replace(/([+-]\d{2})$/, "$1:00")
    .replace(/([+-]\d{2})(\d{2})$/, "$1:$2");

  const hasExplicitTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized);
  if (
    !hasExplicitTimezone &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(normalized)
  ) {
    normalized = `${normalized}Z`;
  }

  const parsedMs = Date.parse(normalized);
  return Number.isFinite(parsedMs) && parsedMs > 0 ? parsedMs : null;
}

/**
 * Formata o tempo relativo de publicação em português (Brasil) exclusivamente
 * para episódios já lançados (`published !== false` e `publishedAt <= nowMs`).
 * Retorna `null` para episódios futuros, agendados, não publicados ou sem data real.
 */
export function formatEpisodeRelativeTime(
  publishedAt: string | number | Date | null | undefined,
  nowMs: number,
  options?: { published?: boolean },
): string | null {
  if (options?.published === false) return null;
  if (!Number.isFinite(nowMs)) return null;

  const publishedMs = parseEpisodePublicationTimestamp(publishedAt);
  if (publishedMs === null) return null;

  const diffMs = nowMs - publishedMs;
  if (diffMs < 0) {
    // Episódio futuro / agendado / ainda não lançado
    return null;
  }

  if (diffMs < MINUTE_MS) {
    return "Agora mesmo";
  }

  const diffMinutes = Math.floor(diffMs / MINUTE_MS);
  if (diffMinutes < 60) {
    return diffMinutes === 1 ? "Há 1 minuto" : `Há ${diffMinutes} minutos`;
  }

  const diffHours = Math.floor(diffMs / HOUR_MS);
  if (diffHours < 24) {
    return diffHours === 1 ? "Há 1 hora" : `Há ${diffHours} horas`;
  }

  const pubDate = new Date(publishedMs);
  const nowDate = new Date(nowMs);
  let totalMonths =
    (nowDate.getUTCFullYear() - pubDate.getUTCFullYear()) * 12 +
    (nowDate.getUTCMonth() - pubDate.getUTCMonth());

  if (totalMonths > 0) {
    const maxDayInNowMonth = new Date(
      Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth() + 1, 0),
    ).getUTCDate();
    const targetDay = Math.min(pubDate.getUTCDate(), maxDayInNowMonth);
    const anniversaryInCurrentMonth = Date.UTC(
      nowDate.getUTCFullYear(),
      nowDate.getUTCMonth(),
      targetDay,
      pubDate.getUTCHours(),
      pubDate.getUTCMinutes(),
      pubDate.getUTCSeconds(),
      pubDate.getUTCMilliseconds(),
    );

    if (nowMs < anniversaryInCurrentMonth) {
      totalMonths -= 1;
    }
  }

  if (totalMonths >= 12) {
    const years = Math.floor(totalMonths / 12);
    return years === 1 ? "Há 1 ano" : `Há ${years} anos`;
  }

  if (totalMonths >= 1) {
    return totalMonths === 1 ? "Há 1 mês" : `Há ${totalMonths} meses`;
  }

  const diffDays = Math.max(1, Math.floor(diffMs / DAY_MS));
  if (diffDays < 7) {
    return diffDays === 1 ? "Há 1 dia" : `Há ${diffDays} dias`;
  }

  const diffWeeks = Math.floor(diffDays / 7);
  return diffWeeks === 1 ? "Há 1 semana" : `Há ${diffWeeks} semanas`;
}

/**
 * Calcula o menor intervalo (em ms) até a próxima mudança visível de texto relativo
 * entre todos os episódios exibidos, permitindo um único timer compartilhado leve.
 */
export function getNextEpisodeRelativeTickMs(
  items: ReadonlyArray<{
    published?: boolean;
    publishedTimestamp?: number | null;
  }>,
  nowMs: number,
): number | null {
  if (!Number.isFinite(nowMs) || items.length === 0) return null;

  let minDelayMs = MAX_RELATIVE_TICK_DELAY_MS;
  let hasTrackableItem = false;

  for (const item of items) {
    if (item.published === false) continue;
    const publishedMs = parseEpisodePublicationTimestamp(item.publishedTimestamp);
    if (publishedMs === null) continue;

    hasTrackableItem = true;
    const elapsedMs = nowMs - publishedMs;
    let delayMs: number;

    if (elapsedMs < 0) {
      // Episódio agendado: agenda despertar quando atingir o horário real de lançamento
      delayMs = publishedMs - nowMs;
    } else if (elapsedMs < HOUR_MS) {
      delayMs = MINUTE_MS - (elapsedMs % MINUTE_MS);
    } else if (elapsedMs < DAY_MS) {
      delayMs = HOUR_MS - (elapsedMs % HOUR_MS);
    } else {
      delayMs = DAY_MS - (elapsedMs % DAY_MS);
    }

    if (delayMs < minDelayMs) {
      minDelayMs = delayMs;
    }
  }

  if (!hasTrackableItem) return null;

  return Math.min(
    MAX_RELATIVE_TICK_DELAY_MS,
    Math.max(MIN_RELATIVE_TICK_DELAY_MS, minDelayMs + 50),
  );
}
