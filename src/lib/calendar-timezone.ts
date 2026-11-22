export const CALENDAR_TIMEZONE = "America/Sao_Paulo";

const saoPauloDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CALENDAR_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const saoPauloDateTimePartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CALENDAR_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export type WeekDayInfo = {
  index: number; // 0 = Segunda-feira ... 6 = Domingo
  name: string;
  cleanName: string;
  shortName: string;
  dateKey: string; // "YYYY-MM-DD" no fuso America/Sao_Paulo
  dateStr: string; // "DD/MM"
  fullDateStr: string; // "segunda-feira, 26 de outubro"
  isToday: boolean;
};

export const WEEK_DAY_NAMES = [
  { index: 0, name: "Segunda-feira", cleanName: "Segunda", shortName: "Seg" },
  { index: 1, name: "Terça-feira", cleanName: "Terça", shortName: "Ter" },
  { index: 2, name: "Quarta-feira", cleanName: "Quarta", shortName: "Qua" },
  { index: 3, name: "Quinta-feira", cleanName: "Quinta", shortName: "Qui" },
  { index: 4, name: "Sexta-feira", cleanName: "Sexta", shortName: "Sex" },
  { index: 5, name: "Sábado", cleanName: "Sábado", shortName: "Sáb" },
  { index: 6, name: "Domingo", cleanName: "Domingo", shortName: "Dom" },
] as const;

export const WEEK_DAY_OPTIONS = WEEK_DAY_NAMES;

export function getWeekdayLabelSaoPaulo(dayOfWeek: number): string {
  return WEEK_DAY_NAMES[dayOfWeek]?.name ?? "Dia inválido";
}

const PT_BR_MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

function getSaoPauloOffsetMsAtUtc(utcMs: number): number {
  const parts = saoPauloDateTimePartsFormatter.formatToParts(new Date(utcMs));
  const map: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = Number(part.value);
    }
  }
  const localAsUtc = Date.UTC(
    map.year,
    (map.month || 1) - 1,
    map.day || 1,
    map.hour === 24 ? 0 : (map.hour ?? 0),
    map.minute ?? 0,
    map.second ?? 0,
  );
  return localAsUtc - utcMs;
}

/**
 * Converte uma data local "YYYY-MM-DD" às 00:00:00.000 em America/Sao_Paulo
 * para o timestamp exato em milissegundos UTC, respeitando eventuais transições de horário.
 */
export function getSaoPauloMidnightUtcMs(dayKey: string): number {
  const [year, month, day] = dayKey.split("-").map(Number);
  const noonUtc = Date.UTC(year, month - 1, day, 12, 0, 0);
  const offsetAtNoon = getSaoPauloOffsetMsAtUtc(noonUtc);
  const candidateMidnight = Date.UTC(year, month - 1, day, 0, 0, 0) - offsetAtNoon;
  const offsetAtMidnight = getSaoPauloOffsetMsAtUtc(candidateMidnight);
  if (offsetAtMidnight !== offsetAtNoon) {
    return Date.UTC(year, month - 1, day, 0, 0, 0) - offsetAtMidnight;
  }
  return candidateMidnight;
}

/**
 * Retorna um timestamp UTC (em segundos) correspondente às 12:00:00 da data "YYYY-MM-DD"
 * em America/Sao_Paulo. Útil para ancorar recorrências dentro do dia sem exibir horário.
 */
export function getSaoPauloNoonTimestamp(dayKey: string): number {
  const [year, month, day] = dayKey.split("-").map(Number);
  const noonUtc = Date.UTC(year, month - 1, day, 12, 0, 0);
  const offsetAtNoon = getSaoPauloOffsetMsAtUtc(noonUtc);
  return Math.floor((noonUtc - offsetAtNoon) / 1000);
}

function addDaysToDayKey(dayKey: string, deltaDays: number): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + deltaDays, 12, 0, 0));
  return shifted.toISOString().slice(0, 10);
}

/**
 * Retorna a chave "YYYY-MM-DD" correspondente ao momento informado no fuso "America/Sao_Paulo".
 */
export function getDayKeySaoPaulo(dateOrUnixSeconds: Date | number): string {
  const date =
    typeof dateOrUnixSeconds === "number"
      ? new Date(dateOrUnixSeconds * 1000)
      : dateOrUnixSeconds;

  return saoPauloDateFormatter.format(date);
}

/**
 * Retorna o índice do dia da semana em "America/Sao_Paulo" alinhado ao Hikari:
 * 0 = Segunda-feira ... 6 = Domingo.
 */
export function getWeekdaySaoPaulo(dateOrUnixSecondsOrDayKey: Date | number | string): number {
  const dayKey =
    typeof dateOrUnixSecondsOrDayKey === "string"
      ? dateOrUnixSecondsOrDayKey
      : getDayKeySaoPaulo(dateOrUnixSecondsOrDayKey);
  const [year, month, day] = dayKey.split("-").map(Number);
  const utcDay = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
  return utcDay === 0 ? 6 : utcDay - 1;
}

/**
 * Deriva os 7 dias (dateKey + index 0..6) a partir de startTimestamp ou weekKey em America/Sao_Paulo.
 */
export function getWeekDaysFromRangeSaoPaulo(
  startTimestamp: number,
  weekKey?: string,
): Array<{ dateKey: string; index: number }> {
  const anchorKey =
    weekKey && /^\d{4}-\d{2}-\d{2}$/.test(weekKey)
      ? weekKey
      : getDayKeySaoPaulo(startTimestamp);
  const days: Array<{ dateKey: string; index: number }> = [];
  for (let i = 0; i < 7; i += 1) {
    const dateKey = addDaysToDayKey(anchorKey, i);
    days.push({
      dateKey,
      index: getWeekdaySaoPaulo(dateKey),
    });
  }
  return days;
}

/**
 * Retorna o intervalo UTC em segundos [início 00:00:00, fim 23:59:59] para uma data "YYYY-MM-DD"
 * em America/Sao_Paulo.
 */
export function getDayUtcRangeSaoPaulo(dayKey: string): {
  startTimestamp: number;
  endTimestamp: number;
} {
  const startMs = getSaoPauloMidnightUtcMs(dayKey);
  const nextDayKey = addDaysToDayKey(dayKey, 1);
  const nextMidnightMs = getSaoPauloMidnightUtcMs(nextDayKey);

  return {
    startTimestamp: Math.floor(startMs / 1000),
    endTimestamp: Math.floor((nextMidnightMs - 1) / 1000),
  };
}

/**
 * Retorna a chave e os limites UTC (em segundos) do dia atual em "America/Sao_Paulo".
 */
export function getTodayRangeSaoPaulo(nowDate: Date = new Date()): {
  todayKey: string;
  startTimestamp: number;
  endTimestamp: number;
} {
  const todayKey = getDayKeySaoPaulo(nowDate);
  const { startTimestamp, endTimestamp } = getDayUtcRangeSaoPaulo(todayKey);
  return {
    todayKey,
    startTimestamp,
    endTimestamp,
  };
}

/**
 * Retorna quantos milissegundos faltam até 00:00:02 do próximo dia em "America/Sao_Paulo".
 */
export function getMsUntilNextSaoPauloMidnight(nowDate: Date = new Date()): number {
  const todayKey = getDayKeySaoPaulo(nowDate);
  const tomorrowKey = addDaysToDayKey(todayKey, 1);
  const nextMidnightMs = getSaoPauloMidnightUtcMs(tomorrowKey) + 2000;
  return Math.max(1000, nextMidnightMs - nowDate.getTime());
}

/**
 * Calcula os dias da semana de segunda-feira a domingo com base no fuso "America/Sao_Paulo".
 * Aceita offsetWeeks (0 = semana atual, -1 = semana anterior, 1 = próxima semana).
 */
export function getWeekInfoSaoPaulo(
  offsetWeeks = 0,
  nowDate: Date = new Date(),
): {
  days: WeekDayInfo[];
  weekRangeLabel: string;
  weekKey: string;
  startTimestamp: number;
  endTimestamp: number;
} {
  const todayKey = getDayKeySaoPaulo(nowDate);
  const [currentYear, currentMonth, currentDay] = todayKey.split("-").map(Number);

  const baseDate = new Date(Date.UTC(currentYear, currentMonth - 1, currentDay, 12, 0, 0));
  const dayOfWeek = baseDate.getUTCDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const mondayDate = new Date(baseDate);
  mondayDate.setUTCDate(baseDate.getUTCDate() + diffToMonday + offsetWeeks * 7);

  const days: WeekDayInfo[] = [];

  for (let i = 0; i < 7; i += 1) {
    const d = new Date(mondayDate);
    d.setUTCDate(mondayDate.getUTCDate() + i);

    const dateKey = d.toISOString().slice(0, 10);
    const [, m, dayNum] = dateKey.split("-");
    const monthIndex = Number(m) - 1;
    const dayInt = Number(dayNum);
    const dateStr = `${dayNum}/${m}`;
    const fullDateStr = `${WEEK_DAY_NAMES[i].name.toLowerCase()}, ${dayInt} de ${PT_BR_MONTHS[monthIndex] ?? m}`;

    days.push({
      index: i,
      name: WEEK_DAY_NAMES[i].name,
      cleanName: WEEK_DAY_NAMES[i].cleanName,
      shortName: WEEK_DAY_NAMES[i].shortName,
      dateKey,
      dateStr,
      fullDateStr,
      isToday: dateKey === todayKey,
    });
  }

  const firstDay = days[0];
  const lastDay = days[6];
  const weekRangeLabel = `${firstDay.dateStr} a ${lastDay.dateStr}`;

  const { startTimestamp } = getDayUtcRangeSaoPaulo(firstDay.dateKey);
  const { endTimestamp } = getDayUtcRangeSaoPaulo(lastDay.dateKey);

  return {
    days,
    weekRangeLabel,
    weekKey: firstDay.dateKey,
    startTimestamp,
    endTimestamp,
  };
}
