export type BanDurationPreset =
  | "20m"
  | "1h"
  | "2h"
  | "6h"
  | "12h"
  | "24h"
  | "3d"
  | "7d"
  | "30d"
  | "custom";

export type CustomDurationUnit = "minutes" | "hours" | "days";

export interface BanPresetOption {
  value: Exclude<BanDurationPreset, "custom">;
  label: string;
  shortLabel: string;
  durationMs: number;
}

export const BAN_DURATION_PRESETS: readonly BanPresetOption[] = [
  {
    value: "20m",
    label: "20 minutos",
    shortLabel: "20m",
    durationMs: 20 * 60 * 1000,
  },
  {
    value: "1h",
    label: "1 hora",
    shortLabel: "1h",
    durationMs: 60 * 60 * 1000,
  },
  {
    value: "2h",
    label: "2 horas",
    shortLabel: "2h",
    durationMs: 2 * 60 * 60 * 1000,
  },
  {
    value: "6h",
    label: "6 horas",
    shortLabel: "6h",
    durationMs: 6 * 60 * 60 * 1000,
  },
  {
    value: "12h",
    label: "12 horas",
    shortLabel: "12h",
    durationMs: 12 * 60 * 60 * 1000,
  },
  {
    value: "24h",
    label: "24 horas",
    shortLabel: "24h",
    durationMs: 24 * 60 * 60 * 1000,
  },
  {
    value: "3d",
    label: "3 dias",
    shortLabel: "3d",
    durationMs: 3 * 24 * 60 * 60 * 1000,
  },
  {
    value: "7d",
    label: "7 dias",
    shortLabel: "7d",
    durationMs: 7 * 24 * 60 * 60 * 1000,
  },
  {
    value: "30d",
    label: "30 dias",
    shortLabel: "30d",
    durationMs: 30 * 24 * 60 * 60 * 1000,
  },
] as const;

export const MIN_BAN_DURATION_MS = 60 * 1000; // 1 minuto
export const MAX_BAN_DURATION_MS = 365 * 24 * 60 * 60 * 1000; // 365 dias

export interface ActiveUserBan {
  banId: string;
  userId: string;
  reason: string;
  durationPreset: BanDurationPreset;
  durationLabel: string;
  durationMs: number;
  bannedAt: number;
  expiresAt: number;
  bannedBy: string;
  bannedByName: string | null;
}

export interface EnrichedActiveUserBan extends ActiveUserBan {
  userName: string;
  userNick: string | null;
  userEmail: string | null;
  userImage: string | null;
  remainingMs: number;
}

export interface BanHistoryEntry {
  id: string;
  banId: string;
  action: "ban" | "unban" | "expired";
  userId: string;
  userName?: string | null;
  userNick?: string | null;
  userEmail?: string | null;
  reason: string;
  durationPreset?: BanDurationPreset | null;
  durationLabel?: string | null;
  durationMs?: number | null;
  bannedAt?: number | null;
  expiresAt?: number | null;
  actorId: string;
  actorName: string | null;
  createdAt: number;
}

export function resolveBanDuration(input: {
  preset?: string | null;
  customAmount?: number | string | null;
  customUnit?: string | null;
}): {
  preset: BanDurationPreset;
  durationMs: number;
  durationLabel: string;
} {
  const rawPreset = typeof input.preset === "string" ? input.preset.trim().toLowerCase() : "";

  if (rawPreset && rawPreset !== "custom") {
    const found = BAN_DURATION_PRESETS.find((p) => p.value === rawPreset);
    if (!found) {
      throw new Error(`Duração pré-definida inválida: "${rawPreset}".`);
    }
    return {
      preset: found.value,
      durationMs: found.durationMs,
      durationLabel: found.label,
    };
  }

  const parsedAmount =
    typeof input.customAmount === "number"
      ? input.customAmount
      : Number(String(input.customAmount ?? "").trim());

  if (!Number.isFinite(parsedAmount) || !Number.isInteger(parsedAmount) || parsedAmount <= 0) {
    throw new Error("Informe um valor numérico inteiro positivo para a duração personalizada.");
  }

  const unit =
    typeof input.customUnit === "string"
      ? input.customUnit.trim().toLowerCase()
      : "hours";

  let multiplier = 60 * 60 * 1000;
  let unitLabel = parsedAmount === 1 ? "hora" : "horas";

  if (unit === "minutes" || unit === "minute" || unit === "m" || unit === "min") {
    multiplier = 60 * 1000;
    unitLabel = parsedAmount === 1 ? "minuto" : "minutos";
  } else if (unit === "hours" || unit === "hour" || unit === "h") {
    multiplier = 60 * 60 * 1000;
    unitLabel = parsedAmount === 1 ? "hora" : "horas";
  } else if (unit === "days" || unit === "day" || unit === "d") {
    multiplier = 24 * 60 * 60 * 1000;
    unitLabel = parsedAmount === 1 ? "dia" : "dias";
  } else {
    throw new Error("Unidade de duração inválida. Use minutos, horas ou dias.");
  }

  const durationMs = parsedAmount * multiplier;
  if (durationMs < MIN_BAN_DURATION_MS) {
    throw new Error("A duração mínima do banimento é de 1 minuto.");
  }
  if (durationMs > MAX_BAN_DURATION_MS) {
    throw new Error("A duração máxima do banimento temporário é de 365 dias.");
  }

  return {
    preset: "custom",
    durationMs,
    durationLabel: `${parsedAmount} ${unitLabel}`,
  };
}

export function isBanActiveAt(ban: ActiveUserBan | null | undefined, nowMs = Date.now()): boolean {
  if (!ban) return false;
  return Number.isFinite(ban.expiresAt) && ban.expiresAt > nowMs;
}

export function formatBanDateTime(timestampMs: number): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(timestampMs));
  } catch {
    return new Date(timestampMs).toISOString();
  }
}

export function formatBanRemaining(expiresAt: number, nowMs = Date.now()): string {
  const diff = Math.max(0, expiresAt - nowMs);
  if (diff <= 0) return "Expirado";

  const totalSeconds = Math.ceil(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}
